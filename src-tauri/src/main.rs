// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#![allow(clippy::single_match)]

use std::io::Write as _;
use std::str::FromStr as _;
use std::{fs::File, path::PathBuf, sync::{atomic, Arc, Mutex}};

use gst::prelude::*;

use cpal::traits::DeviceTrait as _;
use cpal::traits::HostTrait as _;
use cpal::traits::StreamTrait as _;

use dialog::DialogBox as _;

use scrap::TraitCapturer as _;
use scrap::TraitPixelBuffer as _;

use strum::IntoEnumIterator as _;

use tauri::Manager as _;
use tauri::{State, Window};

use crate::recorder::DeviceEq as _;

mod configuration;
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
    let default_device = &selected_device.lock().unwrap().screen;

    recorder::list_screen().unwrap_or_default().into_iter()
        .map(|screen|
            recorder::DeviceResult {
                name: screen.name(),
                is_selected: screen.eq_device(default_device),
             })
        .collect()
}


#[tauri::command]
fn select_microphone(selected_device: State<'_, SelectedDevice>, device_name: String) {
    let device = recorder::list_microphone().into_iter()
        .find(|device| device.name().unwrap_or_default() == device_name).unwrap();
    
    selected_device.lock().unwrap().microphone = Some(device);

    println!("Switching microphone to {device_name:?}");
}

#[tauri::command]
fn select_speaker(selected_device: State<'_, SelectedDevice>, device_name: String) {
    let device = recorder::list_speaker().into_iter()
        .find(|device| device.name().unwrap_or_default() == device_name).unwrap();
    
    selected_device.lock().unwrap().speaker = Some(device);

    println!("Switching speaker to {device_name:?}");
}

#[tauri::command]
fn select_screen(selected_device: State<'_, SelectedDevice>, device_name: String) {
    let device = recorder::list_screen().unwrap().into_iter()
        .find(|device| device.name() == device_name).unwrap();

    println!("Switching screen to {device_name:?}");
    
    selected_device.lock().unwrap().screen = device;
}

#[tauri::command]
fn preview_screen(device_name: String) -> String {
    let screen = recorder::Screen::all().unwrap().into_iter()
        .find(|screen| screen.name() == &device_name).unwrap();

    let preview = screen.preview().unwrap();
    let encoded = gst::glib::base64_encode(&preview);

    encoded.to_string()
}

#[tauri::command]
async fn start_record(selected_device: State<'_, SelectedDevice>, record_channel: State<'_, RecordChannel>) -> Result<(), ()> {
    let selected_device = selected_device.lock().unwrap().clone();
    record_channel.send(recorder::RecordCommand::Start(selected_device)).await.unwrap();

    Ok(())
}

