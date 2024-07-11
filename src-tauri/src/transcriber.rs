use std::{io::{Cursor, Read, Seek, SeekFrom}, path::PathBuf, sync::{Arc, Mutex}};

use anyhow::Context;
use byte_slice_cast::AsSliceOf;
use directories::ProjectDirs;
use gst::glib::uuid_string_random;
use serde::{Deserialize, Serialize};
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

#[derive(Debug, EnumIter, Serialize)]
pub enum Category {
    Recommended,
    Other,
}

impl Category {
    pub fn name(&self) -> &'static str {
        match self {
            Category::Recommended => "==== Recommended Models ====",
            Category::Other => "==== Other Models ====",
        }
    }
}

pub enum Type {
    Whisper,
    Quantized,
}

impl Type {
    pub fn name(&self) -> &'static str {
        match self {
            Type::Whisper => "Whisper",
            Type::Quantized => "Quantized",
        }
    }
}

#[derive(Debug, Serialize, Deserialize, EnumIter)]
pub enum Model {
    SmallDiarize,
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
    MediumWhisper,
    MediumQuantized,
    MediumEnQuantized,
    LargeWhisper,
    LargeQuantized,
}

// https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin?download=true
impl Model {
    pub fn name(&self) -> &'static str {
        match self {
            Model::TinyWhisper => "Tiny",
            Model::TinyEnWhisper => "Tiny English",
            Model::TinyQuantized => "Tiny",
            Model::TinyEnQuantized => "Tiny English",
            Model::BaseWhisper => "Base",
            Model::BaseEnWhisper => "Base English",
            Model::BaseQuantized => "Base",
            Model::BaseEnQuantized => "Base English",
            Model::SmallWhisper => "Small",
            Model::SmallEnWhisper => "Small English",
            Model::SmallQuantized => "Small",
            Model::SmallEnQuantized => "Small English",
            Model::SmallDiarize => "Small Diarize",
            Model::MediumWhisper => "Medium",
            Model::MediumQuantized => "Medium",
            Model::MediumEnQuantized => "Medium English",
            Model::LargeWhisper => "Large",
            Model::LargeQuantized => "Large",
        }
    }

    /// Use [`TranscriberModelType::get_model_file_name`] as the file name when saving to file system
    pub fn download_url(&self) -> &'static str {
        match self {
            Model::TinyWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin?download=true",
            Model::TinyEnWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin?download=true",
            Model::TinyQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin?download=true",
            Model::TinyEnQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin?download=true",
            Model::BaseWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true",
            Model::BaseEnWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin?download=true",
            Model::BaseQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin?download=true",
            Model::BaseEnQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin?download=true",
            Model::SmallWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin?download=true",
            Model::SmallEnWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin?download=true",
            Model::SmallQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin?download=true",
            Model::SmallEnQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin?download=true",
            Model::SmallDiarize => "https://huggingface.co/akashmjn/tinydiarize-whisper.cpp/resolve/main/ggml-small.en-tdrz.bin?download=true",
            Model::MediumWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin?download=true",
            Model::MediumQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin?download=true",
            Model::MediumEnQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en-q5_0.bin?download=true",
            Model::LargeWhisper => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin?download=true",
            Model::LargeQuantized => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-q5_0.bin?download=true",
        }
    }

    /// Use this file name when saving to file system
    pub fn file_name(&self) -> &'static str {
        match self {
            Model::TinyWhisper => "tiny.bin",
            Model::TinyEnWhisper => "tiny-en.bin",
            Model::TinyQuantized => "tiny-q.bin",
            Model::TinyEnQuantized => "tiny-en-q.bin",
            Model::BaseWhisper => "base.bin",
            Model::BaseEnWhisper => "base-en.bin",
            Model::BaseQuantized => "base-q.bin",
            Model::BaseEnQuantized => "base-en-q.bin",
            Model::SmallWhisper => "small.bin",
            Model::SmallEnWhisper => "small-en.bin",
            Model::SmallQuantized => "small-q.bin",
            Model::SmallEnQuantized => "small-en-q.bin",
            Model::SmallDiarize => "small-diar.bin",
            Model::MediumWhisper => "medium.bin",
            Model::MediumQuantized => "medium-q.bin",
            Model::MediumEnQuantized => "medium-en.bin",
            Model::LargeWhisper => "large.bin",
            Model::LargeQuantized => "large-q.bin",
        }
    }

    /// Average memory usage of models in MB
    ///
    /// Refer to this:
    /// - https://huggingface.co/ggerganov/whisper.cpp
    /// - https://huggingface.co/akashmjn/tinydiarize-whisper.cpp 
    pub fn average_memory_usage(&self) -> usize {
        match self {
            Model::TinyWhisper => 390,
            Model::TinyEnWhisper => 390,
            Model::TinyQuantized => 390,
            Model::TinyEnQuantized => 390,
            Model::BaseWhisper => 500,
            Model::BaseEnWhisper => 500,
            Model::BaseQuantized => 500,
            Model::BaseEnQuantized => 500,
            Model::SmallWhisper => 1000,
            Model::SmallEnWhisper => 1000,
            Model::SmallQuantized => 1000,
            Model::SmallEnQuantized => 1000,
            Model::SmallDiarize => 1000,
            Model::MediumWhisper => 2600,
            Model::MediumQuantized => 2600,
            Model::MediumEnQuantized => 2600,
            Model::LargeWhisper => 4700,
            Model::LargeQuantized => 4700,
        }
    }

    /// Check if runtime machine has enough memory to run the model
    pub fn can_run(&self) -> bool {
        use sysinfo::{ System, RefreshKind, MemoryRefreshKind };

        let system_info = System::new_with_specifics(RefreshKind::new().with_memory(MemoryRefreshKind::everything()));
        let available_memory = (system_info.total_memory() + system_info.total_swap()) as usize;

        let model_memory_usage = self.average_memory_usage() * 1000000;

        model_memory_usage < available_memory 
    }

    /// Disk usage of models in MB
    ///
    /// Refer to this:
    /// - https://huggingface.co/ggerganov/whisper.cpp
    /// - https://huggingface.co/akashmjn/tinydiarize-whisper.cpp 
    pub fn disk_usage(&self) -> usize {
        match self {
            Model::TinyWhisper => 77,
            Model::TinyEnWhisper => 77,
            Model::TinyQuantized => 33,
            Model::TinyEnQuantized => 33,
            Model::BaseWhisper => 148,
            Model::BaseEnWhisper => 148,
            Model::BaseQuantized => 60,
            Model::BaseEnQuantized => 60,
            Model::SmallWhisper => 488,
            Model::SmallEnWhisper => 488,
            Model::SmallQuantized => 190,
            Model::SmallEnQuantized => 190,
            Model::SmallDiarize => 488,
            Model::MediumWhisper => 1530,
            Model::MediumQuantized => 539,
            Model::MediumEnQuantized => 539,
            Model::LargeWhisper => 3100,
            Model::LargeQuantized => 1080,
        }
    }

    pub fn path(&self) -> PathBuf {
        crate::project_directory().transcriber_model_dir().join(self.file_name())
    }

    pub fn is_downloaded(&self) -> bool {
        let model_file_path = self.path();
        
        model_file_path.exists()
    }

    pub fn whitelisted_lang(&self) -> Option<Vec<&'static str>> {
        match self {
            Model::TinyEnWhisper => Some(vec!["en"]),
            Model::TinyEnQuantized => Some(vec!["en"]),
            Model::BaseEnWhisper => Some(vec!["en"]),
            Model::BaseEnQuantized => Some(vec!["en"]),
            Model::SmallEnWhisper => Some(vec!["en"]),
            Model::SmallEnQuantized => Some(vec!["en"]),
            Model::SmallDiarize => Some(vec!["en"]),
            Model::MediumEnQuantized => Some(vec!["en"]),
            _ => None
        }
    }

    pub fn category(&self) -> Category {
        match self {
            Model::TinyWhisper => Category::Recommended,
            Model::BaseWhisper => Category::Recommended,
            Model::SmallWhisper => Category::Recommended,
            Model::MediumWhisper => Category::Recommended,
            Model::MediumQuantized => Category::Recommended,
            Model::LargeWhisper => Category::Recommended,
            Model::LargeQuantized => Category::Recommended,
            Model::TinyEnWhisper => Category::Other,
            Model::TinyQuantized => Category::Other,
            Model::TinyEnQuantized => Category::Other,
            Model::BaseEnWhisper => Category::Other,
            Model::BaseQuantized => Category::Other,
            Model::BaseEnQuantized => Category::Other,
            Model::SmallEnWhisper => Category::Other,
            Model::SmallQuantized => Category::Other,
            Model::SmallEnQuantized => Category::Other,
            Model::SmallDiarize => Category::Other,
            Model::MediumEnQuantized => Category::Other,
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            Model::TinyWhisper => "Fastest model but with the lowest quality",
            Model::TinyEnWhisper => "",
            Model::TinyQuantized => "",
            Model::TinyEnQuantized => "",
            Model::BaseWhisper => "Base whisper model",
            Model::BaseEnWhisper => "",
            Model::BaseQuantized => "",
            Model::BaseEnQuantized => "",
            Model::SmallWhisper => "Default model. Select this for most cases",
            Model::SmallEnWhisper => "",
            Model::SmallQuantized => "",
            Model::SmallEnQuantized => "",
            Model::SmallDiarize => "Small model that can recognize speaker's turn, only supports English",
            Model::MediumWhisper => "Better quality than the default small, but might take longer transcribing",
            Model::MediumQuantized => r#""Lite" version of medium whisper"#,
            Model::MediumEnQuantized => "",
            Model::LargeWhisper => "Large v3 model, best quality but with the longest time to transcript",
            Model::LargeQuantized => r#""Lite" version of Large v3 whisper"#,
        }
    }

    pub fn r#type(&self) -> Type {
        match self {
            Model::TinyWhisper => Type::Whisper,
            Model::TinyEnWhisper => Type::Whisper,
            Model::BaseWhisper => Type::Whisper,
            Model::BaseEnWhisper => Type::Whisper,
            Model::MediumWhisper => Type::Whisper,
            Model::SmallWhisper => Type::Whisper,
            Model::SmallEnWhisper => Type::Whisper,
            Model::LargeWhisper => Type::Whisper,
            Model::TinyQuantized => Type::Quantized,
            Model::TinyEnQuantized => Type::Quantized,
            Model::BaseQuantized => Type::Quantized,
            Model::BaseEnQuantized => Type::Quantized,
            Model::SmallQuantized => Type::Quantized,
            Model::SmallEnQuantized => Type::Quantized,
            Model::SmallDiarize => Type::Quantized,
            Model::MediumQuantized => Type::Quantized,
            Model::MediumEnQuantized => Type::Quantized,
            Model::LargeQuantized => Type::Quantized,
        }
    }
}

