// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{io::{self, Cursor, Read, Seek}, process, sync::{Arc, Mutex}, thread};

use cpal::{traits::{DeviceTrait, HostTrait, StreamTrait}, Device, FromSample, Host, Sample};
use tauri::{api::dialog, async_runtime::{channel, Sender}, http::Response, Manager, State};
struct ChosenInputDevice(usize);
struct ChosenOutputDevice(usize);

enum RecordCommand {
    Input(CommandAudioRecord),
    Output(CommandAudioRecord),
}

type AudioRecordCommand = Sender<RecordCommand>;

enum CommandAudioRecord {
    Start(Device),
    Pause,
    Resume,
    Stop,
}

#[tauri::command]
fn list_input_devices(host: State<Host>) -> Vec<String> {
    host
        .input_devices()
        .unwrap()
        .map(|v|
            v.name().unwrap_or(String::from("Unknown device"))
        )
        .collect()
}

#[tauri::command]
fn list_output_devices(host: State<Host>) -> Vec<String> {
    host
        .output_devices()
        .unwrap()
        .map(|v|
            v.name().unwrap_or(String::from("Unknown device"))
        )
        .collect()
}

#[tauri::command]
async fn start_audio_recording(host: State<'_, Host>, input_device: State<'_, Mutex<ChosenInputDevice>>, output_device: State<'_, Mutex<ChosenOutputDevice>>, record_command: State<'_, AudioRecordCommand>) -> Result<(), ()> {
    let ChosenInputDevice(input_device_nth) = *input_device.lock().unwrap();
    let ChosenOutputDevice(output_device_nth) = *output_device.lock().unwrap();

    record_command.send(RecordCommand::Input(CommandAudioRecord::Start(host.input_devices().unwrap().nth(input_device_nth).unwrap()))).await.expect("Failed to send start record command");
    record_command.send(RecordCommand::Output(CommandAudioRecord::Start(host.output_devices().unwrap().nth(output_device_nth).unwrap()))).await.expect("Failed to send start record command");

    Ok(())
}

#[tauri::command]
async fn pause_audio_recording(record_command: State<'_, AudioRecordCommand>) -> Result<(), ()> {
    record_command.send(RecordCommand::Input(CommandAudioRecord::Pause)).await.expect("Failed to send pause record command");
    record_command.send(RecordCommand::Output(CommandAudioRecord::Pause)).await.expect("Failed to send pause record command");

    Ok(())
}

#[tauri::command]
async fn resume_audio_recording(record_command: State<'_, AudioRecordCommand>) -> Result<(), ()> {
    record_command.send(RecordCommand::Input(CommandAudioRecord::Resume)).await.expect("Failed to send resume record command");
    record_command.send(RecordCommand::Output(CommandAudioRecord::Resume)).await.expect("Failed to send resume record command");

    Ok(())
}

#[tauri::command]
async fn stop_audio_recording(record_command: State<'_, AudioRecordCommand>) -> Result<(), ()> {
    record_command.send(RecordCommand::Input(CommandAudioRecord::Stop)).await.expect("Failed to send stop record command");
    record_command.send(RecordCommand::Output(CommandAudioRecord::Stop)).await.expect("Failed to send stop record command");

    Ok(())
}

#[tauri::command]
fn change_chosen_input_device(chosen_input: State<Mutex<ChosenInputDevice>>, device_nth: usize) {
    println!("Changed input device to {device_nth}");
    *chosen_input.lock().unwrap() = ChosenInputDevice(device_nth);
}

#[tauri::command]
fn change_chosen_output_device(chosen_output: State<Mutex<ChosenOutputDevice>>, device_nth: usize) {
    println!("Changed output device to {device_nth}");
    *chosen_output.lock().unwrap() = ChosenOutputDevice(device_nth);
}

#[tauri::command]
fn send_screen_buffer(buffer: Vec<u8>) {
    dialog::FileDialogBuilder::new()
        .set_title("Save Screen Recording")
        .add_filter("Video", &["webm"])
        .save_file(|path| {
            let Some(path) = path else { return };

            std::fs::write(path, buffer).expect("Failed writing buffer");
        });
}

fn sample_format(format: cpal::SampleFormat) -> hound::SampleFormat {
    if format.is_float() {
        hound::SampleFormat::Float
    } else {
        hound::SampleFormat::Int
    }
}