#[tauri::command]
fn start_transcription(window: Window, general_config: State<GeneralConfig>, smtp_config: State<SMTPConfig>, transcriber: State<Arc<Mutex<transcriber::Transcriber>>>, media_path: String) {
    let Ok(buffer) = std::fs::read(&media_path) else {
        util::emit_all(&window, "app://notification", serde_json::json!({
            "type": "error",
            "value": "Can't read the selected file"
        }));
        return;
    };

    let media_path = PathBuf::from_str(&media_path).unwrap();
    let target_name = media_path.file_stem().unwrap();

    let general_config = general_config.lock().unwrap().clone();
    let smtp_config = smtp_config.lock().unwrap().clone();

    let mut transcription_path = general_config.transcript_save_to.save_path.join(format!("{}.srt", target_name.to_string_lossy()));

    let mut n = 1;
    loop {
        if !transcription_path.exists() { break };

        transcription_path.set_file_name(format!("{} ({n}).srt", target_name.to_string_lossy()));

        n += 1;
    }

    transcriber.lock().unwrap()
        .transcribe(&window, buffer, general_config.clone(), smtp_config, transcription_path.clone(), false);

    println!("Starting transcription with file \"{}\" to \"{}\"", media_path.display(), transcription_path.display());
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

fn project_directory() -> directories::ProjectDirs {
    directories::ProjectDirs::from("com.recordscript", "Recordscript", "Recordscript").expect("Cannot use app directory")
}

#[tauri::command]
fn download_model(window: Window, model_index: usize) -> String {
    let channel_name = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos().to_string();
    
    let model = transcriber::Model::iter().nth(model_index).unwrap();

    let channel = channel_name.clone();
    tauri::async_runtime::spawn(async move {
        let mut response = reqwest::get(model.download_url()).await.unwrap();

        let mut file = std::fs::File::create(model.path()).unwrap();

        let mut downloaded_size = 0;
        let predicted_size = response.content_length().unwrap_or((model.disk_usage() * 1000000) as _);
        
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
fn select_model(transcriber: State<'_, Arc<Mutex<transcriber::Transcriber>>>, model: transcriber::Model) {
    println!("Switching model to {model:?}");

    transcriber.lock().unwrap().change_model(model);
}

#[tauri::command]
fn list_model() -> Vec<serde_json::Value> {
    transcriber::Model::iter()
        .map(|model|
            serde_json::json!({
                "type": model,
                "name": model.name(),
                "mem_usage": model.average_memory_usage(),
                "disk_usage": model.disk_usage(),
                "is_downloaded": model.is_downloaded(),
                "can_run": model.can_run(),
                "whitelisted_lang": model.whitelisted_lang(),
                "category": model.category(),
                "type_name": model.r#type().name(),
                "description": model.description(),
            })
        ).collect()
}

#[tauri::command]
fn list_model_categories() -> Vec<serde_json::Value> {
    transcriber::Category::iter()
        .map(|c| serde_json::json!({
            "type": c,
            "name": c.name(),
        }))
        .collect()
}

#[tauri::command]
fn show_file(path: String) {
    showfile::show_path_in_file_manager(path);
}

#[derive(serde::Serialize)]
enum BuildType {
    Debug,
    Release,
}

#[tauri::command]
fn build_type() -> BuildType {
    if cfg!(debug_assertions) {
        return BuildType::Debug;
    }

    match option_env!("BUILD_TYPE") {
        Some("debug") => BuildType::Debug,
        Some("release") => BuildType::Release,
        _ => BuildType::Release,
    }
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

    let (record_tx, mut record_rx): (RecordChannel, _) = tauri::async_runtime::channel(128);

    let transcriber = Arc::new(Mutex::new(transcriber::Transcriber::new(transcriber::Model::SmallWhisper)));

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
            start_transcription,
            list_model,
            list_model_categories,
            download_model,
            select_model,
            select_language,
            list_microphone,
            list_speaker,
            list_screen,
            select_microphone,
            select_speaker,
            select_screen,
            preview_screen,
            get_general_config,
            set_general_config,
            get_smtp_config,
            set_smtp_config,
            show_file,
            build_type,
        ])
        .setup(move |app| {
            let window = app.get_window("main").expect("Can't get the main window");
            let recorder_control_window = app.get_window("recorder-controller").expect("Can't get the recorder controller window");

            let general_config = general_config.clone();
            let smtp_config = smtp_config.clone();
            let transcriber = transcriber.clone();

            std::thread::spawn(move || {
                let media_data = Arc::new(Mutex::new(Vec::<u8>::new()));
                let mut output_name = String::new();

                let mut should_stop: Option<Arc<atomic::AtomicBool>> = None;
                let mut running_pipeline: Option<gst::Pipeline> = None;
        
                loop {
                    let Some(command) = record_rx.blocking_recv() else { continue };

                    match command {
                        recorder::RecordCommand::Start(selected_device) => {
                            let recording_duration = std::time::Instant::now();

                            should_stop = Some(Arc::new(atomic::AtomicBool::new(false)));
                            
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
                                        }, |_| { }, None).unwrap();

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
    
                                            let pts = std::time::Instant::now() - recording_duration;
    
                                            let mut buffer = gst::Buffer::from_slice(sample);
                                            buffer.get_mut().unwrap().set_pts(Some(gst::ClockTime::from_seconds_f64(pts.as_secs_f64())));
    
                                            let _ = source.push_buffer(buffer);
                                        
                                            if should_stop.clone().unwrap().load(atomic::Ordering::Acquire) {
                                                println!("Stopping audio recorder");
                                                source.end_of_stream().unwrap();
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

                                let capturer = Arc::new(atomic::AtomicPtr::new(Box::into_raw(Box::new(scrap::Capturer::new(display).unwrap()))));

                                let video_input_callbacks = gst_app::AppSrcCallbacks::builder()
                                    .need_data({
                                        let should_stop = should_stop.clone();
                                    
                                        move |source, _| {
                                            let pixel_buffer = loop {
                                                if should_stop.clone().unwrap().load(atomic::Ordering::Acquire) {
                                                    println!("Stopping video recorder");
                                                    source.end_of_stream().unwrap();
                                                    return;
                                                }

                                                let frame = match unsafe { &mut *capturer.load(atomic::Ordering::Acquire) }.frame(std::time::Duration::ZERO) {
                                                    Ok(frame) => frame,
                                                    Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => continue,
                                                    Err(err) if err.kind() == std::io::ErrorKind::InvalidData => {
                                                        eprintln!("Received invalid data, skipping");
                                                        continue
                                                    },
                                                    Err(err) => panic!("{err}"),
                                                };

                                                let scrap::Frame::PixelBuffer(pixel_buffer) = frame else {
                                                    eprintln!("Received frame is not PixelBuffer, skipping");
                                                    continue
                                                };

                                                break pixel_buffer;
                                            };

                                            let pts = std::time::Instant::now() - recording_duration;

                                            let data = pixel_buffer.data();
                                            let mut buffer = gst::Buffer::from_slice(data.to_vec());
                                            buffer.get_mut().unwrap().set_pts(Some(gst::ClockTime::from_seconds_f64(pts.as_secs_f64())));

                                            let _ = source.push_buffer(buffer);
                                        }
                                    })
                                    .build();

                                input_callbacks.push((video_input_name.to_owned(), video_input_callbacks));
                            }

                            pipeline_description.push("mp4mux name=mux faststart=true ! appsink name=output".to_string());

                            println!("Starting pipeline with description: {}", util::replace_multiple_whitespace(&pipeline_description.join("|")));

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

                            let audio_streams = atomic::AtomicPtr::new(Box::into_raw(Box::new(audio_streams)));

                            std::thread::spawn({
                                let pipeline = pipeline.clone();

                                move || {
                                    let audio_streams = unsafe { Box::from_raw(audio_streams.load(atomic::Ordering::Acquire)) };

                                    for stream in audio_streams.iter() {
                                        stream.play().unwrap();
                                    }

                                    util::gstreamer_loop(pipeline, |_| { false }).unwrap();
                               
                                    println!("Closing pipeline");
                                }
                            });

                            running_pipeline = Some(pipeline);

                            recorder_control_window.show().unwrap();
                            recorder_control_window.set_always_on_top(true).unwrap();
                            recorder_control_window.set_content_protected(true).unwrap();

                            window.emit("app://recording_state", "start").unwrap();
                        },
                        recorder::RecordCommand::Pause => {
                            if let Some(pipeline) = &running_pipeline {
                                pipeline.set_state(gst::State::Paused).unwrap();
                            }

                            window.emit("app://recording_state", "pause").unwrap();
                        },
                        recorder::RecordCommand::Resume => {
                            if let Some(pipeline) = &running_pipeline {
                                pipeline.set_state(gst::State::Playing).unwrap();
                            }

                            window.emit("app://recording_state", "start").unwrap();
                        },
                        recorder::RecordCommand::Stop => {
                            window.unminimize().unwrap();
                            window.set_focus().unwrap();

                            recorder_control_window.set_content_protected(false).unwrap();
                            recorder_control_window.hide().unwrap();
                            recorder_control_window.set_always_on_top(false).unwrap();

                            window.emit("app://recording_state", "stop").unwrap();

                            if should_stop.as_ref().map(|v| v.load(atomic::Ordering::Relaxed)).unwrap_or(true) { continue };
                            if let Some(v) = &should_stop { v.store(true, atomic::Ordering::Relaxed) };

                            if let Some(pipeline) = running_pipeline {
                                while pipeline.current_state() != gst::State::Null {
                                    std::thread::yield_now();
                                }
                            } else {
                                continue;
                            }

                            let mut media_data = media_data.lock().unwrap();

                            let mut data = vec![0u8; media_data.len()];
                            media_data.swap_with_slice(&mut data);
                            media_data.clear();

                            running_pipeline = None;

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
                                    .transcribe(&window, data, general_config, smtp_config.lock().unwrap().clone(), transcription_path, true);
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
