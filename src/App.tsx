import { For, Match, Show, Switch, createEffect, createSignal, untrack } from "solid-js";
import { invoke } from "@tauri-apps/api/tauri";
import { message } from "@tauri-apps/api/dialog";
import { appWindow } from "@tauri-apps/api/window";
import { readBinaryFile } from "@tauri-apps/api/fs";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { ReactiveMap } from "@solid-primitives/map";

import languages from "./lang.json";

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

enum FFmpegDownloadState {
  Stopped,
  Downloading,
  Extracting,
}

enum AppState {
  Nothing,
  DownloadingModel,
  DownloadingFFmpeg,
  ProcessingAudio,
  ProcessingVideo,
  Transcribing,
}

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

interface DeviceResult {
  name: string;
  is_selected: boolean;
}

function App() {
  const [appState, setAppState] = createSignal<AppState>(AppState.Nothing);
  const [deviceTypes, setDeviceTypes] = createSignal<string[] | null>(null);
  
  // const [devices, setDevices] = createSignal<Map<string, DeviceResult[] | undefined>>(new Map());
  // const [selectedDevice, selectDevice] = createSignal<Map<string, number | undefined>>(new Map());
  const devices = new ReactiveMap<string, DeviceResult[] | undefined>();
  const selectedDevice = new ReactiveMap<string, number | undefined>();

  // const [inputDevices, setInputDevices] = createSignal<string[] | null>(null);
  // const [outputDevices, setOutputDevices] = createSignal<string[] | null>(null);
  // const [webcamDevices, setWebcamDevices] = createSignal<MediaDeviceInfo[] | null>(null);

  // const [selectedWebcamDevice, selectWebcamDevice] = createSignal<MediaDeviceInfo | null>(null);

  const [recording, setRecording] = createSignal<RecordingState | null>(RecordingState.Stopped);

  const [screenStream, setScreenStream] = createSignal<MediaStream | null>(null);
  const [webcamStream, setWebcamStream] = createSignal<MediaStream | null>(null);

  const [recordScreen, setRecordScreen] = createSignal<boolean>(true);
  
  const [screenRecorder, setScreenRecorder] = createSignal<MediaRecorder | null>(null);
  const [webcamRecorder, setWebcamRecorder] = createSignal<MediaRecorder | null>(null);

  // const [screenBuffer, setScreenBuffer] = createSignal<Uint8Array>(new Uint8Array());
  // const [audioBuffer, setAudioBuffer] = createSignal<Uint8Array>(new Uint8Array());

  const [models, setModels] = createSignal<Model[] | null>(null);
  const [selectedModel, selectModel] = createSignal<Model | null>(null);

  const [language, setLanguage] = createSignal("auto");

  const [modelDownloadState, setModelDownloadState] = createSignal<DownloadState>(DownloadState.Stopped);
  const [modelDownloadProgress, setModelDownloadProgress] = createSignal<number>(0);
  
  const [ffmpegDownloadState, setFFmpegDownloadState] = createSignal<FFmpegDownloadState>(FFmpegDownloadState.Stopped);
  const [ffmpegDownloadProgress, setFFmpegDownloadProgress] = createSignal<number>(0);

  const [systemLog, setSystemLog] = createSignal<string>("");

  const [transcribeState, setTranscribeState] = createSignal<TranscribeState>(TranscribeState.Stopped);
  const [transcribeProgress, setTranscribeProgress] = createSignal<number>(0);

  appWindow.listen<EventResult>("ffmpeg://download", (event) => {
    let type = event.payload.type;

    switch (type) {
      case "start": {
        setFFmpegDownloadState(FFmpegDownloadState.Downloading);
      } break;
      case "progress": {
        let progress = parseInt(event.payload.value);

        setFFmpegDownloadProgress(progress);
      } break;
      case "extracting": {
        setFFmpegDownloadState(FFmpegDownloadState.Extracting);
      } break;
      case "stop": {
        setFFmpegDownloadState(FFmpegDownloadState.Stopped);
      } break;
    }
  });

  async function loadModels() {
    setModels(null);

    const models = await invoke("load_model_list") as Model[];
    selectModel(models[0]);

    setModels(models);
  }
  loadModels();

  createEffect(() => {
    const modelIndex = models()?.indexOf(selectedModel()!);
    if (modelIndex === undefined) return;

    (async () => {
      await invoke("switch_model", { modelIndex });
    })();
  });

  createEffect(() => {
    (async () => {
      await invoke("switch_language", { language: language() });
    })();
  })

  appWindow.listen<EventResult>("app://update-state", (event) => {
    let type = event.payload.type;

    switch (type) {
      case "download-ffmpeg": {
        setAppState(AppState.DownloadingFFmpeg);
      } break;
      case "download-model": {
        setAppState(AppState.DownloadingModel);
      } break;
      case "process-audio": {
        setAppState(AppState.ProcessingAudio);
      } break;
      case "process-video": {
        setAppState(AppState.ProcessingVideo);
      } break;
      case "transcribing": {
        setAppState(AppState.Transcribing);
      } break;
      case "nothing": {
        setAppState(AppState.Nothing);
      } break;
    }
  });

  appWindow.listen<EventResult>("update-state", (event) => {
    let type = event.payload.type;

    switch (type) {
      case "transcribe-start": {
        setTranscribeState(TranscribeState.Transcribing);
      } break;
      // FIXME: look at "FIXME: TRANSCRIBE-PROGRESS" at src-tauri
      case "transcribe-progress": {
        let progress = parseInt(event.payload.value);

        setTranscribeProgress(progress);
      } break;
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

  async function loadDeviceTypes() {
    setDeviceTypes(null);

    const deviceTypes = await invoke("list_device_types") as string[];

    deviceTypes.forEach(async (deviceType, deviceTypeIndex) => {
      const dvcs = await invoke("list_devices", { deviceTypeIndex }) as DeviceResult[];

      dvcs
        .forEach((dvcs, deviceIndex) => {
          if (!dvcs.is_selected) return;
          selectedDevice.set(deviceType, deviceIndex);

          createEffect(() =>
            invoke("select_device", { deviceTypeIndex, deviceIndex: selectedDevice.get(deviceType) })
          );
        });

      devices.set(deviceType, dvcs);
    });

    setDeviceTypes(deviceTypes);
  }
  loadDeviceTypes();

  // async function listWebcamDevices() {
  //   setWebcamDevices(null);

  //   const devices = await navigator.mediaDevices.enumerateDevices();

  //   setWebcamDevices(devices.filter((v) => v.kind === "videoinput"));
  // }

  // function reloadDevices() {
    // listWebcamDevices();
  // }
  // reloadDevices();

  async function startRecording() {
    setRecording(null);

    await invoke("start_device_record", { recordScreen: recordScreen() });

    setRecording(RecordingState.Recording);
  }

  async function pauseRecording() {
    setRecording(null);

    await invoke("pause_device_record");

    setRecording(RecordingState.Paused);
  }

  async function resumeRecording() {
    setRecording(null);

    await invoke("resume_device_record");

    setRecording(RecordingState.Recording);
  }

  async function stopRecording() {
    setRecording(null);

    await invoke("stop_device_record");

    setRecording(RecordingState.Stopped);
  }

  return (
    <>
      <Show
        when={appState() !== AppState.Nothing}
        fallback={<></>}
      >
        <div class="absolute flex text-white justify-center items-center w-screen h-screen">
          <div class="z-0 absolute w-screen h-screen bg-black bg-opacity-50"></div>
          <div class="z-20 flex flex-col items-center gap-5">
            <Switch>
              <Match when={appState() === AppState.Transcribing}>
                <h1 class="text-5xl font-bold">Transribing</h1>
                <span>Please wait till the subtitle is generated</span>
              </Match>
              <Match when={appState() === AppState.ProcessingAudio}>
                <h1 class="text-5xl font-bold">Processing audio</h1>
                <span>&#8203;</span>
              </Match>
              <Match when={appState() === AppState.ProcessingVideo}>
                <h1 class="text-5xl font-bold">Processing video</h1>
                <span>&#8203;</span>
              </Match>
              <Match when={appState() === AppState.DownloadingFFmpeg}>
                <h1 class="text-5xl font-bold">Downloading FFmpeg</h1>
                <span class="bg-gray-800 w-full text-center self-start" style={`background: linear-gradient(90deg, rgba(50,200,133,1) ${ffmpegDownloadProgress()}%, rgb(26,28,29) ${ffmpegDownloadProgress()}%);`}>{ffmpegDownloadProgress()} %</span>
              </Match>
              <Match when={appState() === AppState.DownloadingModel}>
                <h1 class="text-5xl font-bold">Downloading Model</h1>
                <span class="bg-gray-800 w-full text-center self-start" style={`background: linear-gradient(90deg, rgba(50,200,133,1) ${modelDownloadProgress()}%, rgb(26,28,29) ${modelDownloadProgress()}%);`}>{modelDownloadProgress()} %</span>
              </Match>
            </Switch>
          </div>
        </div>
      </Show>
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
        <label class="font-bold my-0">Language</label>
          <select class="border p-1 text-xs w-full" id="language-list" onchange={(e) => setLanguage(e.target.value)}>
            <option value="auto">Auto</option>
            <For each={languages}>{([display, id]) => 
              <option value={id}>{display}</option>
            }</For>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <For each={deviceTypes()}>{(name) => 
            <div class="flex gap-1">
              <label class="font-bold w-32" for={`"${name}-devices"`}>{name}</label>
              <select class="border p-1 text-xs w-full" id={`"${name}-devices"`} disabled={devices.get(name) === undefined} onchange={(e) => selectedDevice.set(name, parseInt(e.target.value) ?? undefined)}>
                <Show
                  when={devices.get(name) !== undefined}
                  fallback={<option>Loading {name.toLocaleLowerCase()} devices</option>}
                >
                  <For each={devices.get(name)}>{(device, i) => 
                    <option value={i().toString()} selected={device.is_selected}>{device.name}</option>
                  }</For>
                </Show>
              </select>
            </div>
          }</For>
          {/* <div class="flex gap-1">
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
          </div> */}
          {/* <button class="border py-2 cursor-pointer" onclick={reloadDevices}>Reload devices</button> */}
          <div class="flex gap-2">
            <div class="flex gap-1">
              <input checked={recordScreen()} onchange={(e) => setRecordScreen(e.currentTarget.checked)} type="checkbox" id="enable-screen-record" value="Bike"></input>
              <label class="text-sm" for="enable-screen-record">Record screen</label>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-[0.125rem]">
          <span class="text-xs">System log</span>
          <textarea class="border resize-none font-mono text-xs" name="" id="" cols="30" rows="10" value={systemLog()} disabled></textarea>
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
                <Match when={[FFmpegDownloadState.Downloading].includes(ffmpegDownloadState())}>
                  <button class="border py-2 cursor-pointer w-full" disabled onclick={downloadModel}>Downloading FFmpeg {ffmpegDownloadProgress()}%</button>
                </Match>
                <Match when={[FFmpegDownloadState.Extracting].includes(ffmpegDownloadState())}>
                  <button class="border py-2 cursor-pointer w-full" disabled onclick={downloadModel}>Extracting FFmpeg</button>
                </Match>
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
                {/* <Match when={recording() === RecordingState.Paused}>
                  <button class="border py-2 cursor-pointer w-full" onclick={resumeRecording}>Resume</button>
                </Match> */}
                <Match when={recording() === RecordingState.Recording}>
                  {/* <button class="border py-2 cursor-pointer w-full" onclick={pauseRecording}>Pause</button> */}
                  <button class="border py-2 cursor-pointer w-full" onclick={stopRecording}>Stop</button>
                </Match>
              </Switch>
            </Show>
          </div>
        </div>
      </main>
    </>
  );
}

export default App;
