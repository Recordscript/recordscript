// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use core::panic;
use std::{collections::HashMap, fs::File, io::Write, ops::{Deref, DerefMut}, process, sync::{atomic::{self, AtomicBool, AtomicPtr}, Arc, Mutex}, thread, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};

use anyhow::{Context, Result};
use cpal::{traits::{DeviceTrait, HostTrait, StreamTrait}, Device, Host};
use dialog::DialogBox;
use directories::ProjectDirs;
use recorder::DeviceEq as _;
use scrap::{TraitCapturer, TraitPixelBuffer};
use serde::{Deserialize, Serialize};
use strum::IntoEnumIterator;
use tauri::{async_runtime::channel, Manager, State, Window};
use gst::{glib::uuid_string_random, prelude::*};

use crate::util::{gstreamer_loop, replace_multiple_whitespace};

pub mod configuration;
mod recorder;
mod transcriber;
mod util;

type SelectedDevice = Arc<Mutex<recorder::SelectedDevice>>;
type RecordChannel = tauri::async_runtime::Sender<recorder::RecordCommand>;

type GeneralConfig = Arc<Mutex<configuration::GeneralConfig>>;
type SMTPConfig = Arc<Mutex<configuration::SMTPConfig>>;

#[tauri::command]
fn list_microphone(selected_device: State<'_, SelectedDevice>) -> Vec<recorder::DeviceResult> {
    let default_device = &selected_device.lock().unwrap().microphone;

    recorder::list_microphone().into_iter()
        .filter(|device| device.name().is_ok())
        .map(|device| 
            recorder::DeviceResult {
                name: device.name().unwrap(),
                is_selected: if let Some(default_device) = default_device { device.eq_device(default_device) } else { false },
            })
        .collect()
}

#[tauri::command]
fn list_speaker(selected_device: State<'_, SelectedDevice>) -> Vec<recorder::DeviceResult> {
    let default_device = &selected_device.lock().unwrap().speaker;

    recorder::list_speaker().into_iter()
        .map(|device| 
            recorder::DeviceResult {
                name: device.name().unwrap_or("Unkown device".to_owned()),
                is_selected: if let Some(default_device) = default_device { device.eq_device(default_device) } else { false },
            })
        .collect()
}

#[tauri::command]
fn list_screen(selected_device: State<'_, SelectedDevice>) -> Vec<recorder::DeviceResult> {
    // let default_device = selected_device.lock().unwrap().

    recorder::list_screen().unwrap_or_default().into_iter()
        .enumerate()
        .map(|(index, screen)|
            recorder::DeviceResult {
                name: screen.name(),
                is_selected: index == 0
            })
        .collect()
}

#[tauri::command]
fn select_microphone(selected_device: State<'_, SelectedDevice>, device_name: String) {
    let device = recorder::list_microphone().into_iter()
        .filter(|device| device.name().unwrap_or_default() == device_name)
        .next().unwrap();
    
    selected_device.lock().unwrap().microphone = Some(device);

    println!("Switching microphone to {device_name:?}");
}

#[tauri::command]
fn select_speaker(selected_device: State<'_, SelectedDevice>, device_name: String) {
    let device = recorder::list_speaker().into_iter()
        .filter(|device| device.name().unwrap_or_default() == device_name)
        .next().unwrap();
    
    selected_device.lock().unwrap().speaker = Some(device);

    println!("Switching speaker to {device_name:?}");
}

#[tauri::command]
fn select_screen(selected_device: State<'_, SelectedDevice>, device_name: String) {
    let device = recorder::list_screen().unwrap().into_iter()
        .filter(|device| device.name() == device_name)
        .next().unwrap();

    println!("Switching screen to {device_name:?}");
    
    selected_device.lock().unwrap().screen = device;
}

#[tauri::command]
async fn start_record(selected_device: State<'_, SelectedDevice>, record_channel: State<'_, RecordChannel>) -> Result<(), ()> {
    let selected_device = selected_device.lock().unwrap().clone();
    record_channel.send(recorder::RecordCommand::Start(selected_device)).await.unwrap();

    Ok(())
}

#[tauri::command]
fn pause_record(record_channel: State<RecordChannel>) {
    record_channel.try_send(recorder::RecordCommand::Pause).expect("Can't pause recording");
}

