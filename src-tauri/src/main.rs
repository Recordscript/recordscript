// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{char::decode_utf16, env::temp_dir, fs, io::{self, Cursor, Read, Seek, Write}, ops::Div, path::PathBuf, process, sync::{Arc, Mutex}, thread, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};

use anyhow::Context;
use cpal::{traits::{DeviceTrait, HostTrait, StreamTrait}, Device, FromSample, Host, Sample};
use directories::ProjectDirs;
use ffmpeg_next::Rescale;
use hound::{WavReader, WavSpec, WavWriter};
use strum::IntoEnumIterator;
use strum_macros::EnumIter;
use tauri::{api::dialog, async_runtime::{channel, Sender}, http::Response, Manager, State, Window};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};
struct ChosenInputDevice(usize);
struct ChosenOutputDevice(usize);

enum RecordCommand {
    Input(CommandAudioRecord),
    Output(CommandAudioRecord),
}

type AudioRecordCommand = Sender<RecordCommand>;
type TranscriberModelChangeCommand = Sender<TranscriberModelType>;

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

#[tauri::command]
fn send_webcam_buffer(buffer: Vec<u8>) {
    dialog::FileDialogBuilder::new()
        .set_title("Save Camera Recording")
        .add_filter("Video", &["webm"])
        .save_file(|path| {
            let Some(path) = path else { return };

            std::fs::write(path, buffer).expect("Failed writing buffer");
        });
}

fn project_directory() -> ProjectDirs {
    directories::ProjectDirs::from("ai.firstsupport", "Firstsupport AI", "Transcriber PoC").expect("Cannot use app directory")
}

trait TranscriberModelDir {
    fn transcriber_model_dir(&self) -> PathBuf;
}

impl TranscriberModelDir for ProjectDirs {
    fn transcriber_model_dir(&self) -> PathBuf {
        let dir = self.cache_dir().join("model");
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }
}

#[derive(Debug, EnumIter)]
enum TranscriberModelType {
    Tiny,
    Base,
    Small,
    Medium,
    Large,
}

impl TranscriberModelType {
    fn get_name(&self) -> &'static str {
        match self {
            TranscriberModelType::Tiny => "Poor",
            TranscriberModelType::Base => "Average",
            TranscriberModelType::Small => "Better",
            TranscriberModelType::Medium => "Good",
            TranscriberModelType::Large => "Best",
        }
    }

    /// Use [`TranscriberModelType::get_model_file_name`] as the file name when saving to file system
    fn get_model_url(&self) -> &'static str {
        match self {
            TranscriberModelType::Tiny => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin?download=true",
            TranscriberModelType::Base => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin?download=true",
            TranscriberModelType::Small => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin?download=true",
            TranscriberModelType::Medium => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin?download=true",
            TranscriberModelType::Large => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2-q5_0.bin?download=true",
        }
    }

    /// Use this file name when saving to file system
    fn get_model_file_name(&self) -> &'static str {
        match self {
            TranscriberModelType::Tiny => "tiny.bin",
            TranscriberModelType::Base => "base.bin",
            TranscriberModelType::Small => "small.bin",
            TranscriberModelType::Medium => "medium.bin",
            TranscriberModelType::Large => "large-v2.bin",
        }
    }

    /// Average memory usage of models in MB
    ///
    /// Refer to this: https://huggingface.co/ggerganov/whisper.cpp
    fn get_avg_mem_usage(&self) -> usize {
        match self {
            TranscriberModelType::Tiny => 390,
            TranscriberModelType::Base => 500,
            TranscriberModelType::Small => 1000,
            TranscriberModelType::Medium => 2600,
            TranscriberModelType::Large => 4700,
        }
    }

    /// Disk usage of models in MB
    ///
    /// Using the non quantized model size, even if we use the quantized model, just in case
    ///
    /// Refer to this: https://huggingface.co/ggerganov/whisper.cpp
    fn get_disk_usage(&self) -> usize {
        match self {
            TranscriberModelType::Tiny => 75,
            TranscriberModelType::Base => 142,
            TranscriberModelType::Small => 466,
            TranscriberModelType::Medium => 1500,
            TranscriberModelType::Large => 2900,
        }
    }

    fn model_path(&self) -> PathBuf {
        project_directory().transcriber_model_dir().join(self.get_model_file_name())
    }

    fn is_downloaded(&self) -> bool {
        let model_file_path = self.model_path();
        
        model_file_path.exists()
    }
}

