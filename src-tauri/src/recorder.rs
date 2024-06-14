use std::collections::HashMap;

use cpal::{traits::DeviceTrait, Device};
use strum_macros::{EnumIter, IntoStaticStr};

#[derive(Debug, Clone, Copy, Eq, Hash, PartialEq, EnumIter, IntoStaticStr)]
pub enum DeviceType {
    Microphone,
    Speaker,
}

pub struct SelectedDevices<D: DeviceTrait + Send + Sync>(pub HashMap<DeviceType, D>);

pub trait DeviceEq {
    fn eq_device(&self, device: &Device) -> bool;
}

impl DeviceEq for Device {
    fn eq_device(&self, device: &Device) -> bool {
        let a = self.name().unwrap_or_default();
        let b = device.name().unwrap_or_default();

        a.eq(&b)
    }
}

pub enum RecordCommand {
    Start {
        devices: Vec<(DeviceType, Device)>,
        record_screen: bool,
    },
    Pause,
    Resume,
    Stop
}

pub type RecordChannel = tauri::async_runtime::Sender<RecordCommand>;

#[derive(serde::Serialize)]
pub struct DeviceResult {
    pub name: String,
    pub is_selected: bool,
}
