// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{collections::HashMap, fs::File, io::Write, process, sync::{atomic::{self, AtomicBool, AtomicPtr}, Arc, Mutex}, thread, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};

use cpal::{traits::{DeviceTrait, HostTrait, StreamTrait}, Device, Host};
use directories::ProjectDirs;
use recorder::DeviceEq as _;
use scrap::{TraitCapturer, TraitPixelBuffer};
use strum::IntoEnumIterator;
use tauri::{api::dialog, async_runtime::channel, Manager, State, Window};
use gst::prelude::*;

use crate::util::{gstreamer_loop, replace_multiple_whitespace};

mod recorder;
mod transcriber;
mod util;

#[tauri::command]
fn list_device_types() -> Vec<&'static str> {
    recorder::DeviceType::iter()
        .map(|d| d.into() )
        .collect()
}

#[tauri::command]
fn list_devices(host: State<Host>, selected_devices: State<Mutex<recorder::SelectedDevices<Device> >>, device_type_index: usize) -> Vec<recorder::DeviceResult>  {
    let device_type = recorder::DeviceType::iter().nth(device_type_index).expect("Can't find specified device type");

    let selected_devices = selected_devices.lock().unwrap();
    let selected_device = selected_devices.0.get(&device_type).expect("Can't get the default devices");

    let devices = match device_type {
        recorder::DeviceType::Microphone => host.input_devices(),
        recorder::DeviceType::Speaker => host.output_devices(),
    }.expect("Can't query device list");

    devices
        .map(|d| {
            let name = d.name().unwrap_or(String::from("Unknown device"));
            let is_selected = d.eq_device(selected_device);

            recorder::DeviceResult { name, is_selected }
        })
        .collect()
}

#[tauri::command]
fn select_device(host: State<Host>, selected_devices: State<Mutex<recorder::SelectedDevices<Device>>>, device_type_index: usize, device_index: Option<usize>) {
    let device_type = recorder::DeviceType::iter().nth(device_type_index).expect("Can't find specified device type");

    let mut devices = match device_type {
        recorder::DeviceType::Microphone => host.input_devices(),
        recorder::DeviceType::Speaker => host.output_devices(),
    }.expect("Can't query device list");

    let device = devices.nth(device_index.expect("Selected device is invalid")).expect("Can't find the specified device");

    println!("Updating {device_type:?} to {}", device.name().unwrap());

    let mut selected_devices = selected_devices.lock().unwrap();
    selected_devices.0.insert(device_type, device);
}

#[tauri::command]
async fn start_device_record(selected_devices: State<'_, Mutex<recorder::SelectedDevices<Device>>>, record_channel: State<'_, recorder::RecordChannel>, record_screen: bool) -> Result<(), ()> {
    let devices = selected_devices.lock().unwrap().0.clone().into_iter().collect();

    record_channel.send(
        recorder::RecordCommand::Start {
            devices,
            record_screen,
        }
    ).await.unwrap();

    Ok(())
}

#[tauri::command]
fn pause_device_record(record_channel: State<recorder::RecordChannel>) {
    record_channel.try_send(recorder::RecordCommand::Pause).expect("Can't pause recording");
}

#[tauri::command]
fn resume_device_record(record_channel: State<recorder::RecordChannel>) {
    record_channel.try_send(recorder::RecordCommand::Resume).expect("Can't resume recording");
}

