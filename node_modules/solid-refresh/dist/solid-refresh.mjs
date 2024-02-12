import { $DEVCOMP, createMemo, untrack, createSignal, DEV } from 'solid-js';

function setComponentProperty(component, key, value) {
    const descriptor = Object.getOwnPropertyDescriptor(component, key);
    if (descriptor) {
        Object.defineProperty(component, key, Object.assign(Object.assign({}, descriptor), { value }));
    }
    else {
        Object.defineProperty(component, key, {
            value,
            writable: false,
            enumerable: false,
            configurable: true,
        });
    }
}
function createProxy(source, name, location) {
    const refreshName = `[solid-refresh]${name}`;
    function HMRComp(props) {
        const s = source();
        if (!s || $DEVCOMP in s) {
            return createMemo(() => {
                const c = source();
                if (c) {
                    return untrack(() => c(props));
                }
                return undefined;
            }, {
                name: refreshName,
            });
        }
        // no $DEVCOMP means it did not go through devComponent so source() is a regular function, not a component
        return s(props);
    }
    setComponentProperty(HMRComp, 'name', refreshName);
    if (location) {
        setComponentProperty(HMRComp, 'location', location);
    }
    return new Proxy(HMRComp, {
        get(_, property) {
            if (property === 'location' || property === 'name') {
                return HMRComp[property];
            }
            return source()[property];
        },
        set(_, property, value) {
            source()[property] = value;
            return true;
        },
    });
}

function isListUpdatedInternal(a, b) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    // Check if both objects has the same amount of keys
    if (aKeys.length !== bKeys.length) {
        return true;
    }
    // Merge keys
    const keys = new Set([...aKeys, ...bKeys]);
    // Now check if merged keys has the same amount of keys as the other two
    // for example: { a, b } and { a, c } produces { a, b, c }
    if (keys.size !== aKeys.length) {
        return true;
    }
    // Now compare each items
    for (const key of keys) {
        // This covers NaN. No need for Object.is since it's extreme for -0
        if (a[key] !== b[key] || (a[key] !== a[key] && b[key] !== b[key])) {
            return true;
        }
    }
    return false;
}
function isListUpdated(a, b) {
    if (a && b) {
        return isListUpdatedInternal(a, b);
    }
    if (a == null && b != null) {
        return true;
    }
    if (a != null && b == null) {
        return true;
    }
    return false;
}

