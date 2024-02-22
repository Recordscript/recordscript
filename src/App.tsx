import { For, Match, Show, Switch, createEffect, createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/tauri";
import { message } from "@tauri-apps/api/dialog";
import { appWindow } from "@tauri-apps/api/window";
import { readBinaryFile } from "@tauri-apps/api/fs";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from '@ffmpeg/util';

enum RecordingState {
  Recording,
  Paused,
  Stopped,
}

enum DownloadState {
  Downloading,
  Stopped,
  Error,
}

enum TranscribeState {
  Transcribing,
  Stopped,
}

// enum AppState {
//   Nothing,
//   Recording,
//   RecordPaused,
//   Downloading,
//   Transcribing
// }

interface Model {
  name: string;
  disk_usage: number;
  mem_usage: number;
  is_downloaded: boolean;
}

interface EventResult {
  type: string;
  value: any;
}

function App() {
  // const [appState, setAppState] = createSignal<AppState>(AppState.Nothing);
  
  const [inputDevices, setInputDevices] = createSignal<string[] | null>(null);
  const [outputDevices, setOutputDevices] = createSignal<string[] | null>(null);
  const [webcamDevices, setWebcamDevices] = createSignal<MediaDeviceInfo[] | null>(null);

  const [selectedWebcamDevice, selectWebcamDevice] = createSignal<MediaDeviceInfo | null>(null);

  const [recording, setRecording] = createSignal<RecordingState | null>(RecordingState.Stopped);

  const [screenStream, setScreenStream] = createSignal<MediaStream | null>(null);
  const [webcamStream, setWebcamStream] = createSignal<MediaStream | null>(null);

  const [screenRecorder, setScreenRecorder] = createSignal<MediaRecorder | null>(null);
  const [webcamRecorder, setWebcamRecorder] = createSignal<MediaRecorder | null>(null);

  const [models, setModels] = createSignal<Model[] | null>(null);
  const [selectedModel, selectModel] = createSignal<Model | null>(null);

  const [modelDownloadState, setModelDownloadState] = createSignal<DownloadState>(DownloadState.Stopped);
  const [modelDownloadProgress, setModelDownloadProgress] = createSignal<number>(0);
  
  const [systemLog, setSystemLog] = createSignal<string>("");

  const [transcribeState, setTranscribeState] = createSignal<TranscribeState>(TranscribeState.Stopped);
  // const [transcribeProgress, setTranscribeProgress] = createSignal<number>(0);

  let ffmpeg = new FFmpeg();

  async function loadFFmpeg() {
    console.log("Loading FFmpeg");
    await ffmpeg.load({
      coreURL: await toBlobURL(`/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`/ffmpeg-core.wasm`, "application/wasm"),
      workerURL: await toBlobURL(`/ffmpeg-core.worker.js`, "text/javascript"),
    });
    console.log("FFmpeg loaded");
  }
  loadFFmpeg();

  interface MergeAudioPath {
    path: string;
    format: string;
  }

  const [audioPaths, setAudioPaths] = createSignal<MergeAudioPath[]>([]);

  appWindow.listen("ffmpeg://audio-merger-push", async (event) => {
    const audioFiles = event.payload as MergeAudioPath;

    setAudioPaths((v) => [...v, audioFiles]);
  });

  createEffect(() => {
    const audioFiles = audioPaths();

    if (audioFiles.length < 2) return;
    
    setTranscribeState(TranscribeState.Transcribing);

    (async() => {
      let fileArgs = [];

      for (let index = 0; index < audioFiles.length; index++) {
        const audioFile = audioFiles[index];
       
        const buffer = await readBinaryFile(audioFile.path);

        const fileName = `${index}.${audioFile.format}`;
        
        try { await ffmpeg.deleteFile(fileName) } catch {};
        await ffmpeg.writeFile(fileName, buffer);
  
        fileArgs.push("-i");
        fileArgs.push(fileName);
      }
  
      // https://stackoverflow.com/a/14528482
      // Downmix & Downsample
      await ffmpeg.exec([...fileArgs, "-filter_complex", `amix=inputs=${audioFiles.length}:duration=longest`, "-ar", "16000", "-ac", "1", "output.wav"]);
  
      const buffer = Array.from(await ffmpeg.readFile("output.wav") as Uint8Array);

      await invoke("transcribe", { buffer });
    })();
  })

  async function loadModels() {
    setModels(null);

    const models = await invoke("load_model_list") as Model[];
    selectModel(models[0]);

    setModels(models);
  }
  loadModels();

  createEffect(() => {
    const modelIndex = models()?.indexOf(selectedModel()!);
    if (!modelIndex) return;

    (async() => {
      await invoke("switch_model", { modelIndex });
    })();
  });

  appWindow.listen<EventResult>("update-state", (event) => {
    let type = event.payload.type;

    switch (type) {
      case "transcribe-start": {
        setTranscribeState(TranscribeState.Transcribing);
      } break;
      // FIXME: look at "FIXME: TRANSCRIBE-PROGRESS" at src-tauri
      // case "transcribe-progress": {
      //   let progress = parseInt(event.payload.value);

      //   setTranscribeProgress(progress);
      // } break;
      case "transcribe-stop": {
        setTranscribeState(TranscribeState.Stopped);
      } break;
    }
  });

  async function downloadModel() {
    const model = selectedModel();
    if (model === null) return;

    const channel_name = await invoke("download_model", { modelIndex: models()?.indexOf(model) }) as string;

    console.log({ channel_name });

    setModelDownloadState(DownloadState.Downloading);

    appWindow.listen<EventResult>(channel_name, (event) => {
      let type = event.payload.type;

      switch (type) {
        case "error": {
          setModelDownloadState(DownloadState.Error);
          setSystemLog((log) => log + "\n" + event.payload.value);
        } break;
        case "progress": {
          let progress = parseInt(event.payload.value);
      
          setModelDownloadProgress(progress);
        } break;
        case "done": {
          setModelDownloadState(DownloadState.Stopped);
          loadModels();
        } break;
      }
    })
  }

  async function loadInputDevices() {
    setInputDevices(null);

    const devices = await invoke("list_input_devices") as string[];

    setInputDevices(devices);
  }

  async function loadOutputDevices() {
    setOutputDevices(null);

    const devices = await invoke("list_output_devices") as string[];

    setOutputDevices(devices);
  }

  async function listWebcamDevices() {
    setWebcamDevices(null);

    const devices = await navigator.mediaDevices.enumerateDevices();

    setWebcamDevices(devices.filter((v) => v.kind === "videoinput"));
  }

  function reloadDevices() {
    loadInputDevices();
    loadOutputDevices();
    listWebcamDevices();
  }
  reloadDevices();

  async function startRecording() {
    setRecording(null);

    await startScreenRecorder();
    
    await invoke("start_audio_recording");

    setRecording(RecordingState.Recording);
  }

  async function pauseRecording() {
    setRecording(null);

    screenRecorder()?.pause();
    webcamRecorder()?.pause();

    await invoke("pause_audio_recording");

    setRecording(RecordingState.Paused);
  }

  async function resumeRecording() {
    setRecording(null);

    screenRecorder()?.resume();
    webcamRecorder()?.resume();

    await invoke("resume_audio_recording");

    setRecording(RecordingState.Recording);
  }

  async function stopRecording() {
    setRecording(null);

    stopScreenRecorder();
    
    await invoke("stop_audio_recording");

    setRecording(RecordingState.Stopped);
  }

  async function changeChosenInputDevice(deviceNth: number) {
    await invoke("change_chosen_input_device", { deviceNth });
  }

  async function changeChosenOutputDevice(deviceNth: number) {
    await invoke("change_chosen_output_device", { deviceNth });
  }

  async function startScreenRecorder() {
    let screen_stream = null;
    let webcam_stream = null;

    try {
      screen_stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch {
      message("Couldn't record your screen, please try choosing different screen or window", { title: "Couldn't record your screen", type: "error" });
    }

    try {
      webcam_stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: selectedWebcamDevice()?.deviceId }, audio: false });
    } catch {
      message("Couldn't record your camera, please try choosing different camera device", { title: "Couldn't record your camera", type: "error" });
    }

    setScreenStream(screen_stream);
    setWebcamStream(webcam_stream);

    if (screen_stream !== null) {
      const screen_recorder = new MediaRecorder(screen_stream);

      setScreenRecorder(screen_recorder);
    
      screen_recorder.start();

      screen_recorder.ondataavailable = async (e) => {
        const buffer = Array.from(new Uint8Array(await e.data.arrayBuffer()));

        await invoke("send_screen_buffer", { buffer });
      }
    }

    if (webcam_stream !== null) {
      const webcam_recorder = new MediaRecorder(webcam_stream);

      setWebcamRecorder(webcam_recorder);

      webcam_recorder.start();

      webcam_recorder.ondataavailable = async (e) => {
        const buffer = Array.from(new Uint8Array(await e.data.arrayBuffer()));
  
        await invoke("send_webcam_buffer", { buffer });
      }
    }
  }

  function stopScreenRecorder() {
    screenStream()?.getTracks().forEach((v) => v.stop());
    webcamStream()?.getTracks().forEach((v) => v.stop());

    setScreenStream(null);
    setScreenRecorder(null);

    setWebcamStream(null);
    setWebcamRecorder(null);
  }

  return (
    <main class="w-screen h-screen p-2 flex flex-col gap-5 justify-evenly">
      <div class="flex flex-col gap-1">
        <label class="font-bold my-0">Transcribing Accuracy</label>
        <span class="text-xs">More resources are needed for better accuracy</span>
        <select class="border p-1 text-xs w-full" id="model-list" disabled={models() === null} onchange={(e) => selectModel(models()?.[parseInt(e.target.value)] ?? null)}>
          <Show
            when={models() !== null}
            fallback={<option>Loading available model</option>}
          >
            <For each={models()}>{(model, i) => 
              <option value={i().toString()}>{model.name}</option>
            }</For>
          </Show>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <div class="flex gap-1">
          <label class="font-bold w-32" for="input-devices">Microphone</label>
          <select class="border p-1 text-xs w-full" id="input-devices" disabled={inputDevices() === null} onchange={(e) => changeChosenInputDevice(parseInt(e.target.value) || 0)}>
            <Show
              when={inputDevices() !== null}
              fallback={<option>Loading input devices</option>}
            >
              <For each={inputDevices()}>{(device, i) => 
                <option value={i().toString()}>{device}</option>
              }</For>
            </Show>
          </select>
        </div>
        <div class="flex gap-1">
          <label class="font-bold w-32" for="output-devices">System sound</label>
          <select class="border p-1 text-xs w-full" id="output-devices" disabled={outputDevices() === null} onchange={(e) => changeChosenOutputDevice(parseInt(e.target.value) || 0)}>
            <Show
              when={outputDevices() !== null}
              fallback={<option>Loading output devices</option>}
            >
              <For each={outputDevices()}>{(device, i) => 
                <option value={i().toString()}>{device}</option>
              }</For>
            </Show>
          </select>
        </div>
        <div class="flex gap-1">
          <label class="font-bold w-32" for="camera-devices">Camera</label>
          <select class="border p-1 text-xs w-full" id="camera-devices" disabled={webcamDevices() === null} onchange={(e) => selectWebcamDevice(webcamDevices()?.[parseInt(e.target.value) || 0] ?? null)}>
            <Show
              when={webcamDevices() !== null}
              fallback={<option>Loading camera devices</option>}
            >
              <For each={webcamDevices()}>{(device, i) => 
                <option value={i().toString()}>{device.label}</option>
              }</For>
            </Show>
          </select>
        </div>
        <button class="border py-2 cursor-pointer" onclick={reloadDevices}>Reload devices</button>
      </div>
      <div class="flex flex-col gap-[0.125rem]">
        <span class="text-xs">System log</span>
        <textarea class="border resize-none" name="" id="" cols="30" rows="10" value={systemLog()} disabled></textarea>
      </div>
      <div class="flex flex-col gap-1">
        <Show
          when={selectedModel() !== null}
          fallback={<span class="text-center text-xs">&#8203;</span>}
        >
          <span class="text-center text-xs">Will use at least {selectedModel()?.mem_usage} MB of RAM when transcribing</span>
        </Show>
        <div class="w-full flex gap-1">
          <Show
            when={selectedModel()?.is_downloaded}
            fallback={
              <Switch
                fallback={<></>}
              >
                <Match when={[DownloadState.Stopped, DownloadState.Error].includes(modelDownloadState())}>
                  <button class="border py-2 cursor-pointer w-full" onclick={downloadModel}>Download model</button>
                </Match>
                <Match when={[DownloadState.Downloading].includes(modelDownloadState())}>
                  <button class="border py-2 cursor-pointer w-full" disabled onclick={downloadModel}>Downloading model {modelDownloadProgress()}%</button>
                </Match>
              </Switch>
            }
          >
            <Switch fallback={
              <button class="border py-2 cursor-pointer w-full" disabled={true}>Loading</button>
            }>
              <Match when={recording() === RecordingState.Stopped}>
                <Switch
                  fallback={
                    <button class="border py-2 cursor-pointer w-full" onclick={startRecording}>Record</button>
                  }
                >
                  <Match when={transcribeState() === TranscribeState.Transcribing}>
                    <button class="border py-2 cursor-pointer w-full" disabled>Transribing</button>
                  </Match>
                </Switch>
              </Match>
              <Match when={recording() === RecordingState.Paused}>
                <button class="border py-2 cursor-pointer w-full" onclick={resumeRecording}>Resume</button>
              </Match>
              <Match when={recording() === RecordingState.Recording}>
                <button class="border py-2 cursor-pointer w-full" onclick={pauseRecording}>Pause</button>
                <button class="border py-2 cursor-pointer w-full" onclick={stopRecording}>Stop</button>
              </Match>
            </Switch>
          </Show>
        </div>
      </div>
    </main>
  );
}

export default App;
