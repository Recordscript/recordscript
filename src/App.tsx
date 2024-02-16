import { For, Match, Show, Switch, createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/tauri";
import { message } from "@tauri-apps/api/dialog";

enum RecordingState {
  Recording,
  Paused,
  Stopped
}

function App() {
  const [inputDevices, setInputDevices] = createSignal<string[] | null>(null);
  const [outputDevices, setOutputDevices] = createSignal<string[] | null>(null);
  const [webcamDevices, setWebcamDevices] = createSignal<MediaDeviceInfo[] | null>(null);

  const [chosenWebcamDevice, choseWebcamDevice] = createSignal<MediaDeviceInfo | null>(null);

  const [recording, setRecording] = createSignal<RecordingState | null>(RecordingState.Stopped);

  const [screenStream, setScreenStream] = createSignal<MediaStream | null>(null);
  const [webcamStream, setWebcamStream] = createSignal<MediaStream | null>(null);

  const [screenRecorder, setScreenRecorder] = createSignal<MediaRecorder | null>(null);
  const [webcamRecorder, setWebcamRecorder] = createSignal<MediaRecorder | null>(null);

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
      webcam_stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: chosenWebcamDevice()?.deviceId }, audio: false });
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
    <main class="w-screen p-2 flex gap-1 flex-col">
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
        <select class="border p-1 text-xs w-full" id="camera-devices" disabled={webcamDevices() === null} onchange={(e) => choseWebcamDevice(webcamDevices()?.[parseInt(e.target.value) || 0] ?? null)}>
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
      <div class="w-full flex gap-1">
        <Switch fallback={
          <button class="border py-2 cursor-pointer w-full" disabled={true}>Loading</button>
        }>
          <Match when={recording() === RecordingState.Stopped}>
            <button class="border py-2 cursor-pointer w-full" onclick={startRecording}>Record</button>
          </Match>
          <Match when={recording() === RecordingState.Paused}>
            <button class="border py-2 cursor-pointer w-full" onclick={resumeRecording}>Resume</button>
          </Match>
          <Match when={recording() === RecordingState.Recording}>
            <button class="border py-2 cursor-pointer w-full" onclick={pauseRecording}>Pause</button>
            <button class="border py-2 cursor-pointer w-full" onclick={stopRecording}>Stop</button>
          </Match>
        </Switch>
        {/* <button class="border py-2 cursor-pointer w-full" onclick={startScreenRecording}>Bruh</button> */}
      </div>
    </main>
  );
}

export default App;
