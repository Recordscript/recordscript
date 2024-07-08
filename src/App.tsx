import {
    createEffect,
    createResource,
    createSignal,
    For,
    JSX,
    Match,
    Show,
    Suspense,
    Switch,
    untrack,
} from "solid-js";
import { dialog, invoke } from "@tauri-apps/api";
import { InvokeArgs } from "@tauri-apps/api/tauri";
import { appWindow } from "@tauri-apps/api/window";

import * as util from "./util";

import languages from "./lang.json";
import config from "./config.json";
import { ReactiveMap } from "@solid-primitives/map";
import { emit } from "@tauri-apps/api/event";

interface DeviceResult {
    name: string;
    is_selected: boolean;
}

interface Model {
    name: string;
    disk_usage: number;
    mem_usage: number;
    is_downloaded: boolean;
    can_run: boolean;
}

enum ModelState {
    Stopped,
    Downloading,
}

enum RecorderState {
    Stopped,
    Running,
    Paused,
}

interface EventResult {
    type: string;
    value: any;
}

interface SavePathConfig {
    save_path: string;
    save_path_histories: string[];
}

interface GeneralConfig {
    transcript: boolean;
    save_to: SavePathConfig;
    transcription_email_to: string;
}

interface SMTPConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    from: string;
}

function createInvokeResource<R>(cmd: string, args?: InvokeArgs) {
    return createResource(async () => {
        return await invoke(cmd, args) as R;
    });
}