#[tauri::command]
fn download_model(window: Window, model_index: usize) -> String {
    let channel_name = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos().to_string();
    
    let model = TranscriberModelType::iter().nth(model_index).unwrap();

    let channel = channel_name.clone();
    tauri::async_runtime::spawn(async move {
        let mut response = reqwest::get(model.get_model_url()).await.unwrap();

        let mut file = std::fs::File::create(model.model_path()).unwrap();

        let mut downloaded_size = 0;
        let predicted_size = response.content_length().unwrap_or((model.get_disk_usage() * 1000000) as _);
        
        while let Some(chunk) = match response.chunk().await {
            Ok(chunk) => chunk,
            Err(err) => {
                window.emit(&channel, serde_json::json!({
                    "type": "error",
                    "value": format!("{err:?}"),
                })).unwrap();
                return;
            },
        } {
            match file.write(&chunk) {
                Ok(length) => downloaded_size += dbg!(length),
                Err(err) => window.emit(&channel, serde_json::json!({
                    "type": "error",
                    "value": format!("{err:?}"),
                })).unwrap(),
            }

            dbg!(downloaded_size, predicted_size);

            window.emit(&channel, serde_json::json!({
                "type": "progress",
                "value": (downloaded_size as f32 / (predicted_size) as f32) * 100.0,
            })).unwrap();
        }

        window.emit(&channel, serde_json::json!({
            "type": "done",
            "value": "",
        })).unwrap();
    });

    channel_name
}

#[tauri::command]
async fn switch_model(select_model: State<'_, TranscriberModelChangeCommand>, model_index: usize) -> Result<(), ()> {
    println!("Switching model to {model_index}");

    let model = TranscriberModelType::iter().nth(model_index).unwrap();

    select_model.send(model).await.unwrap();

    Ok(())
}

#[tauri::command]
fn load_model_list() -> Vec<serde_json::Value> {
    TranscriberModelType::iter()
        .map(|model|
            serde_json::json!({
                "name": model.get_name(),
                "mem_usage": model.get_avg_mem_usage(),
                "disk_usage": model.get_disk_usage(),
                "is_downloaded": model.is_downloaded(),
            })
        ).collect()
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

pub fn format_timestamp(seconds: i64, always_include_hours: bool, decimal_marker: &str) -> String {
    assert!(seconds >= 0, "non-negative timestamp expected");
    let mut milliseconds = (seconds * 10) as f32;

    let hours = milliseconds.div(3_600_000.0).floor();
    milliseconds -= hours * 3_600_000.0;

    let minutes = milliseconds.div(60_000.0).floor();
    milliseconds -= minutes * 60_000.0;

    let seconds = milliseconds.div(1_000.0).floor();
    milliseconds -= seconds * 1_000.0;

    let hours_marker = if always_include_hours || hours as usize != 0 {
        format!("{hours}:")
    } else {
        String::new()
    };

    format!("{hours_marker}{minutes:02}:{seconds:02}{decimal_marker}{milliseconds:03}")
}

mod encoder;
pub fn normalize(input: std::path::PathBuf, output: std::path::PathBuf, seek: String) -> Result<(), ()> {
    ffmpeg_next::init().unwrap();

    let filter = "anull";
    let seek = seek.parse::<i64>().ok();

    dbg!("input is {} and output is {}", input.display(), output.display());
    let mut ictx = ffmpeg_next::format::input(&input).unwrap();
    let mut octx = ffmpeg_next::format::output(&output).unwrap();
    let mut transcoder = encoder::transcoder(&mut ictx, &mut octx, &output, &filter).unwrap();

    if let Some(position) = seek {
        // If the position was given in seconds, rescale it to ffmpegs base timebase.
        let position = position.rescale((1, 1), ffmpeg_next::rescale::TIME_BASE);
        // If this seek was embedded in the transcoding loop, a call of `flush()`
        // for every opened buffer after the successful seek would be advisable.
        ictx.seek(position, ..position).unwrap();
    }

    octx.set_metadata(ictx.metadata().to_owned());
    octx.write_header().unwrap();

    for (stream, mut packet) in ictx.packets() {
        if stream.index() == transcoder.stream {
            packet.rescale_ts(stream.time_base(), transcoder.in_time_base);
            transcoder.send_packet_to_decoder(&packet);
            transcoder.receive_and_process_decoded_frames(&mut octx);
        }
    }

    transcoder.send_eof_to_decoder();
    transcoder.receive_and_process_decoded_frames(&mut octx);

    transcoder.flush_filter();
    transcoder.get_and_process_filtered_frames(&mut octx);

    transcoder.send_eof_to_encoder();
    transcoder.receive_and_process_encoded_packets(&mut octx);

    octx.write_trailer().unwrap();
    Ok(())
}

fn emit_all<S: std::fmt::Debug + serde::Serialize + Clone + Send + 'static>(window: &Window, channel: impl AsRef<str>, payload: S) {
    println!("Emitting {payload:?}");

    let channel = channel.as_ref().to_owned();

    window.emit(channel.as_str(), payload).unwrap();
}

