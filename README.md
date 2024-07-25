# Recordscript

Generate subtitle either from built-in screen recorder or from your video/audio files.
Built with whisper-rs (Rust binding to whisper.cpp), Tauri, Rust.

# Features

1. Screen Recorder with Subtitle capability
2. Subtitle Generator from a Video/Audio file with English Translation support
3. Works fully offline (thanks to Whisper.cpp!)
4. Cross-platform (thanks to Tauri!)

# Download

Microsoft Store: (link to be added)

You can also take a look at our Release page.
For now, there's no Mac build yet since there are still some issues.

# Build step

If you want to build the app on your local machine, take a look at `BUILDING.md`

# Known Issues

## Mac

On Macbook Pro M1, the screen recording's not working properly - does not save the file after stopping the recording. After some digging, it seems it was caused by the audio pipeline of GStreamer getting stuck somehow.

You can help contribute on resolving this issue by pulling the branch `mac` first and submitting a PR to this repo.

# Contribution

We welcome everyone who would like to contribute to this project.

# License

We use GNU GPLv3.0 license. Take a look at `COPYING`