function EmailConfigurator<P extends { on_save: () => void }>(props: P) {
    const [smtp_config, { refetch: update_smtp_config }] = createInvokeResource<
        SMTPConfig
    >("get_smtp_config");

    const error = new ReactiveMap<"host" | "port" | "username" | "password" | "from", string>();

    const [host, set_host] = createSignal("");
    const [port, set_port] = createSignal<number | null>(null);
    const [username, set_username] = createSignal("");
    const [password, set_password] = createSignal("");
    const [from, set_from] = createSignal("");

    async function set_config(config: SMTPConfig) {
        await invoke("set_smtp_config", { config });
        update_smtp_config();
    }

    async function on_save() {
        const has_error = Array.from(error.keys()).length !== 0;

        if (has_error) {
            emit("app://notification", {
                "type": "error",
                "value": "Unable to save because some of the fields are not valid"
            });

            return;
        }

        const config = smtp_config()!;

        await set_config({
            host: host() || config.host,
            port: port() || config.port,
            username: username() || config.username,
            password: password() || config.password,
            from: from() || config.from,
        });

        props.on_save();
    }

    return (
        <div class="p-2 h-full flex flex-col">
            <h2 class="text-xl font-bold h-fit">Email Configuration</h2>
            <hr class="my-2" />
            <div class="flex flex-col gap-1">
                <section class="flex items-center gap-2">
                    <h3 class="text-sm font-bold my-0 h-fit w-52">
                        SMTP Host
                    </h3>
                    <div class="flex flex-col w-full">
                        <span class="absolute text-xs ml-1 mb-[-7px] px-2 z-30 bg-white w-fit text-red-800">
                            {error.get("host")}
                        </span>
                        <input
                            type="text"
                            class="border rounded p-2 text-xs disabled:bg-gray-50 mt-2"
                            placeholder="smtp.example.com"
                            value={smtp_config()?.host}
                            onchange={(event) => {
                                if (util.validate_domain_name(event.currentTarget.value) === false)
                                    error.set("host", "Invalid domain name");
                                else
                                    error.delete("host");

                                set_host(event.currentTarget.value);
                            }}
                        />
                    </div>
                </section>
                <section class="flex items-center gap-2">
                    <h3 class="text-sm font-bold my-0 h-fit w-52">
                        SMTP Port
                    </h3>
                    <div class="flex flex-col w-full">
                        <span class="absolute text-xs ml-1 mb-[-7px] px-2 z-30 bg-white w-fit text-red-800">
                            {error.get("port")}
                        </span>
                        <input
                            type="text"
                            class="border rounded p-2 text-xs disabled:bg-gray-50 mt-2"
                            placeholder="465"
                            value={smtp_config()?.port}
                            onchange={(event) => {
                                const port = parseInt(event.currentTarget.value);

                                if (util.validate_port(port) === false)
                                    error.set("port", "Invalid port (must be a number >= 0 & <= 65535)");
                                else
                                    error.delete("port");

                                set_port(port);
                            }}
                        />
                    </div>
                </section>
                <section class="flex items-center gap-2">
                    <h3 class="text-sm font-bold my-0 h-fit w-52">
                        SMTP Username
                    </h3>
                    <div class="flex flex-col w-full">
                        <span class="absolute text-xs ml-1 mb-[-7px] px-2 z-30 bg-white w-fit text-red-800">
                            {error.get("username")}
                        </span>
                        <input
                            type="text"
                            class="border rounded p-2 text-xs disabled:bg-gray-50 mt-2"
                            placeholder="Username"
                            value={smtp_config()?.username}
                            onchange={(event) => {
                                set_username(event.currentTarget.value);
                            }}
                        />
                    </div>
                </section>
                <section class="flex items-center gap-2">
                    <h3 class="text-sm font-bold my-0 h-fit w-52">
                        SMTP Password
                    </h3>
                    <div class="flex flex-col w-full">
                        <span class="absolute text-xs ml-1 mb-[-7px] px-2 z-30 bg-white w-fit text-red-800">
                            {error.get("password")}
                        </span>
                        <input
                            type="password"
                            class="border rounded p-2 text-xs disabled:bg-gray-50 mt-2"
                            placeholder="Password"
                            value={smtp_config()?.password}
                            onchange={(event) => {
                                set_password(event.currentTarget.value);
                            }}
                        />
                    </div>
                </section>
                <section class="flex items-center gap-2">
                    <h3 class="text-sm font-bold my-0 h-fit w-52">
                        From
                    </h3>
                    <div class="flex flex-col w-full">
                        <span class="absolute text-xs ml-1 mb-[-7px] px-2 z-30 bg-white w-fit text-red-800">
                            {error.get("from")}
                        </span>
                        <input
                            type="text"
                            class="border rounded p-2 text-xs disabled:bg-gray-50 mt-2"
                            placeholder="someone@example.com"
                            value={smtp_config()?.from}
                            onchange={(event) => {
                                if (util.validate_email_from_header(event.currentTarget.value) === false)
                                    error.set("from", "Invalid \"From\" header");
                                else
                                    error.delete("from");

                                set_from(event.currentTarget.value);
                            }}
                        />
                    </div>
                </section>
                <a
                    class="text-xs text-blue-500 underline w-fit"
                    href={config.smtp_article_url}
                    target="_blank"
                >
                    Learn how to setup SMTP from this article
                </a>
            </div>
            <div class="w-full h-full flex items-end">
                <button
                    onClick={on_save}
                    class="border rounded py-2 cursor-pointer font-bold text-xs w-full mt-5"
                >
                    Save
                </button>
            </div>
        </div>
    );
}

function NotificationError<P extends { title: string; message: string }>(
    props: P,
) {
    return (
        <div class="bg-red-700 bg-opacity-75 p-2 rounded text-white">
            <h3 class="font-extrabold">{props.title}</h3>
            <p class="text-sm whitespace-pre-line">
                {props.message}
            </p>
        </div>
    );
}

function NotificationInfo<P extends { title: string; message: string, override_on_click?: () => void }>(
    props: P,
) {
    return (
        <div class="bg-zinc-700 bg-opacity-75 p-2 rounded text-white" onclick={(e) => {
            if (props.override_on_click) {
                e.stopPropagation();

                props.override_on_click();
            }
        }}>
            <h3 class="font-extrabold">{props.title}</h3>
            <p class="text-sm whitespace-pre-line">
                {props.message}
            </p>
        </div>
    );
}

