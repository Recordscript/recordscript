import { SerovalNode } from './types';
export declare class SerovalError extends Error {
    cause: any;
    constructor(type: string, cause: any);
}
export declare class SerovalParserError extends SerovalError {
    constructor(cause: any);
}
export declare class SerovalSerializationError extends SerovalError {
    constructor(cause: any);
}
export declare class SerovalDeserializationError extends SerovalError {
    constructor(cause: any);
}
export declare class SerovalUnsupportedTypeError extends Error {
    value: unknown;
    constructor(value: unknown);
}
export declare class SerovalUnsupportedNodeError extends Error {
    constructor(node: SerovalNode);
}
export declare class SerovalMissingPluginError extends Error {
    constructor(tag: string);
}
export declare class SerovalMissingInstanceError extends Error {
    constructor(tag: string);
}
export declare class SerovalMissingReferenceError extends Error {
    value: unknown;
    constructor(value: unknown);
}
export declare class SerovalMissingReferenceForIdError extends Error {
    constructor(id: string);
}
export declare class SerovalUnknownTypedArrayError extends Error {
    constructor(name: string);
}
//# sourceMappingURL=errors.d.ts.map