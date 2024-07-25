import { invoke } from "@tauri-apps/api";

export default function() {
    const recording = {
        start: async function() {
            await invoke("start_record");
        },
        stop: async function() {
            await invoke("stop_record");
        },
        pause: async function() {
            await invoke("pause_record");
        },
        resume: async function() {
            await invoke("resume_record");
        },
    };

    return (
        <div class="flex bg-white border rounded justify-center items-center gap-3 w-fit px-3 py-1 text-xs" data-tauri-drag-region>
            <p class="pointer-events-none">Recordscript is recording</p>
            <button onClick={recording.stop} class="border rounded font-bold px-3 py-1 bg-red-400 text-white">Stop recording</button>
        </div>
    )
}
