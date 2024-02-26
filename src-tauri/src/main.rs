// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{collections::HashMap, env::temp_dir, fs, io::{self, Cursor, Read, Seek, Write}, ops::{Div, Sub}, path::PathBuf, process::{self, Stdio}, sync::{Arc, Mutex}, thread, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};

use cpal::{traits::{DeviceTrait, HostTrait, StreamTrait}, Device, FromSample, Host, Sample};
use directories::ProjectDirs;
use ffmpeg_next::Rescale;
use ffmpeg_sidecar::{command::FfmpegCommand, paths::sidecar_dir};
use hound::{WavReader, WavWriter};
use strum::IntoEnumIterator;
use strum_macros::{EnumIter, IntoStaticStr};
use tauri::{api::dialog, async_runtime::{channel, Sender}, Manager, State, Window};
use universal_archiver::format::FileFormat;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

#[derive(Debug, Clone, Copy, Eq, Hash, PartialEq, EnumIter, IntoStaticStr)]
enum DeviceType {
    Microphone,
    Speaker,
}

struct SelectedDevices<D: DeviceTrait + Send + Sync>(HashMap<DeviceType, D>);

trait DeviceEq {
    fn eq_device(&self, device: &Device) -> bool;
}

impl DeviceEq for Device {
    fn eq_device(&self, device: &Device) -> bool {
        let a = self.name().unwrap_or_default();
        let b = device.name().unwrap_or_default();

        a.eq(&b)
    }
}

trait DeviceClone {
    fn clone_device(&self, host: &Host) -> Device;
}

impl DeviceClone for Device {
    fn clone_device(&self, host: &Host) -> Device {
        host.devices().expect("Can't get devices")
            .filter(|d| d.eq_device(self))
            .last().expect("Can't find the specified device")
    }
}

enum RecordCommand {
    Start {
        device_type: DeviceType,
        device: Device,
    },
    Pause,
    Resume,
    Stop
}

type RecordChannel = Sender<RecordCommand>;

#[derive(serde::Serialize)]
struct DeviceResult {
    name: String,
    is_selected: bool,
}

#[tauri::command]
fn list_device_types() -> Vec<&'static str> {
    DeviceType::iter()
        .map(|d| d.into() )
        .collect()
}

#[tauri::command]
fn list_devices(host: State<Host>, selected_devices: State<Mutex<SelectedDevices<Device>>>, device_type_index: usize) -> Vec<DeviceResult>  {
    let device_type = DeviceType::iter().nth(device_type_index).expect("Can't find specified device type");

    let selected_devices = selected_devices.lock().unwrap();
    let selected_device = selected_devices.0.get(&device_type).expect("Can't get the default devices");

    let devices = match device_type {
        DeviceType::Microphone => host.input_devices(),
        DeviceType::Speaker => host.output_devices(),
    }.expect("Can't query device list");

    devices
        .map(|d| {
            let name = d.name().unwrap_or(String::from("Unknown device"));
            dbg!(&selected_device.name());
            let is_selected = d.eq_device(selected_device);

            DeviceResult { name, is_selected }
        })
        .collect()
}

#[tauri::command]
fn select_device(host: State<Host>, selected_devices: State<Mutex<SelectedDevices<Device>>>, device_type_index: usize, device_index: Option<usize>) {
    let device_type = DeviceType::iter().nth(device_type_index).expect("Can't find specified device type");

    let mut devices = match device_type {
        DeviceType::Microphone => host.input_devices(),
        DeviceType::Speaker => host.output_devices(),
    }.expect("Can't query device list");

    let device = devices.nth(device_index.expect("Selected device is invalid")).expect("Can't find specified device type");

    println!("Updating {device_type:?} to {}", device.name().unwrap());

    let mut selected_devices = selected_devices.lock().unwrap();
    selected_devices.0.insert(device_type, device);
}

#[tauri::command]
fn start_device_record(host: State<Host>, selected_devices: State<Mutex<SelectedDevices<Device>>>, record_channel: State<RecordChannel>) {
    for (device_type, device) in &selected_devices.lock().unwrap().0 {
        let device_type = *device_type;
        let device = device.clone_device(&host);

        record_channel.try_send(RecordCommand::Start { device_type, device }).expect("Can't start recording");
    }
}

