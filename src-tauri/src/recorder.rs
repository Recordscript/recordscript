use anyhow::Result;
use cpal::{traits::{DeviceTrait, HostTrait}, Device, Host};
use scrap::Display;
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