function App() {
    const [popup, set_popup] = createSignal<JSX.Element | null>(null);
    const [notification, set_notification] = createSignal<JSX.Element[]>([]);

    const [microphone, set_microphone] = createSignal<string | null>(null);
    const [speaker, set_speaker] = createSignal<string | null>(null);
    const [screen, set_screen] = createSignal<string | null>(null);

    const [model, set_model] = createSignal<number>(0);
    const [model_state, set_model_state] = createSignal(ModelState.Stopped);
    const [model_download_progress, set_model_download_progress] = createSignal(
        0,
    );

    const [language, set_language] = createSignal("auto");

    const [recording_state, set_recording_state] = createSignal(
        RecorderState.Stopped,
    );

    const [microphones] = createInvokeResource<DeviceResult[]>("list_microphone");
    const [speakers] = createInvokeResource<DeviceResult[]>("list_speaker");
    const [screens] = createInvokeResource<DeviceResult[]>("list_screen");

    const [general_config, { refetch: update_general_config }] =
        createInvokeResource<GeneralConfig>("get_general_config");
    const [smtp_config, { refetch: update_smtp_config }] = createInvokeResource<
        SMTPConfig
    >("get_smtp_config");

    const [transcription_email_to, set_transcription_email_to] = createSignal("");

    const [models, { refetch: update_models }] = createInvokeResource<Model[]>("list_model");

    createEffect(() => invoke("select_microphone", { deviceName: microphone() }));
    createEffect(() => invoke("select_speaker", { deviceName: speaker() }));
    createEffect(() => invoke("select_screen", { deviceName: screen() }));

    createEffect(() => invoke("select_model", { model: model() }))
    createEffect(() => invoke("select_language", { language: language() }));

    async function set_general_config(config: GeneralConfig) {
        await invoke("set_general_config", { generalConfig: config });
        update_general_config();
    }

    createEffect(() => {
        let config = untrack(general_config)!;

        config.transcription_email_to = transcription_email_to();

        set_general_config(config);
    });

    async function update_save_to_path_with(path: string) {
        let config = general_config()!;

        config.save_to.save_path_histories.push(path);

        config.save_to.save_path_histories = [
            ...new Set([
                ...config.save_to.save_path_histories,
            ]),
        ];
        config.save_to.save_path = path;

        set_general_config(config);
    }

    async function update_is_transcript(value: boolean) {
        let config = general_config()!;

        config.transcript = value;

        set_general_config(config);
    }

    async function update_save_to_path() {
        let result = await dialog.open({
            multiple: false,
            directory: true,
            title: "Choose new save location",
        });

        let path = result as string ?? null;

        if (path === null) return;

        update_save_to_path_with(path);
    }

    function push_notification(element: JSX.Element): number {
        let index = notification().length;
        set_notification((p) => [...p, element]);
        return index;
    }

    function delete_notification(index: number) {
        set_notification((p) => {
            let n = Array.from(p);
            delete n[index];
            return n;
        });
    }

    function on_email_configuration_click() {
        set_popup(EmailConfigurator({
            on_save: function () {
                update_smtp_config();
                set_popup(null);
            },
        }));
    }

    const recording = {
        start: async function () {
            await invoke("start_record");

            set_recording_state(RecorderState.Running);
        },
        stop: async function () {
            await invoke("stop_record");

            set_recording_state(RecorderState.Stopped);
        },
        pause: async function () {
            await invoke("pause_record");

            set_recording_state(RecorderState.Paused);
        },
        resume: async function () {
            await invoke("resume_record");

            set_recording_state(RecorderState.Running);
        },
    };

    appWindow.listen<"start" | "pause" | "stop">(
        "app://recording_state",
        (event) => {
            switch (event.payload) {
                case "start":
                    set_recording_state(RecorderState.Running);
                    break;
                case "stop":
                    set_recording_state(RecorderState.Stopped);
                    break;
                case "pause":
                    set_recording_state(RecorderState.Paused);
                    break;
            }
        },
    );

    appWindow.listen<EventResult>("app://notification", (event) => {
        let idx = -1;

        interface LinkPayload {
            message: string;
            at: string;
        }

        switch (event.payload.type) {
            case "error":
                idx = push_notification(
                    NotificationError({ title: "Error", message: event.payload.value }),
                );

                break;
            case "info":
                idx = push_notification(
                    NotificationInfo({ title: "Info", message: event.payload.value }),
                );

                break;
            case "link":
                const payload: LinkPayload = event.payload.value;

                idx = push_notification(
                    NotificationInfo({
                        title: "Info", message: payload.message, async override_on_click() {
                            await invoke("show_file", { path: payload.at });
                        },
                    })
                );

                break;
        }

        setTimeout(() => delete_notification(idx), 10000);
    });


    appWindow.listen<string>("app://transcriber_start", (event) => {
        const transciption_uuid = event.payload;

        function Element() {
            return (
                <div onClick={(e) => e.stopPropagation()} class="cursor-default">
                    <NotificationInfo
                        title="Info"
                        message={`${transciption_uuid}: Transcribing, please don't close the app`}
                    />
                </div>
            );
        }

        const notification_id = push_notification(Element());

        let shown = false;
        const unlisten = appWindow.listen<EventResult>(
            event.payload,
            async (event) => {
                if (shown) return;
                shown = true;

                switch (event.payload.type) {
                    case "finish":
                        delete_notification(notification_id);

                        await emit("app://notification", {
                            type: "link",
                            value: {
                                message: `${transciption_uuid}: Transcription is saved at\n${event.payload.value}`,
                                at: event.payload.value
                            }
                        });

                        await unlisten;
                        break;
                    case "finish_failed":
                        delete_notification(notification_id);

                        await unlisten;
                        break;
                }
            },
        );
    });

    async function download_selected_model() {
        if (model() === null) return;

        set_model_state(ModelState.Downloading);

        const channel_name = await invoke("download_model", {
            modelIndex: model(),
        }) as string;

        appWindow.listen<EventResult>(channel_name, (event) => {
            switch (event.payload.type) {
                case "progress":
                    set_model_download_progress(parseInt(event.payload.value));

                    break;
                case "done":
                    set_model_state(ModelState.Stopped);
                    update_models();
                    break;
            }
        });
    }

    function ScreenSelector() {
        function Screen<P extends { name: string; display_name: string; selected?: boolean }>(props: P) {
            const [preview] = createInvokeResource<string>("preview_screen", { deviceName: props.name });

            return <button class={`rounded p-2 outline outline-0 ${props.selected ? "bg-blue-50 !outline-2 outline-blue-300" : "hover:bg-blue-50 hover:outline-2 hover:outline-gray-300"}`}
            onClick={(_) => {
                set_screen(props.name);
            }}>
                <img class="max-w-64 rounded" src={`data:image/png;base64,${preview()}`}/>
                <span class="text-sm">{props.display_name}</span>
            </button>
        }
        return (
            <div class="flex flex-col">
                <h2 class="p-2 text-xl font-bold h-fit">Select your screen</h2>
                <hr class="" />
                <div class="p-2 flex flex-wrap justify-center content-start gap-2">
                    <Suspense>
                        <For each={screens()!}>
                            {(device, idx) => (
                                <Screen name={device.name} display_name={`Screen ${idx() + 1}`} selected={screen() ? screen() === device.name : device.is_selected} />
                            )}
                        </For>
                    </Suspense>
                </div>
                <button
                    onClick={() => {
                        set_popup(null);
                        recording.start();
                    }}
                    class="w-full h-full max-h-[3rem] border border-x-transparent font-bold p-2 cursor-pointer"
                >
                    Start Recording
                </button>
            </div>
        )
    }

    return (
        <main class="flex flex-col h-screen justify-start">
            <Show when={popup()} keyed>
                {(popup) => (
                    <div
                        onClick={() => {
                            set_popup(null);
                        }}
                        class="fixed flex justify-center items-center w-screen h-screen bg-black bg-opacity-50"
                    >
                        <div
                            class="bg-white sm:w-2/3 lg:w-1/2 h-fit rounded overflow-y-scroll"
                            onClick={(event) => event.stopPropagation()}
                        >
                            {popup}
                        </div>
                    </div>
                )}
            </Show>
            <div class="fixed flex flex-col gap-1 right-0 m-3 [&>div]:min-w-56">
                <For each={notification()}>
                    {(element, i) => (
                        <Show when={element}>
                            <div
                                class="cursor-pointer"
                                onClick={() => delete_notification(i())}
                            >
                                {element}
                            </div>
                        </Show>
                    )}
                </For>
            </div>
            <div class="m-2">
                <h2 class="text-xl font-bold h-fit">Device Configuration</h2>
                <hr class="my-2" />
                <div class="flex flex-col gap-1">
                    <section class="flex items-center gap-2">
                        <h3 class="text-sm font-bold my-0 h-fit w-32">Microphone</h3>
                        <select
                            class="border p-1 text-xs w-full"
                            disabled={microphones.loading}
                            onchange={(e) => set_microphone(e.target.value)}
                        >
                            <Suspense>
                                <For each={microphones()!}>
                                    {(device) => (
                                        <option value={device.name} selected={device.is_selected}>
                                            {device.name}
                                        </option>
                                    )}
                                </For>
                            </Suspense>
                        </select>
                    </section>
                    <section class="flex items-center gap-2">
                        <h3 class="text-sm font-bold my-0 h-fit w-32">Speaker</h3>
                        <select
                            class="border p-1 text-xs w-full"
                            disabled={speakers.loading}
                            onchange={(e) => set_speaker(e.target.value)}
                        >
                            <Suspense>
                                <For each={speakers()!}>
                                    {(device) => (
                                        <option value={device.name} selected={device.is_selected}>
                                            {device.name}
                                        </option>
                                    )}
                                </For>
                            </Suspense>
                        </select>
                    </section>
                    {/* <section class="flex items-center gap-2"> */}
                    {/*     <h3 class="text-sm font-bold my-0 h-fit w-32">Screen</h3> */}
                    {/*     <select */}
                    {/*         class="border p-1 text-xs w-full" */}
                    {/*         disabled={screens.loading} */}
                    {/*         onchange={(e) => set_screen(e.target.value)} */}
                    {/*     > */}
                    {/*         <Suspense> */}
                    {/*             <For each={screens()!}> */}
                    {/*                 {(device) => ( */}
                    {/*                     <option value={device.name} selected={device.is_selected}> */}
                    {/*                         {device.name} */}
                    {/*                     </option> */}
                    {/*                 )} */}
                    {/*             </For> */}
                    {/*         </Suspense> */}
                    {/*     </select> */}
                    {/* </section> */}
                    <section class="flex items-center gap-2">
                        <h3 class="text-sm font-bold my-0 h-fit w-32">Transcript</h3>
                        <input type="checkbox" onchange={(e) => update_is_transcript(e.target.checked)} checked={general_config()?.transcript} />
                    </section>
                </div>
            </div>
            <Show when={general_config()?.transcript}>
                <div class="m-2">
                    <h2 class="text-xl font-bold h-fit">Transcriber Configuration</h2>
                    <hr class="my-2" />
                    <div class="flex flex-col gap-1">
                        <section class="flex items-center gap-2">
                            <h3 class="text-sm font-bold my-0 h-fit w-32">Model</h3>
                            <div class="flex flex-col w-full">
                                <select
                                    class="border p-1 text-xs w-full"
                                    onchange={(e) => set_model(parseInt(e.target.value))}
                                >
                                    <Suspense>
                                        <For each={models()!}>
                                            {(m, i) => (
                                                <option value={i()} selected={i() === model()}>
                                                    {m.name}
                                                </option>
                                            )}
                                        </For>
                                    </Suspense>
                                </select>
                                <Suspense>
                                    <Show
                                        when={model() !== null && !models()?.[model()!].is_downloaded}
                                    >
                                        <Switch>
                                            <Match when={model_state() === ModelState.Downloading}>
                                                <button
                                                    class="border rounded py-2 text-xs"
                                                    disabled
                                                >
                                                    Downloading %{model_download_progress()}
                                                </button>
                                            </Match>
                                            <Match when={model_state() === ModelState.Stopped}>
                                                <button
                                                    class="border rounded py-2 cursor-pointer text-xs"
                                                    onclick={download_selected_model}
                                                >
                                                    Download
                                                </button>
                                            </Match>
                                        </Switch>
                                    </Show>
                                </Suspense>
                            </div>
                        </section>
                        <section class="flex items-center gap-2">
                            <h3 class="text-sm font-bold my-0 h-fit w-32">Language</h3>
                            <select
                                class="border p-1 text-xs w-full"
                                onchange={(e) => set_language(e.target.value)}
                            >
                                <option value="auto">Auto</option>
                                <For each={languages}>
                                    {([display, id]) => <option value={id}>{display}</option>}
                                </For>
                            </select>
                        </section>
                    </div>
                </div>
            </Show>
            <div class="m-2">
                <h2 class="text-xl font-bold h-fit">General Configuration</h2>
                <hr class="my-2" />
                <div class="flex flex-col gap-1">
                    <section class="flex items-center gap-2">
                        <h3 class="text-sm font-bold my-0 h-fit w-52">
                            Save To
                        </h3>
                        <div class="flex flex-col w-full">
                            <select
                                class="border p-1 text-xs w-full"
                                onchange={(e) => update_save_to_path_with(e.target.value)}
                            >
                                <Show when={general_config() !== undefined}>
                                    <For
                                        each={general_config()!.save_to.save_path_histories}
                                    >
                                        {(path) => (
                                            <option
                                                value={path}
                                                selected={general_config()!.save_to.save_path ===
                                                    path}
                                            >
                                                {path}
                                            </option>
                                        )}
                                    </For>
                                </Show>
                            </select>
                            <button
                                onclick={update_save_to_path}
                                class="border rounded py-2 cursor-pointer text-xs"
                            >
                                Browse
                            </button>
                        </div>
                    </section>
                    <Show when={general_config()?.transcript}>
                        <section class="flex items-center gap-2">
                            <h3 class="text-sm font-bold my-0 h-fit w-52">
                                Email Transcription To
                            </h3>
                            <div class="flex flex-col w-full">
                                <span class="absolute text-xs ml-1 mb-[-7px] px-2 z-30 bg-white w-fit text-red-800">
                                </span>
                                <input
                                    type="text"
                                    class="border rounded p-2 text-xs disabled:bg-gray-50 mt-2"
                                    onchange={(event) => {
                                        set_transcription_email_to(event.currentTarget.value);
                                    }}
                                    placeholder="email@example.com,email2@example.com,other@neighbour.com"
                                    value={smtp_config()?.host
                                        ? general_config()?.transcription_email_to
                                        : "SMTP server is not configured"}
                                    disabled={!smtp_config()?.host}
                                />
                                <button
                                    onClick={on_email_configuration_click}
                                    class="border rounded py-2 cursor-pointer text-xs"
                                >
                                    Configure
                                </button>
                            </div>
                        </section>
                    </Show>
                </div>
            </div>
            <div class="w-full h-full flex items-end">
                <Switch>
                    <Match when={model() !== null && !models()?.[model()!].can_run}>
                        <button
                            class="w-full h-full max-h-[3rem] border border-x-transparent font-bold p-2 cursor-default"
                            disabled
                        >
                            You need more ram to run this model ({!models()?.[model()!].mem_usage} MB)
                        </button>
                    </Match>
                    <Match when={general_config()?.transcript && model() !== null && !models()?.[model()!].is_downloaded}>
                        <button
                            class="w-full h-full max-h-[3rem] border border-x-transparent font-bold p-2 cursor-default"
                            disabled
                        >
                            The model hasn't been downloaded
                        </button>
                    </Match>
                    <Match when={recording_state() === RecorderState.Stopped}>
                        <button
                            onclick={() => set_popup(ScreenSelector())}
                            class="w-full h-full max-h-[3rem] border border-x-transparent font-bold p-2 cursor-pointer"
                        >
                            Start Recording
                        </button>
                    </Match>
                    <Match when={recording_state() === RecorderState.Paused}>
                        <button
                            onclick={recording.resume}
                            class="w-full h-full max-h-[3rem] border border-x-transparent font-bold p-2 cursor-pointer"
                        >
                            Resume Recording
                        </button>
                    </Match>
                    <Match when={recording_state() === RecorderState.Running}>
                        <button
                            onclick={recording.stop}
                            class="w-full h-full max-h-[3rem] border border-x-transparent font-bold p-2 cursor-pointer"
                        >
                            Stop Recording
                        </button>
                    </Match>
                </Switch>
            </div>
            <a class="mx-auto text-xs text-center my-1 text-blue-500 underline w-fit" target="_blank" href="https://forms.gle/PTs2WGgpidwNeXkLA">Feedback or need support?</a>
        </main>
    );
}

export default App;
