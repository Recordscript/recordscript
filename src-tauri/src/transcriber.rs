use std::{path::PathBuf, sync::{Arc, Mutex}};

use byte_slice_cast::AsSliceOf;
use directories::ProjectDirs;
use gst::glib::uuid_string_random;
use lettre::Transport;
use strum_macros::EnumIter;
use tauri::{api::dialog, Window};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::util::{self, gstreamer_loop};

pub trait ModelDirectory {
    fn transcriber_model_dir(&self) -> PathBuf;
}

impl ModelDirectory for ProjectDirs {
    fn transcriber_model_dir(&self) -> PathBuf {
        let dir = self.cache_dir().join("model");
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }
}

#[derive(Debug, EnumIter)]
pub enum ModelType {
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
impl ModelType {
    pub fn get_name(&self) -> &'static str {
        match self {
            ModelType::TinyWhisper => "Tiny (Whisper)",
            ModelType::TinyEnWhisper => "Tiny English (Whisper)",
            ModelType::TinyQuantized => "Tiny (Quantized)",
            ModelType::TinyEnQuantized => "Tiny English (Quantized)",
            ModelType::BaseWhisper => "Base (Whisper)",
            ModelType::BaseEnWhisper => "Base English (Whisper)",
            ModelType::BaseQuantized => "Base (Quantized)",
            ModelType::BaseEnQuantized => "Base English (Quantized)",
            ModelType::SmallWhisper => "Small (Whisper)",
            ModelType::SmallEnWhisper => "Small English (Whisper)",
            ModelType::SmallQuantized => "Small (Quantized)",
            ModelType::SmallEnQuantized => "Small English (Quantized)",
            ModelType::MediumQuantized => "Medium (Quantized)",
            ModelType::MediumEnQuantized => "Medium English (Quantized)",
            ModelType::LargeQuantized => "Large (Quantized)",
        }
    }

    /// Use [`TranscriberModelType::get_model_file_name`] as the file name when saving to file system
    pub fn get_model_url(&self) -> &'static str {
        match self {
            ModelType::TinyWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin?download=true",
            ModelType::TinyEnWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin?download=true",
            ModelType::TinyQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin?download=true",
            ModelType::TinyEnQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin?download=true",
            ModelType::BaseWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true",
            ModelType::BaseEnWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin?download=true",
            ModelType::BaseQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin?download=true",
            ModelType::BaseEnQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin?download=true",
            ModelType::SmallWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin?download=true",
            ModelType::SmallEnWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin?download=true",
            ModelType::SmallQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin?download=true",
            ModelType::SmallEnQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin?download=true",
            ModelType::MediumQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin?download=true",
            ModelType::MediumEnQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en-q5_0.bin?download=true",
            ModelType::LargeQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-q5_0.bin?download=true",
        }
    }

    /// Use this file name when saving to file system
    pub fn get_model_file_name(&self) -> &'static str {
        match self {
            ModelType::TinyWhisper => "tiny.bin",
            ModelType::TinyEnWhisper => "tiny-en.bin",
            ModelType::TinyQuantized => "tiny-q.bin",
            ModelType::TinyEnQuantized => "tiny-en-q.bin",
            ModelType::BaseWhisper => "base.bin",
            ModelType::BaseEnWhisper => "base-en.bin",
            ModelType::BaseQuantized => "base-q.bin",
            ModelType::BaseEnQuantized => "base-en-q.bin",
            ModelType::SmallWhisper => "small.bin",
            ModelType::SmallEnWhisper => "small-en.bin",
            ModelType::SmallQuantized => "small-q.bin",
            ModelType::SmallEnQuantized => "small-en-q.bin",
            ModelType::MediumQuantized => "medium-q.bin",
            ModelType::MediumEnQuantized => "medium-en.bin",
            ModelType::LargeQuantized => "large-q.bin",
        }
    }

    /// Average memory usage of models in MB
    ///
    /// Refer to this: https://huggingface.co/ggerganov/whisper.cpp
    pub fn get_avg_mem_usage(&self) -> usize {
        match self {
            ModelType::TinyWhisper => 390,
            ModelType::TinyEnWhisper => 390,
            ModelType::TinyQuantized => 390,
            ModelType::TinyEnQuantized => 390,
            ModelType::BaseWhisper => 500,
            ModelType::BaseEnWhisper => 500,
            ModelType::BaseQuantized => 500,
            ModelType::BaseEnQuantized => 500,
            ModelType::SmallWhisper => 1000,
            ModelType::SmallEnWhisper => 1000,
            ModelType::SmallQuantized => 1000,
            ModelType::SmallEnQuantized => 1000,
            ModelType::MediumQuantized => 2600,
            ModelType::MediumEnQuantized => 2600,
            ModelType::LargeQuantized => 4700,
        }
    }

    /// Disk usage of models in MB
    ///
    /// Using the non quantized model size, even if we use the quantized model, just in case
    ///
    /// Refer to this: https://huggingface.co/ggerganov/whisper.cpp
    pub fn get_disk_usage(&self) -> usize {
        match self {
            ModelType::TinyWhisper => 75,
            ModelType::TinyEnWhisper => 75,
            ModelType::TinyQuantized => 75,
            ModelType::TinyEnQuantized => 75,
            ModelType::BaseWhisper => 142,
            ModelType::BaseEnWhisper => 142,
            ModelType::BaseQuantized => 142,
            ModelType::BaseEnQuantized => 142,
            ModelType::SmallWhisper => 466,
            ModelType::SmallEnWhisper => 466,
            ModelType::SmallQuantized => 466,
            ModelType::SmallEnQuantized => 466,
            ModelType::MediumQuantized => 1500,
            ModelType::MediumEnQuantized => 1500,
            ModelType::LargeQuantized => 2900,
        }
    }

    pub fn model_path(&self) -> PathBuf {
        crate::project_directory().transcriber_model_dir().join(self.get_model_file_name())
    }

    pub fn is_downloaded(&self) -> bool {
        let model_file_path = self.model_path();
        
        model_file_path.exists()
    }
}