fn wav_spec_from_config(config: &cpal::SupportedStreamConfig) -> hound::WavSpec {
    hound::WavSpec {
        channels: config.channels() as _,
        sample_rate: config.sample_rate().0 as _,
        bits_per_sample: (config.sample_format().sample_size() * 8) as _,
        sample_format: sample_format(config.sample_format()),
    }
}

struct WriterHandle(Arc<Mutex<std::io::Cursor<Vec<u8>>>>);

impl Seek for WriterHandle {
    fn seek(&mut self, pos: std::io::SeekFrom) -> std::io::Result<u64> {
        self.0.lock().unwrap().seek(pos)
    }
}

impl io::Write for WriterHandle {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.0.lock().unwrap().write(buf)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.0.lock().unwrap().flush()
    }
}

type WavWriterHandle<'a> = Arc<Mutex<Option<hound::WavWriter<WriterHandle>>>>;

fn write_input_data<T, U>(input: &[T], writer: &WavWriterHandle)
where
    T: Sample,
    U: Sample + hound::Sample + FromSample<T>,
{
    if let Ok(mut guard) = writer.try_lock() {
        if let Some(writer) = guard.as_mut() {
            for &sample in input.iter() {
                let sample: U = U::from_sample(sample);
                writer.write_sample(sample).ok();
            }
        }
    }
}

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let message = info.to_string();

        tauri::Builder::default()
            .setup(|app| {
                let mut d_builder = dialog::MessageDialogBuilder::new("App is panicking!", message)
                    .kind(dialog::MessageDialogKind::Error)
                    .buttons(dialog::MessageDialogButtons::Ok);

                if let Some(window) = app.get_window("main").as_ref() {
                    d_builder = d_builder.parent(window);
                }

                d_builder.show(|_| process::exit(1));
    
                Ok(())
            }).run(tauri::generate_context!()).ok();
    }));

    let (record_tx, mut record_rx): (AudioRecordCommand, _) = channel(128);

    thread::spawn(move || {
        let input_cursor = Arc::new(Mutex::new(Cursor::new(Vec::new())));
        let input_arc_writer = Arc::new(Mutex::new(None));

        let output_cursor = Arc::new(Mutex::new(Cursor::new(Vec::new())));
        let output_arc_writer = Arc::new(Mutex::new(None));

        let mut microphone_stream = None;
        let mut system_audio_stream = None;

        while let Some(command) = record_rx.blocking_recv() {
            let microphone_arc_record_writer = input_arc_writer.clone();
            let microphone_record_cursor = input_cursor.clone();
            
            let system_arc_record_writer = output_arc_writer.clone();
            let system_record_cursor = output_cursor.clone();

            match command {
                RecordCommand::Input(command) => match command {
                    CommandAudioRecord::Start(device) => {
                        let input_config = device.default_input_config().unwrap();
    
                        let spec = wav_spec_from_config(&input_config);
    
                        *microphone_record_cursor.lock().unwrap() = Cursor::new(Vec::new());
    
                        let writer = hound::WavWriter::new(WriterHandle(microphone_record_cursor.clone()), spec).unwrap();
                        *microphone_arc_record_writer.lock().unwrap() = Some(writer);
    
                        microphone_stream = Some(match input_config.sample_format() {
                            cpal::SampleFormat::I8 => device.build_input_stream(
                                &input_config.into(),
                                move |input, _: &_| write_input_data::<i8, i8>(input, &microphone_arc_record_writer), |err| panic!("{err:?}"), None),
                            cpal::SampleFormat::I16 => device.build_input_stream(
                                &input_config.into(),
                                move |input, _: &_| write_input_data::<i16, i16>(input, &microphone_arc_record_writer), |err| panic!("{err:?}"), None),
                            cpal::SampleFormat::I32 => device.build_input_stream(
                                &input_config.into(),
                                move |input, _: &_| write_input_data::<i32, i32>(input, &microphone_arc_record_writer), |err| panic!("{err:?}"), None),
                            cpal::SampleFormat::F32 => device.build_input_stream(
                                &input_config.into(),
                                move |input, _: &_| write_input_data::<f32, f32>(input, &microphone_arc_record_writer), |err| panic!("{err:?}"), None),
                            _ => panic!("Unsupported sample format"),
                        }.unwrap());
    
                        let _ = microphone_stream.as_ref().map(|v| v.play()).expect("Cannot record audio");
                    },
                    CommandAudioRecord::Resume => {
                        let _ = microphone_stream.as_ref().map(|v| v.play()).expect("Cannot resume audio");
                    }
                    CommandAudioRecord::Pause => {
                        let _ = microphone_stream.as_ref().map(|v| v.pause()).expect("Cannot pause audio");
                    }
                    CommandAudioRecord::Stop => {
                        microphone_stream.take().expect("Record stream is not found");
                        microphone_arc_record_writer.try_lock().unwrap().take().unwrap().finalize().unwrap();
    
                        let mut buffer = Vec::new();
                        microphone_record_cursor.lock().unwrap().rewind().unwrap();
                        drop(microphone_record_cursor.lock().unwrap().read_to_end(&mut buffer));
    
                        dialog::FileDialogBuilder::new()
                            .set_title("Save Microphone Audio")
                            .add_filter("Microphone", &["wav"])
                            .save_file(|path| {
                                let Some(path) = path else { return };
    
                                std::fs::write(path, buffer).expect("Failed writing buffer");
                            });
    
                        *microphone_record_cursor.lock().unwrap() = Cursor::new(Vec::new());
                    },
                }
                RecordCommand::Output(command) => match command {
                    CommandAudioRecord::Start(device) => {
                        let output_config = device.default_output_config().unwrap();
    
                        let spec = wav_spec_from_config(&output_config);
    
                        *system_record_cursor.lock().unwrap() = Cursor::new(Vec::new());
    
                        let writer = hound::WavWriter::new(WriterHandle(system_record_cursor.clone()), spec).unwrap();
                        *system_arc_record_writer.lock().unwrap() = Some(writer);
    
                        system_audio_stream = Some(match output_config.sample_format() {
                            cpal::SampleFormat::I8 => device.build_input_stream(
                                &output_config.into(),
                                move |input, _: &_| write_input_data::<i8, i8>(input, &system_arc_record_writer), |err| panic!("{err:?}"), None),
                            cpal::SampleFormat::I16 => device.build_input_stream(
                                &output_config.into(),
                                move |input, _: &_| write_input_data::<i16, i16>(input, &system_arc_record_writer), |err| panic!("{err:?}"), None),
                            cpal::SampleFormat::I32 => device.build_input_stream(
                                &output_config.into(),
                                move |input, _: &_| write_input_data::<i32, i32>(input, &system_arc_record_writer), |err| panic!("{err:?}"), None),
                            cpal::SampleFormat::F32 => device.build_input_stream(
                                &output_config.into(),
                                move |input, _: &_| write_input_data::<f32, f32>(input, &system_arc_record_writer), |err| panic!("{err:?}"), None),
                            _ => panic!("Unsupported sample format"),
                        }.unwrap());
    
                        let _ = system_audio_stream.as_ref().map(|v| v.play()).expect("Cannot record audio");
                    },
                    CommandAudioRecord::Resume => {
                        let _ = system_audio_stream.as_ref().map(|v| v.play()).expect("Cannot resume audio");
                    }
                    CommandAudioRecord::Pause => {
                        let _ = system_audio_stream.as_ref().map(|v| v.pause()).expect("Cannot pause audio");
                    }
                    CommandAudioRecord::Stop => {
                        system_audio_stream.take().expect("Record stream is not found");
                        system_arc_record_writer.lock().unwrap().take().unwrap().finalize().unwrap();
    
                        let mut buffer = Vec::new();
                        system_record_cursor.lock().unwrap().rewind().unwrap();
                        drop(system_record_cursor.lock().unwrap().read_to_end(&mut buffer));
    
                        dialog::FileDialogBuilder::new()
                            .set_title("Save System Audio")
                            .add_filter("System", &["wav"])
                            .save_file(|path| {
                                let Some(path) = path else { return };
    
                                std::fs::write(path, buffer).expect("Failed writing buffer");
                            });
    
                        *system_record_cursor.lock().unwrap() = Cursor::new(Vec::new());
                    },
                }
            }
        }
    });

    let host = cpal::default_host();
    
    tauri::Builder::default()
        .manage(Mutex::new(ChosenInputDevice(0)))
        .manage(Mutex::new(ChosenOutputDevice(0)))
        .manage(record_tx)
        .manage(host)
        .invoke_handler(tauri::generate_handler![list_input_devices, list_output_devices, start_audio_recording, pause_audio_recording, resume_audio_recording, stop_audio_recording, change_chosen_input_device, change_chosen_output_device, send_screen_buffer])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
