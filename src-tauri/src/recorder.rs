use std::{sync::{atomic::{self, AtomicPtr}, Arc, Mutex}, time::Duration};

use anyhow::Result;
use cpal::{traits::{DeviceTrait, HostTrait}, Device, Host};
use scrap::{Display, TraitCapturer, TraitPixelBuffer};
use strum_macros::{EnumIter, IntoStaticStr};

#[derive(Debug, Clone, Copy, Eq, Hash, PartialEq, EnumIter, IntoStaticStr)]
pub enum DeviceType {
    Microphone,
    Speaker,
}

pub struct SelectedDevice {
    pub microphone: Option<Device>,
    pub speaker: Option<Device>,
    pub screen: Display,
}

unsafe impl Send for SelectedDevice { }

impl Clone for SelectedDevice {
    fn clone(&self) -> Self {
        Self {
            microphone: self.microphone.clone(),
            speaker: self.speaker.clone(),
            screen: self.screen.clone_device(),
        }
    }
}

pub trait DeviceEq {
    fn eq_device(&self, device: &Self) -> bool;
}

impl DeviceEq for Device {
    fn eq_device(&self, device: &Device) -> bool {
        let a = self.name().unwrap_or_default();
        let b = device.name().unwrap_or_default();

        a.eq(&b)
    }
}

impl DeviceEq for Display {
    fn eq_device(&self, device: &Display) -> bool {
        let a = self.name();
        let b = device.name();

        a.eq(&b)
    }
}

pub trait DeviceClone {
    fn clone_device(&self) -> Self;
}

impl DeviceClone for Display {
    fn clone_device(&self) -> Self {
        list_screen().unwrap().into_iter()
            .filter(|d| d.eq_device(self))
            .nth(0).unwrap()
    }
}

pub enum RecordCommand {
    Start(SelectedDevice),
    Pause,
    Resume,
    Stop
}

#[derive(serde::Serialize)]
pub struct DeviceResult {
    pub name: String,
    pub is_selected: bool,
}

fn all_hosts() -> Vec<Host> {
    cpal::ALL_HOSTS.into_iter()
        .map(|host_id| cpal::host_from_id(*host_id))
        .filter_map(|host| host.ok())
        .collect()
}

pub fn list_microphone() -> Vec<Device> {
    all_hosts().into_iter()
        .map(|host| host.input_devices())
        .filter_map(|devices| devices.ok())
        .flat_map(|devices| devices.collect::<Vec<Device>>())
        .collect()
}

pub fn list_speaker() -> Vec<Device> {
    all_hosts().into_iter()
        .map(|host| host.output_devices())
        .filter_map(|devices| devices.ok())
        .flat_map(|devices| devices.collect::<Vec<Device>>())
        .collect()
}

pub fn list_screen() -> anyhow::Result<Vec<Display>> {
    Ok(scrap::Display::all()?)
}

pub struct Screen {
    name: String,
    display: Display,
}

impl Screen {
    pub fn name(&self) -> &String {
        &self.name
    }

    /// Return PNG encoded screen preview
    pub fn preview(&self) -> anyhow::Result<Vec<u8>> {
        use gst::prelude::*;
        use scrap::Capturer;

        let mut capturer = Capturer::new(self.display.clone_device()).unwrap();

        let width;
        let height;
        let data;
        
        loop {
            let frame = match capturer.frame(Duration::ZERO) {
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

            width = pixel_buffer.width();
            height = pixel_buffer.height();
            data = pixel_buffer.data().to_vec();

            break;
        };

        let pipeline =
            gst::parse::launch("appsrc name=input ! videoconvert ! pngenc ! appsink name=output").unwrap()
                .dynamic_cast::<gst::Pipeline>().unwrap();

        pipeline.by_name("input").unwrap().dynamic_cast::<gst_app::AppSrc>().unwrap()
            .set_callbacks(gst_app::AppSrcCallbacks::builder()
                .need_data(move |source, _| {
                    let caps = gst::Caps::builder("video/x-raw")
                        .field("format", "BGRx")
                        .field("width", width as i32)
                        .field("height", height as i32)
                        .build();

                    source.set_caps(Some(&caps));

                    let buffer = gst::Buffer::from_slice(data.clone());

                    let _ = source.push_buffer(buffer);

                    source.end_of_stream().unwrap();
                }).build());

        let preview = Arc::new(Mutex::new(None));

        pipeline.by_name("output").unwrap().dynamic_cast::<gst_app::AppSink>().unwrap()
            .set_callbacks(gst_app::AppSinkCallbacks::builder()
                .new_sample({
                    let preview = preview.clone();

                    move |sink| {
                        let Ok(sample) = sink.pull_sample() else { return Err(gst::FlowError::Error) };

                        let buffer = sample.buffer().unwrap();
                        let mapped_buffer = buffer.map_readable().unwrap();

                        let encoded_preview = mapped_buffer.as_slice();

                        *preview.lock().unwrap() = Some(encoded_preview.to_vec());

                        Ok(gst::FlowSuccess::Ok)
                    }
                }).build());

        crate::util::gstreamer_loop(pipeline, |_| { false })?;

        let preview = preview.lock().unwrap();

        Ok(preview.clone().unwrap())
    }

    pub fn all() -> anyhow::Result<Vec<Self>> {
        Ok(list_screen()?.into_iter()
            .map(|d| Self { name: d.name(), display: d }).collect())
    }
}

