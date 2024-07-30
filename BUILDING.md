For more details see [GitHub workflow](.github/workflows/publish.yml)

# Windows
## Prerequisites
- Install [Rust](https://rustup.rs/)
- Install [vcpkg](https://learn.microsoft.com/en-us/vcpkg/get_started/get-started) . Make sure you've set VCPKG_ROOT and add the PATH
- Install both [GStreamer 1.24.5 runtime and development](https://gstreamer.freedesktop.org/download/#windows) and add it to PATH.
Make sure you've added [GStreamer bin directory and lib/gstreamer-1.0 and lib/pkgconfig to PATH](https://gstreamer.freedesktop.org/documentation/installing/on-windows.html?gi-language=c)
- Install [NodeJS](https://nodejs.org/en/download/package-manager) with [NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)

## Building
1. Go to vcpkg directory and install `libvpx`, `libyuv`, `opus`, and `aom` with triplet `x64-windows-static`
```
./vcpkg install libvpx:x64-windows-static libyuv:x64-windows-static opus:x64-windows-static aom:x64-windows-static
```
2. Go back to this repository directory and install the NPM dependencies
```
npm install
```
3. Then build the app with Tauri
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
1. Install dependencies (install equivalent package in your distro)
```
sudo apt install libasound2-dev libudev-dev nasm libxcb-randr0-dev
```
2. Go to vcpkg directory and install `libvpx`, `libyuv`, `opus`, and `aom`
```
./vcpkg install libvpx libyuv opus aom
```
3. Go to the repo directory and install the NPM dependencies
```
npm install
```
4. Then build the app with Tauri
```
npm run tauri build
```

# Mac

## Notes
- For mac, you need to pull `mac` branch. The current `main` branch don't support mac build
- There are still issues with the screen recorder. But, the subtitle generator (from audio/video file) works just fine

## Prerequisites
- Install [Rust](https://rustup.rs/)
- Install [GStreamer 1.24.5](https://gstreamer.freedesktop.org/download/#linux) both runtime and development
- Install [NodeJS](https://nodejs.org/en/download/package-manager) with [NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- Install vcpkg and some libraries
```
git clone https://github.com/microsoft/vcpkg
cd vcpkg
git checkout 2023.04.15
./bootstrap-vcpkg.sh -disableMetrics
./vcpkg install libvpx libyuv opus aom
export VCPKG_ROOT=~/repos/vcpkg
```
change the /repos/vcpkg to your vcpkg repo directory

## Building
1. Go to the repo directory and install the NPM dependencies
```
npm install
```
2. Then build the app with Tauri
```
npm run tauri build
```