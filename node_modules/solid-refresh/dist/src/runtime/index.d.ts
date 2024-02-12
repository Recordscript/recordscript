import { Context, JSX } from 'solid-js';
import { ESMRuntimeType, StandardRuntimeType } from '../shared/types';
interface ComponentOptions {
    location?: string;
    signature?: string;
    dependencies?: Record<string, any>;
}
export interface ComponentRegistrationData<P> extends ComponentOptions {
    id: string;
    component: (props: P) => JSX.Element;
    proxy: (props: P) => JSX.Element;
    update: (action: () => (props: P) => JSX.Element) => void;
}
export interface ContextRegistrationData<T> {
    id: string;
    context: Context<T>;
}
export interface Registry {
    components: Map<string, ComponentRegistrationData<any>>;
    contexts: Map<string, ContextRegistrationData<any>>;
}
export declare function $$registry(): Registry;
export declare function $$component<P>(registry: Registry, id: string, component: (props: P) => JSX.Element, options?: ComponentOptions): (props: P) => JSX.Element;
export declare function $$context<T>(registry: Registry, id: string, context: Context<T>): Context<T>;
declare const SOLID_REFRESH = "solid-refresh";
declare const SOLID_REFRESH_PREV = "solid-refresh-prev";
type HotData = {
    [key in typeof SOLID_REFRESH | typeof SOLID_REFRESH_PREV]: Registry;
};
interface ESMHot {
    data: HotData;
    accept: (cb: (module?: unknown) => void) => void;
    invalidate: () => void;
    decline: () => void;
}
interface StandardHot {
    data: HotData;
    accept: (cb?: () => void) => void;
    dispose: (cb: (data: HotData) => void) => void;
    invalidate?: () => void;
    decline?: () => void;
}
type ESMDecline = [type: ESMRuntimeType, hot: ESMHot, inline?: boolean];
type StandardDecline = [type: StandardRuntimeType, hot: StandardHot, inline?: boolean];
type Decline = ESMDecline | StandardDecline;
export declare function $$decline(...[type, hot, inline]: Decline): void;
type ESMRefresh = [type: ESMRuntimeType, hot: ESMHot, registry: Registry];
type StandardRefresh = [type: StandardRuntimeType, hot: StandardHot, registry: Registry];
type Refresh = ESMRefresh | StandardRefresh;
export declare function $$refresh(...[type, hot, registry]: Refresh): void;
export {};
