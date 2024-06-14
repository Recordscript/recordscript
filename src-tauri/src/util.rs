use std::ops::Div as _;

use tauri::Window;

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

pub fn emit_all<S: std::fmt::Debug + serde::Serialize + Clone + Send + 'static>(
    window: &Window,
    channel: impl AsRef<str>,
    payload: S,
) {
    println!("Emitting {payload:?}");

    let channel = channel.as_ref().to_owned();

    window.emit(channel.as_str(), payload).unwrap();
}

pub fn gstreamer_loop(
    pipeline: gst::Pipeline,
    on_message: impl Fn(&gst::Message) -> bool,
) -> anyhow::Result<()> {
    use gst::prelude::*;

    pipeline.set_state(gst::State::Playing)?;

    let bus = pipeline.bus().unwrap();

    for message in bus.iter_timed(gst::ClockTime::NONE) {
        match message.view() {
            gst::MessageView::Eos(_) => break,
            gst::MessageView::Error(err) => anyhow::bail!(format!("{:?}", err)),
            _ => {}
        }

        let should_break = on_message(&message);
        if should_break {
            break;
        };
    }

    pipeline.set_state(gst::State::Null)?;

    Ok(())
}

pub fn replace_multiple_whitespace(input: &str) -> String {
    let mut result = String::new();
    let mut last_was_whitespace = false;

    for c in input.chars() {
        if c.is_whitespace() {
            if !last_was_whitespace {
                result.push(' ');
                last_was_whitespace = true;
            }
        } else {
            result.push(c);
            last_was_whitespace = false;
        }
    }

    result
}