#[tauri::command]
fn stop_device_record(record_channel: State<recorder::RecordChannel>) {
    record_channel.try_send(recorder::RecordCommand::Stop).expect("Can't stop recording");
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
fn switch_language(transcriber: State<'_, Arc<Mutex<transcriber::Transcriber>>>, language: String) {
    println!("Switching language to {language}");

    transcriber.lock().unwrap().change_language(language);
}

#[tauri::command]
fn switch_model(transcriber: State<'_, Arc<Mutex<transcriber::Transcriber>>>, model_index: usize) {
    println!("Switching model to {model_index}");

    let model = transcriber::ModelType::iter().nth(model_index).unwrap();

    transcriber.lock().unwrap().change_model(model);
}

#[tauri::command]
fn load_model_list() -> Vec<serde_json::Value> {
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

    gst::init().unwrap();

    let (record_tx, mut record_rx): (recorder::RecordChannel, _) = channel(128);

    let transcriber = Arc::new(Mutex::new(transcriber::Transcriber::new(transcriber::ModelType::TinyWhisper)));

    let host = cpal::default_host();

    let mut selected_devices = recorder::SelectedDevices(HashMap::new());

    let default_input = host.default_input_device().unwrap();
    let default_output = host.default_output_device().unwrap();

    selected_devices.0.insert(recorder::DeviceType::Microphone, default_input);
    selected_devices.0.insert(recorder::DeviceType::Speaker, default_output);
    
    tauri::Builder::default()
        .manage(Mutex::new(selected_devices))
        .manage(transcriber.clone())
        .manage(record_tx)
        .manage(host)
        .invoke_handler(tauri::generate_handler![
            start_device_record,
            pause_device_record,
            resume_device_record,
            stop_device_record,
            load_model_list,
            download_model,
            switch_model,
            switch_language,
            list_device_types,
            list_devices,
            select_device,
        ])
        .setup(move |app| {
            let window = app.get_window("main").expect("Can't get the main window");
            let transcriber = transcriber.clone();

            thread::spawn(move || {
                let mut recorder : Vec<(Arc<AtomicBool>, gst::Pipeline)>= vec![];
                let media_data = Arc::new(Mutex::new(Vec::<u8>::new()));
        
                loop {
                    let Some(command) = record_rx.blocking_recv() else { continue };
        
                    match command {
                        recorder::RecordCommand::Start { devices, record_screen } => {
                            let recording_duration = Instant::now();

                            let should_stop = Arc::new(AtomicBool::new(false));
                            
                            let mut pipeline_description = Vec::new();

                            let mut input_callbacks: Vec<(String, gst_app::AppSrcCallbacks)> = Vec::new();
                            let mut audio_streams: Vec<cpal::Stream> = Vec::new();

                            for (index, (device_type, device)) in devices.into_iter().enumerate() {
                                let config = match device_type {
                                    recorder::DeviceType::Microphone => device.default_input_config().unwrap(),
                                    recorder::DeviceType::Speaker { .. } => device.default_output_config().unwrap(),
                                };

                                let sample_format = config.sample_format();

                                let audio_input_name = format!("{device_type:?}_{}", device.name().unwrap_or_default());

                                pipeline_description.push(
                                    format!(
                                       "appsrc name={audio_input_name} !
                                            rawaudioparse pcm-format={format} sample-rate={rate} num-channels={channels} ! audioconvert ! audioresample !
                                            opusenc !
                                        {queue} ! mux.",
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
                                            channels = config.channels(),
                                            queue = if index == 0 { "multiqueue name=q" } else { "q. q." }
                                    )
                                );

                                let (audio_rx, audio_tx) = std::sync::mpsc::sync_channel::<Arc<[u8]>>(0);

                                let stream = device.build_input_stream_raw(&config.into(), sample_format, {
                                    move |data: &cpal::Data, _: &_| {
                                        let _ = audio_rx.send(Arc::from(data.bytes()));
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

                            if record_screen {
                                let display = scrap::Display::all().unwrap().swap_remove(0);

                                let video_input_name = format!("{}", display.name());

                                pipeline_description.push(format!(
                                    "appsrc name={video_input_name} ! rawvideoparse width={width} height={height} format=8 ! videoconvert ! x264enc tune=zerolatency speed-preset=veryfast ! q. q. ! mux.",
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
        
                                                let Ok(scrap::Frame::PixelBuffer(pixel_buffer)) = unsafe { &mut *capturer.load(atomic::Ordering::Acquire) }.frame(Duration::ZERO) else { continue };

                                                break pixel_buffer;
                                            };

                                            let pts = Instant::now() - recording_duration;

                                            let data = pixel_buffer.data();
                                            let mut buffer = gst::Buffer::from_slice(Arc::from(data));
                                            buffer.get_mut().unwrap().set_pts(Some(gst::ClockTime::from_seconds_f64(pts.as_secs_f64())));

                                            let _ = source.push_buffer(buffer);
                                        }
                                    })
                                    .build();

                                input_callbacks.push((video_input_name, video_input_callbacks));
                            }

                            pipeline_description.push("mp4mux name=mux faststart=true ! appsink name=output".to_string());

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

                            let mut output = File::create("output.mp4").unwrap();

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
                                            media_data.lock().unwrap().write(buffer).unwrap();

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
                        },
                        recorder::RecordCommand::Pause => {
                            for (_, pipeline) in &recorder {
                                println!("Pausing pipeline");
                                pipeline.set_state(gst::State::Paused).unwrap();
                            }
                        },
                        recorder::RecordCommand::Resume => {
                            for (_, pipeline) in &recorder {
                                println!("Resuming pipeline");
                                pipeline.set_state(gst::State::Playing).unwrap();
                            }
                        },
                        recorder::RecordCommand::Stop => {
                            for (should_stop, pipeline) in &mut recorder {
                                should_stop.store(true, atomic::Ordering::Relaxed);

                                while pipeline.current_state() != gst::State::Null {
                                    std::thread::yield_now();
                                }
                            }

                            let mut media_data = media_data.lock().unwrap();

                            let mut data = vec![0u8; media_data.len()];
                            media_data.swap_with_slice(&mut data);
                            media_data.clear();

                            recorder.clear();

                            transcriber.lock().unwrap()
                                .transcribe(&window, data);

                        },
                    }
                }
            });

            Ok(())
        }).run(tauri::generate_context!())
        .expect("error while running tauri application");
}