#[tauri::command]
fn pause_device_record(record_channel: State<RecordChannel>) {
    record_channel.try_send(RecordCommand::Pause).expect("Can't pause recording");
}

#[tauri::command]
fn resume_device_record(record_channel: State<RecordChannel>) {
    record_channel.try_send(RecordCommand::Resume).expect("Can't resume recording");
}

#[tauri::command]
fn stop_device_record(record_channel: State<RecordChannel>) {
    record_channel.try_send(RecordCommand::Stop).expect("Can't stop recording");
}

#[tauri::command]
fn send_screen_buffer(screen_buffer: State<Arc<Mutex<Vec<u8>>>>, buffer: Vec<u8>) {
    *screen_buffer.lock().unwrap() = buffer;
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
    TinyWhisper,
    TinyEnWhisper,
    TinyQuantized,
    TinyEnQuantized,
    BaseWhisper,
    BaseEnWhisper,
    BaseQuantized,
    BaseEnQuantized,
    SmallWhisper,
    SmallEnWhisper,
    SmallQuantized,
    SmallEnQuantized,
    MediumQuantized,
    MediumEnQuantized,
    LargeQuantized,
}

// https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin?download=true
impl TranscriberModelType {
    fn get_name(&self) -> &'static str {
        match self {
            TranscriberModelType::TinyWhisper => "Tiny (Whisper)",
            TranscriberModelType::TinyEnWhisper => "Tiny English (Whisper)",
            TranscriberModelType::TinyQuantized => "Tiny (Quantized)",
            TranscriberModelType::TinyEnQuantized => "Tiny English (Quantized)",
            TranscriberModelType::BaseWhisper => "Base (Whisper)",
            TranscriberModelType::BaseEnWhisper => "Base English (Whisper)",
            TranscriberModelType::BaseQuantized => "Base (Quantized)",
            TranscriberModelType::BaseEnQuantized => "Base English (Quantized)",
            TranscriberModelType::SmallWhisper => "Small (Whisper)",
            TranscriberModelType::SmallEnWhisper => "Small English (Whisper)",
            TranscriberModelType::SmallQuantized => "Small (Quantized)",
            TranscriberModelType::SmallEnQuantized => "Small English (Quantized)",
            TranscriberModelType::MediumQuantized => "Medium (Quantized)",
            TranscriberModelType::MediumEnQuantized => "Medium English (Quantized)",
            TranscriberModelType::LargeQuantized => "Large (Quantized)",
        }
    }

    /// Use [`TranscriberModelType::get_model_file_name`] as the file name when saving to file system
    fn get_model_url(&self) -> &'static str {
        match self {
            TranscriberModelType::TinyWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin?download=true",
            TranscriberModelType::TinyEnWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin?download=true",
            TranscriberModelType::TinyQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin?download=true",
            TranscriberModelType::TinyEnQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin?download=true",
            TranscriberModelType::BaseWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true",
            TranscriberModelType::BaseEnWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin?download=true",
            TranscriberModelType::BaseQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin?download=true",
            TranscriberModelType::BaseEnQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin?download=true",
            TranscriberModelType::SmallWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin?download=true",
            TranscriberModelType::SmallEnWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin?download=true",
            TranscriberModelType::SmallQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin?download=true",
            TranscriberModelType::SmallEnQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin?download=true",
            TranscriberModelType::MediumQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin?download=true",
            TranscriberModelType::MediumEnQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en-q5_0.bin?download=true",
            TranscriberModelType::LargeQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-q5_0.bin?download=true",
        }
    }

    /// Use this file name when saving to file system
    fn get_model_file_name(&self) -> &'static str {
        match self {
            TranscriberModelType::TinyWhisper => "tiny.bin",
            TranscriberModelType::TinyEnWhisper => "tiny-en.bin",
            TranscriberModelType::TinyQuantized => "tiny-q.bin",
            TranscriberModelType::TinyEnQuantized => "tiny-en-q.bin",
            TranscriberModelType::BaseWhisper => "base.bin",
            TranscriberModelType::BaseEnWhisper => "base-en.bin",
            TranscriberModelType::BaseQuantized => "base-q.bin",
            TranscriberModelType::BaseEnQuantized => "base-en-q.bin",
            TranscriberModelType::SmallWhisper => "small.bin",
            TranscriberModelType::SmallEnWhisper => "small-en.bin",
            TranscriberModelType::SmallQuantized => "small-q.bin",
            TranscriberModelType::SmallEnQuantized => "small-en-q.bin",
            TranscriberModelType::MediumQuantized => "medium-q.bin",
            TranscriberModelType::MediumEnQuantized => "medium-en.bin",
            TranscriberModelType::LargeQuantized => "large-q.bin",
        }
    }

    /// Average memory usage of models in MB
    ///
    /// Refer to this: https://huggingface.co/ggerganov/whisper.cpp
    fn get_avg_mem_usage(&self) -> usize {
        match self {
            TranscriberModelType::TinyWhisper => 390,
            TranscriberModelType::TinyEnWhisper => 390,
            TranscriberModelType::TinyQuantized => 390,
            TranscriberModelType::TinyEnQuantized => 390,
            TranscriberModelType::BaseWhisper => 500,
            TranscriberModelType::BaseEnWhisper => 500,
            TranscriberModelType::BaseQuantized => 500,
            TranscriberModelType::BaseEnQuantized => 500,
            TranscriberModelType::SmallWhisper => 1000,
            TranscriberModelType::SmallEnWhisper => 1000,
            TranscriberModelType::SmallQuantized => 1000,
            TranscriberModelType::SmallEnQuantized => 1000,
            TranscriberModelType::MediumQuantized => 2600,
            TranscriberModelType::MediumEnQuantized => 2600,
            TranscriberModelType::LargeQuantized => 4700,
        }
    }

    /// Disk usage of models in MB
    ///
    /// Using the non quantized model size, even if we use the quantized model, just in case
    ///
    /// Refer to this: https://huggingface.co/ggerganov/whisper.cpp
    fn get_disk_usage(&self) -> usize {
        match self {
            TranscriberModelType::TinyWhisper => 75,
            TranscriberModelType::TinyEnWhisper => 75,
            TranscriberModelType::TinyQuantized => 75,
            TranscriberModelType::TinyEnQuantized => 75,
            TranscriberModelType::BaseWhisper => 142,
            TranscriberModelType::BaseEnWhisper => 142,
            TranscriberModelType::BaseQuantized => 142,
            TranscriberModelType::BaseEnQuantized => 142,
            TranscriberModelType::SmallWhisper => 466,
            TranscriberModelType::SmallEnWhisper => 466,
            TranscriberModelType::SmallQuantized => 466,
            TranscriberModelType::SmallEnQuantized => 466,
            TranscriberModelType::MediumQuantized => 1500,
            TranscriberModelType::MediumEnQuantized => 1500,
            TranscriberModelType::LargeQuantized => 2900,
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
fn switch_model(transcriber: State<'_, Arc<Mutex<Transcriber>>>, model_index: usize) {
    println!("Switching model to {model_index}");

    let model = TranscriberModelType::iter().nth(model_index).unwrap();

    transcriber.lock().unwrap().change_model(model);
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


#[tauri::command]
fn transcribe(window: Window, transcriber: State<'_, Arc<Mutex<Transcriber>>>, buffer: Vec<u8>) {
    println!("Received transcribe command");
    transcriber.lock().unwrap().transcribe(&window, &buffer);
}

#[tauri::command]
fn save_video(window: Window, buffer: Vec<u8>, format: Vec<&str>) {
    dialog::FileDialogBuilder::new()
        .set_title("Save Video")
        .add_filter("Output", &format)
        .save_file(move |path| {
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
    U: Sample + hound::Sample + FromSample<T> + std::fmt::Debug,
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

pub fn format_duration(duration: Duration) -> String {
    let milliseconds = duration.as_millis() % 1000;
    let seconds = duration.as_secs() % 60;
    let minutes = (duration.as_secs() / 60) % 60;
    let hours = (duration.as_secs() / 60) / 60;

    format!("{:0>2}:{:0>2}:{:0>2}.{:0>3}", hours, minutes, seconds, milliseconds)
}

fn merge_av(inputs: &[(&[u8], Duration, &str)]) -> Vec<u8> {
    let mut ffmpeg = essi_ffmpeg::FFmpeg::new().stderr(Stdio::inherit());

    for &(buffer, offset, format) in inputs {
        ffmpeg = ffmpeg
            .input(buffer).unwrap()
            .args(["-itsoffset", &format_duration(offset)])
            .format(format)
            .done();
    }

    let mut output = None;

    let ffmpeg = ffmpeg
        .output(&mut output).unwrap()
            .codec_audio("copy")
            .codec_video("copy")
            .format("matroska")
            .done();

    let mut ffmpeg = ffmpeg.inspect_args(|args| { dbg!(args); }).start().unwrap();
    ffmpeg.wait().unwrap();

    let mut output_buffer = Vec::new();

    output.expect("Output is unwritten").read_to_end(&mut output_buffer).unwrap();

    output_buffer
}

fn merge_audio(inputs: &[(&[u8], Duration)]) -> Vec<u8> {
    let mut ffmpeg = essi_ffmpeg::FFmpeg::new().stderr(Stdio::inherit());

    let mut offset = Duration::ZERO;

    for &(buffer, off) in inputs {
        offset = offset.max(off);

        ffmpeg = ffmpeg
            .input(buffer).unwrap()
            .format("wav")
            .done();
    }

    let mut output = None;

    let ffmpeg = ffmpeg
        .output(&mut output).unwrap()
            .args(["-filter_complex", &format!("amix=inputs={}:duration=longest,adelay={}|{}", inputs.len(), offset.as_millis(), offset.as_millis())])
            .format("wav")
            .done();

    let mut ffmpeg = ffmpeg.inspect_args(|args| { dbg!(args); }).start().unwrap();
    ffmpeg.wait().unwrap();

    let mut output_buffer = Vec::new();

    output.expect("Output is unwritten").read_to_end(&mut output_buffer).unwrap();

    output_buffer
}

fn resample(buffer: &[u8]) -> Vec<u8> {
    let mut resampled = None;

    let ffmpeg = essi_ffmpeg::FFmpeg::new()
        .stderr(Stdio::inherit())
        .input(buffer).unwrap()
            .format("wav")
            .done()
        .output(&mut resampled).unwrap()
            .args(["-ar", "16000"])
            .args(["-ac", "1"])
            .format("wav")
            .done();

    let mut ffmpeg = ffmpeg.inspect_args(|args| { dbg!(args); }).start().unwrap();
    ffmpeg.wait().unwrap();

    let mut resampled_buffer = Vec::new();

    resampled.expect("Output is unwritten").read_to_end(&mut resampled_buffer).unwrap();

    resampled_buffer
}

fn emit_all<S: std::fmt::Debug + serde::Serialize + Clone + Send + 'static>(window: &Window, channel: impl AsRef<str>, payload: S) {
    println!("Emitting {payload:?}");

    let channel = channel.as_ref().to_owned();

    window.emit(channel.as_str(), payload).unwrap();
}

struct Transcriber {
    model: TranscriberModelType,
    ctx: Arc<Mutex<Option<WhisperContext>>>,
}

impl Transcriber {
    fn new(model: TranscriberModelType) -> Self {
        Self {
            model,
            ctx: Default::default(),
        }
    }

    fn change_model(&mut self, model: TranscriberModelType) {
        self.model = model;

        // Take and drop the old context
        let _ = self.ctx.lock().unwrap().take();
    }

    /// Audio format must be in mono channel and 16khz samplerate
    fn transcribe(&self, window: &Window, audio_buffer: &[u8]) {
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
        dbg!(&source_audio);
        fs::write(&source_audio, audio_buffer).unwrap();

        let params = FullParams::new(SamplingStrategy::Greedy { best_of: 5 });

        // FIXME: TRANSCRIBE-PROGRESS find out why this doesn't work.
        // let w = self.window.clone();
        // params.set_progress_callback_safe(move |progress: i32| {
        //     emit_all(&w, "update-state", serde_json::json!({
        //         "type": "transcribe-progress",
        //         "value": progress,
        //     }));
        // });

        let w = window.clone();
        let whisper_context = self.ctx.clone();
        std::thread::spawn(move || {
            let whisper_context = whisper_context.lock().unwrap();
            let mut state = whisper_context.as_ref().unwrap().create_state().unwrap();

            let wav = WavReader::new(std::fs::File::open(source_audio).unwrap()).unwrap();
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

    let (record_tx, mut record_rx): (RecordChannel, _) = channel(128);

    let transcriber = Arc::new(Mutex::new(Transcriber::new(TranscriberModelType::TinyWhisper)));
    let screen_buffer: Arc<Mutex<Vec<u8>>> = Arc::new(Mutex::new(Vec::new()));

    let host = cpal::default_host();

    let mut selected_devices = SelectedDevices(HashMap::new());

    let default_input = host.default_input_device().unwrap();
    let default_output = host.default_output_device().unwrap();

    selected_devices.0.insert(DeviceType::Microphone, default_input);
    selected_devices.0.insert(DeviceType::Speaker, default_output);
    
    tauri::Builder::default()
        .manage(Mutex::new(selected_devices))
        .manage(transcriber.clone())
        .manage(screen_buffer.clone())
        .manage(record_tx)
        .manage(host)
        .invoke_handler(tauri::generate_handler![
            start_device_record,
            pause_device_record,
            resume_device_record,
            stop_device_record,
            send_screen_buffer,
            send_webcam_buffer,
            load_model_list,
            download_model,
            switch_model,
            transcribe,
            list_device_types,
            list_devices,
            select_device,
            save_video,
        ])
        .setup(move |app| {
            let window = app.get_window("main").expect("Can't get the main window");

            let transcriber = transcriber.clone();
            let screen_buffer = screen_buffer.clone();

            let w = window.clone();
            tauri::async_runtime::spawn(async move {
                if essi_ffmpeg::FFmpeg::get_program().expect("Failed to find FFmpeg").is_some() { return };

                let Some((handle, mut progress_state)) = essi_ffmpeg::FFmpeg::auto_download().await.expect("Failed downloading FFmpeg") else { return };

                tauri::async_runtime::spawn(async move {
                    while let Some(state) = progress_state.recv().await {
                        match state {
                            essi_ffmpeg::FFmpegDownloadProgress::Starting => {
                                w.emit("ffmpeg://download", serde_json::json!({
                                    "type": "start",
                                    "value": "",
                                })).unwrap();
                            },
                            essi_ffmpeg::FFmpegDownloadProgress::Downloading(Some(progress)) => {
                                w.emit("ffmpeg://download", serde_json::json!({
                                    "type": "progress",
                                    "value": progress,
                                })).unwrap();
                            },
                            essi_ffmpeg::FFmpegDownloadProgress::Extracting => {
                                w.emit("ffmpeg://download", serde_json::json!({
                                    "type": "extracting",
                                    "value": "",
                                })).unwrap();
                            },
                            essi_ffmpeg::FFmpegDownloadProgress::Finished => {
                                w.emit("ffmpeg://download", serde_json::json!({
                                    "type": "stop",
                                    "value": "",
                                })).unwrap();
                            },
                            _ => { }
                        }
                    }
                });

                handle.await.unwrap().expect("Failed downloading FFmpeg");
            });

            let transcriber_arc = transcriber.clone();
            let screen_buffer_arc = screen_buffer.clone();
            let w = window.clone();
            thread::spawn(move || {
                let mut recording_cluster = vec![];
                let mut recording_duration = Instant::now();
        
                loop {
                    let Some(command) = record_rx.blocking_recv() else { continue };
        
                    match command {
                        RecordCommand::Start { device_type, device } => {
                            let config = match device_type {
                                DeviceType::Microphone => device.default_input_config().unwrap(),
                                DeviceType::Speaker => device.default_output_config().unwrap(),
                            };
        
                            let spec = wav_spec_from_config(&config);
        
                            let buffer = Arc::new(Mutex::new(Cursor::new(Vec::new())));
        
                            let writer = hound::WavWriter::new(WriterHandle(buffer.clone()), spec).unwrap();
                            let wav_writer = Arc::new(Mutex::new(Some(writer)));
        
                            let writer = wav_writer.clone();
                            let stream = match config.sample_format() {
                                cpal::SampleFormat::I8 => device.build_input_stream(
                                    &config.into(),
                                    move |input, _: &_| {
                                        write_input_data::<i8, i8>(input, &writer);
                                    }, |err| panic!("{err:?}"), None),
                                cpal::SampleFormat::I16 => device.build_input_stream(
                                    &config.into(),
                                    move |input, _: &_| {
                                        write_input_data::<i16, i16>(input, &writer);
                                    }, |err| panic!("{err:?}"), None),
                                cpal::SampleFormat::I32 => device.build_input_stream(
                                    &config.into(),
                                    move |input, _: &_| {
                                        write_input_data::<i32, i32>(input, &writer);
                                    }, |err| panic!("{err:?}"), None),
                                cpal::SampleFormat::F32 => device.build_input_stream(
                                    &config.into(),
                                    move |input, _: &_| {
                                        write_input_data::<f32, f32>(input, &writer);
                                    }, |err| panic!("{err:?}"), None),
                                _ => panic!("Unsupported sample format"),
                            }.unwrap();
        
                            stream.play().expect("Can't play recording stream");
                            recording_duration = Instant::now();
        
                            recording_cluster.push((buffer, wav_writer, stream, spec));
                        },
                        RecordCommand::Pause => {
                            for (_, _, stream, _) in &recording_cluster {
                                stream.pause().expect("Can't pause recording stream");
                            }
                        },
                        RecordCommand::Resume => {
                            for (_, _, stream, _) in &recording_cluster {
                                stream.play().expect("Can't pause recording stream");
                            }
                        },
                        RecordCommand::Stop => {
                            let mut audio_buffers = Vec::new();

                            for (buffer_writer, wav_writer, _, spec) in &mut recording_cluster {
                                wav_writer.lock()
                                    .unwrap()
                                    .take()
                                    .unwrap()
                                    .finalize().expect("Can't finalize the recording");

                                let mut buffer_writer = buffer_writer.lock().unwrap();
        
                                let mut buffer = Vec::new();

                                buffer_writer.rewind().expect("Can't rewind recording buffer");
                                buffer_writer.read_to_end(&mut buffer).expect("Can't read recording buffer result");

                                let secs = WavReader::new(Cursor::new(&buffer)).unwrap().duration() / spec.sample_rate;

                                let duration = if dbg!(secs) == 0 {
                                    Duration::ZERO
                                } else {
                                    Instant::now().duration_since(recording_duration).sub(Duration::from_secs(secs as _))
                                };

                                audio_buffers.push((buffer, dbg!(duration)));
                            }

                            emit_all(&w, "update-state", serde_json::json!({
                                "type": "transcribe-start",
                                "value": "",
                            }));

                            println!("Processing audio");

                            let merged_audio = merge_audio(audio_buffers.iter().map(|(v, d)| (v.as_slice(), *d)).collect::<Vec<(&[u8], Duration)>>().as_slice());
                            let resampled_audio = resample(&merged_audio);

                            let mut count = 0;
                            let screen_buffer = loop {
                                if count >= 300 { break None };
                                
                                std::thread::sleep(Duration::from_secs_f32(1.0 / 60.0));
                                count += 1;

                                let buffer = screen_buffer_arc.lock().unwrap();
                                if buffer.len() == 0 { continue };
                                
                                break Some(buffer);
                            };

                            match screen_buffer {
                                Some(mut screen_buffer) => {

                                    let video_buffer = merge_av(&[(&merged_audio, Duration::ZERO, "wav"), (&screen_buffer, Duration::ZERO, "webm")]);
                                    screen_buffer.clear();

                                    dialog::FileDialogBuilder::new()
                                        .set_title("Save Video")
                                        .add_filter("Output", &["mp4"])
                                        .save_file(move |path| {
                                            let Some(path) = path else { return };

                                            std::fs::write(path, video_buffer).expect("Failed writing buffer");
                                        });
                                },
                                None => {
                                    dialog::FileDialogBuilder::new()
                                        .set_title("Save Audio")
                                        .add_filter("Output", &["wav"])
                                        .save_file(move |path| {
                                            let Some(path) = path else { return };

                                            std::fs::write(path, merged_audio).expect("Failed writing buffer");
                                        });
                                },
                            }

                            transcriber_arc.lock().unwrap().transcribe(&window, &resampled_audio);
        
                            recording_cluster.clear();
                        },
                    }
                }
            });

            Ok(())
        }).run(tauri::generate_context!())
        .expect("error while running tauri application");
}