#[tauri::command]
fn resume_record(record_channel: State<RecordChannel>) {
    record_channel.try_send(recorder::RecordCommand::Resume).expect("Can't resume recording");
}

#[tauri::command]
fn stop_record(record_channel: State<RecordChannel>) {
    record_channel.try_send(recorder::RecordCommand::Stop).expect("Can't stop recording");
}

#[tauri::command]
fn get_general_config(general_config: State<'_, GeneralConfig>) -> configuration::GeneralConfig {
    general_config.lock().unwrap().clone()
}

#[tauri::command]
fn set_general_config(general_config_state: State<'_, GeneralConfig>, general_config: configuration::GeneralConfig) {
    println!("Saving general config\n{general_config:?}");
    configuration::save(&general_config);

    *general_config_state.lock().unwrap() = general_config;
}

#[tauri::command]
fn get_smtp_config(config: State<'_, SMTPConfig>) -> configuration::SMTPConfig {
    config.lock().unwrap().clone()
}

#[tauri::command]
fn set_smtp_config(config_state: State<'_, SMTPConfig>, config: configuration::SMTPConfig) {
    println!("Saving general config\n{config:?}");
    configuration::save(&config);

    *config_state.lock().unwrap() = config;
}

fn project_directory() -> ProjectDirs {
    directories::ProjectDirs::from("ai.firstsupport", "Firstsupport AI", "Transcriber PoC").expect("Cannot use app directory")
}