/// Decode any media for whisper
fn decode_audio(media_data: Arc<[u8]>) -> anyhow::Result<Vec<f32>> {
    use gst::prelude::*;

    let pipeline = 
        gst::parse::launch("appsrc name=audio-in ! decodebin ! audioconvert ! audio/x-raw,format=F32LE,channels=1 ! audioresample ! audio/x-raw,rate=16000 ! appsink name=pcm-out")?
            .dynamic_cast::<gst::Pipeline>().unwrap();

    pipeline.by_name("audio-in").unwrap().dynamic_cast::<gst_app::AppSrc>().unwrap()
        .set_callbacks(gst_app::AppSrcCallbacks::builder()
            .need_data(move |source, _| {
                let buffer = gst::Buffer::from_slice(media_data.clone());
                let _ = source.push_buffer(buffer);
                source.end_of_stream().unwrap();
            })
            .build());

    let pcm_data = Arc::new(Mutex::new(Vec::new()));

    pipeline.by_name("pcm-out").unwrap().dynamic_cast::<gst_app::AppSink>().unwrap()
        .set_callbacks(gst_app::AppSinkCallbacks::builder()
            .new_sample({
                let pcm_data = pcm_data.clone();
                move |sink| {
                    let Ok(sample) = sink.pull_sample() else { return Err(gst::FlowError::Error) };

                    let buffer = sample.buffer().unwrap();
                    let mapped_buffer = buffer.map_readable().unwrap();

                    let samples = mapped_buffer.as_slice_of::<f32>().unwrap();

                    pcm_data.lock().unwrap().extend_from_slice(samples);

                    Ok(gst::FlowSuccess::Ok)
                }
            }) 
            .build());
    
    gstreamer_loop(pipeline, |_| { false })?;

    Ok(Mutex::into_inner(Arc::try_unwrap(pcm_data).unwrap()).unwrap())
}

pub struct Transcriber {
    model: ModelType,
    language: String,
    ctx: Arc<Mutex<Option<WhisperContext>>>,
}