function $$registry() {
    return {
        components: new Map(),
        contexts: new Map(),
    };
}
function $$component(registry, id, component, options = {}) {
    const [comp, setComp] = createSignal(component, { internal: true });
    const proxy = createProxy(comp, id, options.location);
    registry.components.set(id, Object.assign({ id,
        component,
        proxy, update: setComp }, options));
    return proxy;
}
function $$context(registry, id, context) {
    registry.contexts.set(id, {
        id,
        context,
    });
    return context;
}
function patchComponent(oldData, newData) {
    var _a, _b;
    // Check if incoming module has signature
    if (newData.signature) {
        // Compare signatures
        const oldDeps = (_a = oldData.dependencies) === null || _a === void 0 ? void 0 : _a.call(oldData);
        const newDeps = (_b = newData.dependencies) === null || _b === void 0 ? void 0 : _b.call(newData);
        if (newData.signature !== oldData.signature ||
            isListUpdated(newDeps, oldDeps)) {
            // Replace signatures and dependencies
            oldData.dependencies = newDeps ? () => newDeps : undefined;
            oldData.signature = newData.signature;
            // Remount
            oldData.update(() => newData.component);
        }
    }
    else {
        // No granular update, remount
        oldData.update(() => newData.component);
    }
    // Always rely on the first proxy
    // This is to allow modules newly importing
    // the updated version to still be able
    // to render the latest version despite
    // not receiving the first proxy
    newData.update(() => oldData.proxy);
}
function patchComponents(oldData, newData) {
    const components = new Set([
        ...oldData.components.keys(),
        ...newData.components.keys(),
    ]);
    for (const key of components) {
        const oldComponent = oldData.components.get(key);
        const newComponent = newData.components.get(key);
        if (oldComponent) {
            if (newComponent) {
                patchComponent(oldComponent, newComponent);
            }
            else {
                // We need to invalidate
                return true;
            }
        }
        else if (newComponent) {
            oldData.components.set(key, newComponent);
        }
    }
    return false;
}
function patchContext(oldData, newData) {
    oldData.context.defaultValue = newData.context.defaultValue;
    newData.context.id = oldData.context.id;
    newData.context.Provider = oldData.context.Provider;
}
function patchContexts(oldData, newData) {
    const contexts = new Set([
        ...oldData.contexts.keys(),
        ...newData.contexts.keys(),
    ]);
    for (const key of contexts) {
        const oldContext = oldData.contexts.get(key);
        const newContext = newData.contexts.get(key);
        if (oldContext) {
            if (newContext) {
                patchContext(oldContext, newContext);
            }
            else {
                // We need to invalidate
                return true;
            }
        }
        else if (newContext) {
            oldData.contexts.set(key, newContext);
        }
    }
    return false;
}
function patchRegistry(oldRegistry, newRegistry) {
    const shouldInvalidateByContext = patchContexts(oldRegistry, newRegistry);
    const shouldInvalidateByComponents = patchComponents(oldRegistry, newRegistry);
    // In the future we may add other HMR features here
    return shouldInvalidateByComponents || shouldInvalidateByContext;
}
const SOLID_REFRESH = 'solid-refresh';
const SOLID_REFRESH_PREV = 'solid-refresh-prev';
function $$decline(...[type, hot, inline]) {
    switch (type) {
        case 'esm': {
            // Snowpack's ESM assumes invalidate as a normal page reload
            // decline should be better
            if (inline) {
                hot.invalidate();
            }
            else {
                hot.decline();
            }
            break;
        }
        case 'vite': {
            // Vite is no-op on decline, just call invalidate
            if (inline) {
                hot.invalidate();
            }
            else {
                hot.accept(() => {
                    hot.invalidate();
                });
            }
            break;
        }
        case 'rspack-esm':
        case 'webpack5': {
            if (inline) {
                hot.invalidate();
            }
            else {
                hot.decline();
            }
            break;
        }
        case 'standard': {
            // Some implementations do not have decline/invalidate
            if (inline) {
                if (hot.invalidate) {
                    hot.invalidate();
                }
                else {
                    window.location.reload();
                }
            }
            else if (hot.decline) {
                hot.decline();
            }
            else {
                hot.accept(() => {
                    if (hot.invalidate) {
                        hot.invalidate();
                    }
                    else {
                        window.location.reload();
                    }
                });
            }
            break;
        }
    }
}
let warned = false;
function shouldWarnAndDecline() {
    const result = DEV && Object.keys(DEV).length;
    if (result) {
        return false;
    }
    if (!warned) {
        console.warn("To use solid-refresh, you need to use the dev build of SolidJS. Make sure your build system supports package.json conditional exports and has the 'development' condition turned on.");
        warned = true;
    }
    return true;
}
function $$refreshESM(type, hot, registry) {
    if (shouldWarnAndDecline()) {
        $$decline(type, hot);
    }
    else if (hot.data) {
        hot.data[SOLID_REFRESH] = hot.data[SOLID_REFRESH] || registry;
        hot.data[SOLID_REFRESH_PREV] = registry;
        hot.accept(mod => {
            if (mod == null ||
                patchRegistry(hot.data[SOLID_REFRESH], hot.data[SOLID_REFRESH_PREV])) {
                hot.invalidate();
            }
        });
    }
    else {
        // I guess just decline if hot.data doesn't exist
        $$decline(type, hot);
    }
}
function $$refreshStandard(type, hot, registry) {
    if (shouldWarnAndDecline()) {
        $$decline(type, hot);
    }
    else {
        const current = hot.data;
        if (current && current[SOLID_REFRESH]) {
            if (patchRegistry(current[SOLID_REFRESH], registry)) {
                $$decline(type, hot, true);
            }
        }
        hot.dispose((data) => {
            data[SOLID_REFRESH] = current ? current[SOLID_REFRESH] : registry;
        });
        hot.accept();
    }
}
function $$refresh(...[type, hot, registry]) {
    switch (type) {
        case 'esm':
        case 'vite': {
            $$refreshESM(type, hot, registry);
            break;
        }
        case 'standard':
        case 'webpack5':
        case 'rspack-esm': {
            $$refreshStandard(type, hot, registry);
            break;
        }
    }
}

export { $$component, $$context, $$decline, $$refresh, $$registry };
