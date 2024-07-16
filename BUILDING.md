For more details see [GitHub workflow](.github/workflows/publish.yml)

# Windows
## Prerequisites
- Install [Rust](https://rustup.rs/)
- Install [vcpkg](https://learn.microsoft.com/en-us/vcpkg/get_started/overview)
- Install [GStreamer 1.24.5](https://gstreamer.freedesktop.org/download/#windows) both runtime and development
- Install [NodeJS](https://nodejs.org/en/download/package-manager) with [NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)

## Building
- Go to vcpkg directory and install `libvpx`, `libyuv`, `opus`, and `aom` with triplet `x64-windows-static`
```
./vcpkg install libvpx:x64-windows-static libyuv:x64-windows-static opus:x64-windows-static aom:x64-windows-static
```
- Go to the repo directory and install the NPM dependencies
```
npm install
```
- Then build the app with Tauri
```
npm run tauri build
```

# Linux
## Prerequisites
- Install [Rust](https://rustup.rs/)
- Install [vcpkg](https://learn.microsoft.com/en-us/vcpkg/get_started/overview)
- Install [GStreamer 1.24.5](https://gstreamer.freedesktop.org/download/#linux) both runtime and development
- Install [NodeJS](https://nodejs.org/en/download/package-manager) with [NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)

## Building
- Install dependencies (install equivalent package in your distro)
```
sudo apt install libasound2-dev libudev-dev nasm libxcb-randr0-dev
```
- Go to vcpkg directory and install `libvpx`, `libyuv`, `opus`, and `aom`
```
./vcpkg install libvpx libyuv opus aom
```
- Go to the repo directory and install the NPM dependencies
```
npm install
```
- Then build the app with Tauri
```
npm run tauri build
```

