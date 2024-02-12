import { type PluginAccessOptions } from '../plugin';
import type { SerovalNode } from '../types';
import type { AsyncParserContextOptions } from './async';
import type { SyncParserContextOptions } from './sync';
export declare function serialize<T>(source: T, options?: SyncParserContextOptions): string;
export declare function serializeAsync<T>(source: T, options?: AsyncParserContextOptions): Promise<string>;
export declare function deserialize<T>(source: string): T;
export interface SerovalJSON {
    t: SerovalNode;
    f: number;
    m: number[];
}
export declare function toJSON<T>(source: T, options?: SyncParserContextOptions): SerovalJSON;
export declare function toJSONAsync<T>(source: T, options?: AsyncParserContextOptions): Promise<SerovalJSON>;
export declare function compileJSON(source: SerovalJSON, options?: PluginAccessOptions): string;
export declare function fromJSON<T>(source: SerovalJSON, options?: PluginAccessOptions): T;
//# sourceMappingURL=index.d.ts.map