impl Transcriber {
    pub fn new(model: ModelType) -> Self {
        Self {
            model,
            language: "auto".to_owned(),
            ctx: Default::default(),
        }
    }

    pub fn change_model(&mut self, model: ModelType) {
        self.model = model;

        // Take and drop the old context
        let _ = self.ctx.lock().unwrap().take();
    }

    pub fn change_language(&mut self, language: String) {
        self.language = language;
    }

    /// `media_data` accept media in any format
    pub fn transcribe(&self, window: &Window, media_data: Vec<u8>, general_config: super::configuration::GeneralConfig, smtp_config: super::configuration::SMTPConfig, save_to: PathBuf) {
        println!("Using model {:?}", self.model);

        if !self.model.is_downloaded() {
            panic!("Selected model is not downloaded");
        }

        println!("Transcribing audio");

        let transcription_uuid = uuid_string_random().to_string();

        util::emit_all(&window, "app://transcriber_start", transcription_uuid.clone());

        // let mut ctx = self.ctx.lock().unwrap();
        //
        // if let None = *ctx {
        //     let whisper_context = WhisperContext::new_with_params(self.model.model_path().to_str().unwrap(), WhisperContextParameters::default()).unwrap();
        //     *ctx = Some(whisper_context)
        // }

        // drop(ctx);

        let language = self.language.clone();

        let w = window.clone();
        let whisper_context = WhisperContext::new_with_params(self.model.model_path().to_str().unwrap(), WhisperContextParameters::default()).unwrap();
        std::thread::spawn(move || {
            let mut state = whisper_context.create_state().unwrap();

            let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 5 });

            params.set_language(Some(&language));

            // FIXME: TRANSCRIBE-PROGRESS find out why this doesn't work.
            // params.set_progress_callback_safe({
            //     let w = w.clone();
            //
            //     move |progress: i32| {
            //         println!("Transcribing {}%", progress);
            //         util::emit_all(&w, "update-state", serde_json::json!({
            //             "type": "transcribe-progress",
            //             "value": progress,
            //         }));
            //     }
            // });
            //

            state.full(params, &decode_audio(media_data.into()).unwrap()).unwrap();

            let mut fragments = Vec::new();

            for s in 0..state.full_n_segments().unwrap() {
                let text = state.full_get_segment_text(s).unwrap();
                let start = state.full_get_segment_t0(s).unwrap();
                let stop = state.full_get_segment_t1(s).unwrap();

                let fragment = format!(
                    "\n{s}\n{} --> {}\n{}\n",
                    util::format_timestamp(start, true, ","),
                    util::format_timestamp(stop, true, ","),
                    text.trim().replace("-->", "->")
                );

                fragments.push(fragment);
            }

            let transcription = fragments.join("\n");

            std::fs::write(&save_to, &transcription).expect("Failed writing buffer");

            let _ = (|| {
                let email = lettre::Message::builder()
                    .from(smtp_config.from.parse()?)
                    .to(general_config.transcription_email_to.parse()?)
                    .subject(chrono::Local::now().format("Transcription %Y-%m-%d_%H-%M-%S").to_string())
                    .body(transcription)?;

                let Ok(mailer) = smtp_config.auto_smtp_transport() else {
                    util::emit_all(&w, "app://notification", serde_json::json!({
                        "type": "error",
                        "value": "Unable to connect to the SMTP server using TLS, STARTTLS, or plaintext!"
                    }));
                    
                    anyhow::bail!("");
                };

                match mailer.send(&email) {
                    Ok(_) => {
                        println!("Sending email");
                    }
                    Err(e) => {
                        eprintln!("Failed to send email: {e}");
                        util::emit_all(&w, "app://notification", serde_json::json!({
                            "type": "error",
                            "value": format!("Unable email transcription because:\n{e}")
                        }));
                    }
                }

                anyhow::Ok(())
            })();
            
            util::emit_all(&w, transcription_uuid, serde_json::json!({
                "type": "finish",
                "value": save_to
            }));
        });
    }
}