#[tauri::command]
fn download_model(window: Window, model_index: usize) -> String {
    let channel_name = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos().to_string();
    
    let model = transcriber::ModelType::iter().nth(model_index).unwrap();

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
fn select_language(transcriber: State<'_, Arc<Mutex<transcriber::Transcriber>>>, language: String) {
    println!("Switching language to {language}");

    transcriber.lock().unwrap().change_language(language);
}

#[tauri::command]
fn select_model(transcriber: State<'_, Arc<Mutex<transcriber::Transcriber>>>, model: usize) {
    println!("Switching model to {model}");

    let model = transcriber::ModelType::iter().nth(model).unwrap();

    transcriber.lock().unwrap().change_model(model);
}

#[tauri::command]
fn list_model() -> Vec<serde_json::Value> {
    transcriber::ModelType::iter()
        .map(|model|
            serde_json::json!({
                "name": model.get_name(),
                "mem_usage": model.get_avg_mem_usage(),
                "disk_usage": model.get_disk_usage(),
                "is_downloaded": model.is_downloaded(),
            })
        ).collect()
}

#[tauri::command]
fn show_file(path: String) {
    showfile::show_path_in_file_manager(path);
}

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let message = info.to_string();

        eprintln!("{message:?}");

        dialog::Message::new(message)
            .title("Error")
            .show().ok();
    }));

    gst::init().unwrap();

    let gst_registry = gst::Registry::get();

    gst_registry.scan_path(std::env::current_exe().unwrap().parent().unwrap());

    let (record_tx, mut record_rx): (RecordChannel, _) = channel(128);

    let transcriber = Arc::new(Mutex::new(transcriber::Transcriber::new(transcriber::ModelType::TinyWhisper)));

    let host = cpal::default_host();

    let selected_device: SelectedDevice = Arc::new(Mutex::new(recorder::SelectedDevice {
        microphone: host.default_input_device(),
        speaker: host.default_output_device(),
        screen: scrap::Display::all().unwrap().swap_remove(0),
    }));

    let general_config: GeneralConfig = Arc::new(Mutex::new(configuration::GeneralConfig::default()));
    let smtp_config: SMTPConfig = Arc::new(Mutex::new(configuration::SMTPConfig::default()));
    
    tauri::Builder::default()
        .manage(selected_device)
        .manage(transcriber.clone())
        .manage(record_tx)
        .manage(host)
        .manage(general_config.clone())
        .manage(smtp_config.clone())
        .invoke_handler(tauri::generate_handler![
            start_record,
            stop_record,
            pause_record,
            resume_record,
            list_model,
            download_model,
            select_model,
            select_language,
            list_microphone,
            list_speaker,
            list_screen,
            select_microphone,
            select_speaker,
            select_screen,
            get_general_config,
            set_general_config,
            get_smtp_config,
            set_smtp_config,
            show_file,
        ])
        .setup(move |app| {
            let window = app.get_window("main").expect("Can't get the main window");
            let recorder_control_window = app.get_window("recorder-controller").expect("Can't get the recorder controller window");

            let general_config = general_config.clone();
            let smtp_config = smtp_config.clone();
            let transcriber = transcriber.clone();

            thread::spawn(move || {
                let mut recorder : Vec<(Arc<AtomicBool>, gst::Pipeline)>= vec![];
                let media_data = Arc::new(Mutex::new(Vec::<u8>::new()));
                let mut output_name = String::new();
        
                loop {
                    let Some(command) = record_rx.blocking_recv() else { continue };

                    match command {
                        recorder::RecordCommand::Start(selected_device) => {
                            let recording_duration = Instant::now();

                            let should_stop = Arc::new(AtomicBool::new(false));
                            
                            let mut pipeline_description = Vec::new();

                            let mut input_callbacks: Vec<(String, gst_app::AppSrcCallbacks)> = Vec::new();
                            let mut audio_streams: Vec<cpal::Stream> = Vec::new();

                            output_name = format!(
                                "{date}",
                                date = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S"));

                            pipeline_description.push("audiomixer name=audio_mixer ! avenc_aac ! multiqueue name=q max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! mux.".to_owned());

                            for (index, device) in [selected_device.microphone, selected_device.speaker].into_iter().enumerate() {
                                let Some(device) = device else { continue };

                                let config = match index {
                                    0 => device.default_input_config().unwrap(),
                                    1 => {
                                        let config = device.default_output_config().unwrap();
                                        
                                        let channels = config.channels();

                                        let stream = device.build_output_stream_raw(&config.config(), config.sample_format(), {
                                            move |data, _: &_| {
                                                let sample: Vec<u8> = match data.sample_format() {
                                                    cpal::SampleFormat::I8 => bytemuck::cast_slice(&vec![0_i8; channels as _]).to_owned(),
                                                    cpal::SampleFormat::U8 => bytemuck::cast_slice(&vec![0_u8; channels as _]).to_owned(),
                                                    cpal::SampleFormat::I16 => bytemuck::cast_slice(&vec![0_i16; channels as _]).to_owned(),
                                                    cpal::SampleFormat::U16 => bytemuck::cast_slice(&vec![0_u16; channels as _]).to_owned(),
                                                    cpal::SampleFormat::I32 => bytemuck::cast_slice(&vec![0_i32; channels as _]).to_owned(),
                                                    cpal::SampleFormat::U32 => bytemuck::cast_slice(&vec![0_u32; channels as _]).to_owned(),
                                                    cpal::SampleFormat::F32 => bytemuck::cast_slice(&vec![0_f32; channels as _]).to_owned(),
                                                    cpal::SampleFormat::F64 => bytemuck::cast_slice(&vec![0_f64; channels as _]).to_owned(),
                                                    _ => { unreachable!() }
                                                };

                                                data.bytes_mut().write_all(&sample).unwrap();
                                            }
                                        }, |err| { }, None).unwrap();

                                        audio_streams.push(stream);

                                        config
                                    },
                                    _ => unreachable!(),
                                };

                                let sample_format = config.sample_format();
                                let channels = config.channels();

                                let audio_input_name = format!("audio_{index:?}");

                                pipeline_description.push(
                                    format!(
                                       "appsrc name={audio_input_name} !
                                            rawaudioparse pcm-format={format} sample-rate={rate} num-channels={channels} ! audioconvert ! audioresample !
                                        {queue} ! audio_mixer.",
                                            format =
                                                // https://gstreamer.freedesktop.org/documentation/additional/design/mediatype-audio-raw.html#formats
                                                // https://gstreamer.freedesktop.org/documentation/audio/audio-format.html#GstAudioFormat
                                                match sample_format {
                                                    cpal::SampleFormat::I8 => 2,
                                                    cpal::SampleFormat::U8 => 3,
                                                    cpal::SampleFormat::I16 => 4,
                                                    cpal::SampleFormat::U16 => 6,
                                                    cpal::SampleFormat::I32 => 12,
                                                    cpal::SampleFormat::U32 => 14,
                                                    cpal::SampleFormat::F32 => 28,
                                                    cpal::SampleFormat::F64 => 30,
                                                    format => unimplemented!("SampleFormat {format} is not supported yet")
                                                },
                                            rate = config.sample_rate().0,
                                            queue = if input_callbacks.is_empty() { "multiqueue name=a" } else { "a. a." }
                                    )
                                );

                                let (audio_rx, audio_tx) = std::sync::mpsc::sync_channel::<Vec<u8>>(0);

                                let stream = device.build_input_stream_raw(&config.into(), sample_format, {
                                    move |data: &cpal::Data, _: &_| {
                                        // let _ = std::io::stdout().lock();
                                        let _ = audio_rx.send(data.bytes().to_vec());
                                    }
                                }, |error| panic!("{error}"), None).unwrap();

                                audio_streams.push(stream);
                                                        
                                let audio_input_callbacks = gst_app::AppSrcCallbacks::builder()
                                    .need_data({
                                        let should_stop = should_stop.clone();

                                        move |source, _| {
                                            let Ok(sample) = audio_tx.recv() else {
                                                source.end_of_stream().unwrap();
                                                return;
                                            };
    
                                            let pts = Instant::now() - recording_duration;
    
                                            let mut buffer = gst::Buffer::from_slice(sample);
                                            buffer.get_mut().unwrap().set_pts(Some(gst::ClockTime::from_seconds_f64(pts.as_secs_f64())));
    
                                            let _ = source.push_buffer(buffer);
                                        
                                            if should_stop.load(atomic::Ordering::Acquire) {
                                                println!("Stopping audio recorder");
                                                source.end_of_stream().unwrap();
                                                return;
                                            }
                                        }
                                    })
                                    .build();

                                input_callbacks.push((audio_input_name, audio_input_callbacks));
                            }

                            {
                                let display = selected_device.screen;

                                let video_input_name = "video_0";

                                pipeline_description.push(format!(
                                    "appsrc name=\"{video_input_name}\" ! rawvideoparse width={width} height={height} format=8 ! videoconvert ! x264enc speed-preset=veryfast tune=zerolatency ! video/x-h264,profile=baseline ! q. q. ! mux.",
                                        width = display.width(),
                                        height = display.height(),
                                ));

                                let capturer = Arc::new(AtomicPtr::new(Box::into_raw(Box::new(scrap::Capturer::new(display).unwrap()))));

                                let video_input_callbacks = gst_app::AppSrcCallbacks::builder()
                                    .need_data({
                                        let should_stop = should_stop.clone();
                                    
                                        move |source, _| {
                                            let pixel_buffer = loop {
                                                if should_stop.load(atomic::Ordering::Acquire) {
                                                    println!("Stopping video recorder");
                                                    source.end_of_stream().unwrap();
                                                    return;
                                                }

                                                let frame = match unsafe { &mut *capturer.load(atomic::Ordering::Acquire) }.frame(Duration::ZERO) {
                                                    Ok(frame) => frame,
                                                    Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => continue,
                                                    Err(err) => panic!("{err}"),
                                                };

                                                let scrap::Frame::PixelBuffer(pixel_buffer) = frame else {
                                                    println!("Received frame is not PixelBuffer, skipping");
                                                    continue
                                                };

                                                break pixel_buffer;
                                            };

                                            let pts = Instant::now() - recording_duration;

                                            let data = pixel_buffer.data();
                                            let mut buffer = gst::Buffer::from_slice(data.to_vec());
                                            buffer.get_mut().unwrap().set_pts(Some(gst::ClockTime::from_seconds_f64(pts.as_secs_f64())));

                                            let _ = source.push_buffer(buffer);
                                        }
                                    })
                                    .build();

                                input_callbacks.push((video_input_name.to_owned(), video_input_callbacks));
                            }

                            pipeline_description.push("mp4mux name=mux ! appsink name=output".to_string());

                            println!("Starting pipeline with description: {}", replace_multiple_whitespace(&pipeline_description.join("|")));

                            let pipeline =
                                gst::parse::launch(&pipeline_description.join("\n")).unwrap()
                                    .dynamic_cast::<gst::Pipeline>().unwrap();

                            for (name, callback) in input_callbacks {
                                let source =
                                    pipeline.by_name(&name).unwrap()
                                        .dynamic_cast::<gst_app::AppSrc>().unwrap();

                                source.set_callbacks(callback);
                            }

                            let output_path = general_config.lock().unwrap().save_to.save_path.join(format!("{output_name}.mp4"));

                            let mut output = File::create(output_path).unwrap();

                            pipeline.by_name("output").unwrap().dynamic_cast::<gst_app::AppSink>().unwrap()
                                .set_callbacks(gst_app::AppSinkCallbacks::builder()
                                    .new_sample({
                                        let media_data = media_data.clone();

                                        move |sink| {
                                            let sample = sink.pull_sample().unwrap();
                                            let buffer = sample.buffer().unwrap();
                                            let mapped_buffer = buffer.map_readable().unwrap();
                                            let buffer = mapped_buffer.as_slice();

                                            output.write_all(buffer).unwrap();
                                            media_data.lock().unwrap().write_all(buffer).unwrap();

                                            Ok(gst::FlowSuccess::Ok)
                                        }
                                    })
                                    .build());

                            pipeline.set_state(gst::State::Playing).unwrap();

                            let audio_streams = AtomicPtr::new(Box::into_raw(Box::new(audio_streams)));

                            thread::spawn({
                                let pipeline = pipeline.clone();

                                move || {
                                    let audio_streams = unsafe { Box::from_raw(audio_streams.load(atomic::Ordering::Acquire)) };

                                    for stream in audio_streams.iter() {
                                        stream.play().unwrap();
                                    }

                                    gstreamer_loop(pipeline, |_| { false }).unwrap();
                               
                                    println!("Closing pipeline");
                                }
                            });
    
                            recorder.push((should_stop, pipeline));

                            recorder_control_window.show().unwrap();
                            window.emit("app://recording_state", "start").unwrap();
                        },
                        recorder::RecordCommand::Pause => {
                            for (_, pipeline) in &recorder {
                                println!("Pausing pipeline");
                                pipeline.set_state(gst::State::Paused).unwrap();
                            }

                            window.emit("app://recording_state", "pause").unwrap();
                        },
                        recorder::RecordCommand::Resume => {
                            for (_, pipeline) in &recorder {
                                println!("Resuming pipeline");
                                pipeline.set_state(gst::State::Playing).unwrap();
                            }

                            window.emit("app://recording_state", "start").unwrap();
                        },
                        recorder::RecordCommand::Stop => {
                            recorder_control_window.hide().unwrap();

                            for (should_stop, pipeline) in &mut recorder {
                                should_stop.store(true, atomic::Ordering::Relaxed);

                                while pipeline.current_state() != gst::State::Null {
                                    std::thread::yield_now();
                                }
                            }

                            window.emit("app://recording_state", "stop").unwrap();

                            let mut media_data = media_data.lock().unwrap();

                            let mut data = vec![0u8; media_data.len()];
                            media_data.swap_with_slice(&mut data);
                            media_data.clear();

                            recorder.clear();

                            let general_config = general_config.lock().unwrap().clone();
                            let video_output_path = &general_config.save_to.save_path.join(format!("{output_name}.mp4"));

                            util::emit_all(&window, "app://notification", serde_json::json!({
                                "type": "link",
                                "value": serde_json::json!({
                                    "message": format!("Screen recording is saved at\n{}", video_output_path.display()),
                                    "at": video_output_path
                                })
                            }));

                            if general_config.transcript {
                                let transcription_path = general_config.save_to.save_path.join(format!("{output_name}.srt"));

                                transcriber.lock().unwrap()
                                    .transcribe(&window, data, general_config, smtp_config.lock().unwrap().clone(), transcription_path);
                            }
                        },
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|event| match event.event() {
            tauri::WindowEvent::Destroyed => {
                if event.window().label() == "main" {
                    println!("Main window is closed, closing remaining window");
                    
                    for window in event.window().app_handle().windows() {
                        window.1.close().unwrap();
                    }
                }
            }
            _ => { }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
