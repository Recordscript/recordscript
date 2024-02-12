import { For, Match, Show, Switch, createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/tauri";

enum RecordingState {
  Recording,
  Paused,
  Stopped
}

function App() {
  const [inputDevices, setInputDevices] = createSignal<string[] | null>(null);
  const [outputDevices, setOutputDevices] = createSignal<string[] | null>(null);

  const [recording, setRecording] = createSignal<RecordingState | null>(RecordingState.Stopped);

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

  function reloadAudioDevices() {
    loadInputDevices();
    loadOutputDevices();
  }
  reloadAudioDevices();

  async function startRecording() {
    setRecording(null);

    await invoke("start_audio_recording");

    setRecording(RecordingState.Recording);
  }

  async function pauseRecording() {
    setRecording(null);

    await invoke("pause_audio_recording");

    setRecording(RecordingState.Paused);
  }

  async function resumeRecording() {
    setRecording(null);

    await invoke("resume_audio_recording");

    setRecording(RecordingState.Recording);
  }

  async function stopRecording() {
    setRecording(null);

    await invoke("stop_audio_recording");

    setRecording(RecordingState.Stopped);
  }

  async function changeChosenInputDevice(deviceNth: number) {
    console.log("bruh");
    await invoke("change_chosen_input_device", { deviceNth });
  }

  async function changeChosenOutputDevice(deviceNth: number) {
    console.log("bruh");
    await invoke("change_chosen_output_device", { deviceNth });
  }

  return (
    <main class="w-screen p-2 flex gap-1 flex-col">
      <div class="flex gap-1">
        <label class="font-bold w-32" for="input-devices">Input device</label>
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
        <label class="font-bold w-32" for="output-devices">Output device</label>
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
      <button class="border py-2 cursor-pointer" onclick={reloadAudioDevices}>Reload devices</button>
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
      </div>
    </main>
  );
}

export default App;