/// Decode any media for whisper
fn decode_audio(media_data: Arc<[u8]>) -> anyhow::Result<Vec<f32>> {
    use gst::prelude::*;

    let media_data_len = media_data.len();
    let media_data = Arc::new(Mutex::new(Cursor::new(media_data)));

    let pipeline = 
        gst::parse::launch(&format!("appsrc name=audio-in stream-type=2 size={media_data_len} ! decodebin ! audioconvert ! audio/x-raw,format=F32LE,channels=1 ! audioresample ! audio/x-raw,rate=16000 ! appsink name=pcm-out sync=false"))?
            .dynamic_cast::<gst::Pipeline>().unwrap();

    pipeline.by_name("audio-in").unwrap().dynamic_cast::<gst_app::AppSrc>().unwrap()
        .set_callbacks(gst_app::AppSrcCallbacks::builder()
            .need_data({
                let media_data = media_data.clone();

                move |source, length| {
                    let mut buffer = vec![0u8; length as _];
                    let position = media_data.lock().unwrap().position();
                    let _ = media_data.lock().unwrap().read(&mut buffer).unwrap();

                    if position as usize >= media_data_len {
                        println!("Ending stream");
                        source.end_of_stream().unwrap();
                        return;
                    }

                    let buffer = gst::Buffer::from_slice(buffer);
                    let _ = source.push_buffer(buffer);
                }
            })
            .seek_data({
                let media_data = media_data.clone();

                move |_, location| {
                    media_data.lock().unwrap().set_position(location);

                    true
                }
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
    model: Model,
    language: String,
    ctx: Arc<Mutex<Option<WhisperContext>>>,
}

impl Transcriber {
    pub fn new(model: Model) -> Self {
        Self {
            model,
            language: "auto".to_owned(),
            ctx: Default::default(),
        }
    }

    pub fn change_model(&mut self, model: Model) {
        self.model = model;

        // Take and drop the old context
        let _ = self.ctx.lock().unwrap().take();
    }

    pub fn change_language(&mut self, language: String) {
        self.language = language;
    }

    /// `media_data` accept media in any format
    pub fn transcribe(&self, window: &Window, media_data: Vec<u8>, general_config: super::configuration::GeneralConfig, smtp_config: super::configuration::SMTPConfig, save_to: PathBuf, email: bool) {
        println!("Using model {:?}", self.model);

        if !self.model.is_downloaded() {
            panic!("Selected model is not downloaded");
        }

        println!("Transcribing audio");

        let transcription_uuid = uuid_string_random().to_string();

        util::emit_all(window, "app://transcriber_start", transcription_uuid.clone());

        // let mut ctx = self.ctx.lock().unwrap();
        //
        // if let None = *ctx {
        //     let whisper_context = WhisperContext::new_with_params(self.model.model_path().to_str().unwrap(), WhisperContextParameters::default()).unwrap();
        //     *ctx = Some(whisper_context)
        // }

        // drop(ctx);

        let language = self.language.clone();

        let w = window.clone();
        let whisper_context = WhisperContext::new_with_params(self.model.path().to_str().unwrap(), WhisperContextParameters::default()).unwrap();
        std::thread::spawn(move || {
            let mut state = whisper_context.create_state().unwrap();

            let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 5 });

            params.set_language(Some(&language));
            params.set_translate(general_config.translate);
            params.set_tdrz_enable(true);

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
            
            let transcription = (|| {
                state.full(params, &decode_audio(media_data.into())?)?;

                let mut fragments = Vec::new();

                for s in 0..state.full_n_segments()? {
                    let speaker_turn = state.full_get_segment_speaker_turn_next(s);

                    let mut text = state.full_get_segment_text(s)?;
                    let start = state.full_get_segment_t0(s)?;
                    let stop = state.full_get_segment_t1(s)?;

                    if speaker_turn {
                        text.push_str(" [SPEAKER TURN]");
                    }

                    let fragment = format!(
                        "\n{s}\n{} --> {}\n{}\n",
                        util::format_timestamp(start, true, ","),
                        util::format_timestamp(stop, true, ","),
                        text.trim().replace("-->", "->")
                    );

                    fragments.push(fragment);
                }

                let transcription = fragments.join("\n");

                std::fs::write(&save_to, &transcription).context("Failed writing transcription file")?;

                anyhow::Ok(transcription)
            })();

            let transcription = match transcription {
                Ok(transcription) => transcription,
                Err(err) => {
                    util::emit_all(&w, "app://notification", serde_json::json!({
                        "type": "error",
                        "value": format!("Failed transcribing because: {err}, please report this issue!")
                    }));

                    util::emit_all(&w, transcription_uuid, serde_json::json!({
                        "type": "finish_failed",
                        "value": ""
                    }));

                    return;
                },
            };

            let _ = (|| {
                if !email { return Ok(()) };

                use lettre::Transport as _;
                use lettre::message::{ header, Attachment, SinglePart, MultiPart };

                let now = chrono::Local::now();
                let readable_now = now.format("%A %B %d %Y");

                let message = format!(r#"
Hi,

Here's attached the transcript for the meeting at {readable_now}.

Have a good day!
                "#).trim().to_owned();

                let attachment = Attachment::new(now.format("transcription_%Y-%m-%d.srt").to_string())
                    .body(transcription, header::ContentType::TEXT_PLAIN);

                let mut emails = general_config.transcription_email_to.split(',');

                let email = {
                    let mut email = lettre::Message::builder()
                        .from(smtp_config.from.parse()?)
                        .to(emails.next().context("No emails were provided")?.trim().parse().context("Provided emails were invalid")?);

                    for mail in emails {
                        let mail = mail.trim();
                        email = email.cc(mail.parse().context(format!("Email '{mail}' is invalid"))?);
                    }

                    anyhow::Ok(email)
                };

                let email = match email {
                    Ok(email) => email,
                    Err(err) => {
                        util::emit_all(&w, "app://notification", serde_json::json!({
                            "type": "error",
                            "value": err.to_string()
                        }));

                        anyhow::bail!("");
                    },
                };

                let email = email.subject(format!("Meeting Transcript at {readable_now}"))
                    .multipart(
                        MultiPart::alternative()
                            .singlepart(
                                SinglePart::builder()
                                .header(header::ContentType::TEXT_PLAIN)
                                .body(message)
                            )
                            .singlepart(attachment)
                    )?;

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
                            "value": format!("Failed to send transcription via email because:\n{e}")
                        }));
                    }
                }

                util::emit_all(&w, "app://notification", serde_json::json!({
                    "type": "info",
                    "value": "Transcription email is sent!"
                }));

                anyhow::Ok(())
            })();
            
            util::emit_all(&w, transcription_uuid, serde_json::json!({
                "type": "finish",
                "value": save_to
            }));
        });
    }
}