struct Transcriber<'a> {
    window: &'a Window,
    model: TranscriberModelType,
    ctx: Arc<Mutex<Option<WhisperContext>>>,
}

impl<'a> Transcriber<'a> {
    fn new(window: &'a Window, model: TranscriberModelType) -> Self {
        Self {
            window,
            model,
            ctx: Default::default(),
        }
    }

    fn change_model(&mut self, model: TranscriberModelType) {
        self.model = model;
    }

    fn transcribe(&self, audio_buffer: &[u8]) {
        if !self.model.is_downloaded() {
            panic!("Selected model is not downloaded");
        }

        println!("Transcribing audio");

        let mut ctx = self.ctx.lock().unwrap();

        if let None = *ctx {
            let whisper_context = WhisperContext::new_with_params(self.model.model_path().to_str().unwrap(), WhisperContextParameters::default()).unwrap();
            *ctx = Some(whisper_context);
        }

        drop(ctx);

        let source_audio = temp_dir().join(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos().to_string()).with_extension("wav");
        fs::write(&source_audio, audio_buffer).unwrap();

        let resampled_audio = temp_dir().join(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos().to_string()).with_extension("wav");

        normalize(source_audio, resampled_audio.clone(), 0.to_string()).unwrap();

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 5 });

        fn prog(window: Window, progress: usize) {
            
        };

        // FIXME: TRANSCRIBE-PROGRESS find out why this doesn't work.
        // let w = self.window.clone();
        // params.set_progress_callback_safe(move |progress: i32| {
        //     emit_all(&w, "update-state", serde_json::json!({
        //         "type": "transcribe-progress",
        //         "value": progress,
        //     }));
        // });

        let w = self.window.clone();
        let whisper_context = self.ctx.clone();
        std::thread::spawn(move || {
            let whisper_context = whisper_context.lock().unwrap();
            let mut state = whisper_context.as_ref().unwrap().create_state().unwrap();

            emit_all(&w, "update-state", serde_json::json!({
                "type": "transcribe-start",
                "value": "",
            }));

            let wav = WavReader::new(std::fs::File::open(resampled_audio).unwrap()).unwrap();
            let samples = wav.into_samples::<i16>().map(|v| v.unwrap()).collect::<Vec<i16>>();

            state.full(params, &whisper_rs::convert_integer_to_float_audio(&samples)).unwrap();

            let mut fragments = Vec::new();

            for s in 0..state.full_n_segments().unwrap() {
                let text = state.full_get_segment_text(s).unwrap();
                let start = state.full_get_segment_t0(s).unwrap();
                let stop = state.full_get_segment_t1(s).unwrap();

                let fragment = format!(
                    "\n{s}\n{} --> {}\n{}\n",
                    format_timestamp(start, true, ","),
                    format_timestamp(stop, true, ","),
                    text.trim().replace("-->", "->")
                );

                fragments.push(fragment);
            }

            dialog::FileDialogBuilder::new()
                .set_title("Save Transcribed Subtitle")
                .add_filter("Subtitle", &["srt"])
                .save_file(move |path| {
                    let Some(path) = path else { return };

                    std::fs::write(path, fragments.join("\n")).expect("Failed writing buffer");
                });

            emit_all(&w, "update-state", serde_json::json!({
                "type": "transcribe-stop",
                "value": "",
            }));
        });
    }
}

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let message = info.to_string();

        eprintln!("{message:?}");

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

    let (active_model_tx, mut active_model_rx): (TranscriberModelChangeCommand, _) = channel(128);
    let (record_tx, mut record_rx): (AudioRecordCommand, _) = channel(128);
    
    let host = cpal::default_host();
    
    tauri::Builder::default()
        .manage(Mutex::new(ChosenInputDevice(0)))
        .manage(Mutex::new(ChosenOutputDevice(0)))
        .manage(active_model_tx)
        .manage(record_tx)
        .manage(host)
        .invoke_handler(tauri::generate_handler![
            list_input_devices,
            list_output_devices,
            start_audio_recording,
            pause_audio_recording,
            resume_audio_recording,
            stop_audio_recording,
            change_chosen_input_device,
            change_chosen_output_device,
            send_screen_buffer,
            send_webcam_buffer,
            load_model_list,
            download_model,
            switch_model,
        ])
        .setup(|app| {
            let window = app.get_window("main");

            thread::spawn(move || {
                let window = window.as_ref().unwrap();

                emit_all(&window, "update-state", serde_json::json!({
                    "type": "transcribe-progress",
                    "value": format!("{}", 0),
                }));

                let mut transcriber = Transcriber::new(window, TranscriberModelType::Tiny);
        
                let input_cursor = Arc::new(Mutex::new(Cursor::new(Vec::new())));
                let input_arc_writer = Arc::new(Mutex::new(None));
        
                let output_cursor = Arc::new(Mutex::new(Cursor::new(Vec::new())));
                let output_arc_writer = Arc::new(Mutex::new(None));
        
                let mut microphone_stream = None;
                let mut system_audio_stream = None;
        
                loop {
                    if let Ok(model) = active_model_rx.try_recv() {
                        transcriber.change_model(model);
                    }
        
                    if let Ok(command) = record_rx.try_recv() {
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
                                    println!("stopped");
        
                                    microphone_stream.take().expect("Record stream is not found");
                                    microphone_arc_record_writer.try_lock().unwrap().take().unwrap().finalize().unwrap();
                
                                    let mut buffer = Vec::new();
                                    microphone_record_cursor.lock().unwrap().rewind().unwrap();
                                    drop(microphone_record_cursor.lock().unwrap().read_to_end(&mut buffer));
                
                                    // dialog::FileDialogBuilder::new()
                                    //     .set_title("Save Microphone Audio")
                                    //     .add_filter("Microphone", &["wav"])
                                    //     .save_file(|path| {
                                    //         let Some(path) = path else { return };
                
                                    //         std::fs::write(path, buffer).expect("Failed writing buffer");
                                    //     });
                
                                    *microphone_record_cursor.lock().unwrap() = Cursor::new(Vec::new());
            
                                    transcriber.transcribe(&buffer);
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
                
                                    // dialog::FileDialogBuilder::new()
                                    //     .set_title("Save System Audio")
                                    //     .add_filter("System", &["wav"])
                                    //     .save_file(|path| {
                                    //         let Some(path) = path else { return };
                
                                    //         std::fs::write(path, buffer).expect("Failed writing buffer");
                                    //     });
                
                                    *system_record_cursor.lock().unwrap() = Cursor::new(Vec::new());
            
                                    transcriber.transcribe(&buffer);
                                },
                            }
                        }
                    }
        
                    std::thread::sleep(Duration::from_secs_f32(1.0 / 60.0));
                }
            });

            Ok(())
        }).run(tauri::generate_context!())
        .expect("error while running tauri application");
}
