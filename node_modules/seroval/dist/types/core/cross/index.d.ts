import type { SerovalNode } from '../types';
import type { CrossAsyncParserContextOptions } from './async';
import type { CrossDeserializerContextOptions } from './deserializer';
import type { CrossContextOptions, CrossParserContextOptions } from './parser';
import type { CrossStreamParserContextOptions } from './stream';
import type { CrossSyncParserContextOptions } from './sync';
export interface CrossSerializeOptions extends CrossSyncParserContextOptions, CrossContextOptions {
}
export declare function crossSerialize<T>(source: T, options?: CrossSerializeOptions): string;
export interface CrossSerializeAsyncOptions extends CrossAsyncParserContextOptions, CrossContextOptions {
}
export declare function crossSerializeAsync<T>(source: T, options?: CrossSerializeAsyncOptions): Promise<string>;
export type ToCrossJSONOptions = CrossParserContextOptions;
export declare function toCrossJSON<T>(source: T, options?: CrossParserContextOptions): SerovalNode;
export type ToCrossJSONAsyncOptions = CrossParserContextOptions;
export declare function toCrossJSONAsync<T>(source: T, options?: CrossParserContextOptions): Promise<SerovalNode>;
export interface CrossSerializeStreamOptions extends Omit<CrossStreamParserContextOptions, 'onParse'>, CrossContextOptions {
    onSerialize: (data: string, initial: boolean) => void;
}
export declare function crossSerializeStream<T>(source: T, options: CrossSerializeStreamOptions): () => void;
export type ToCrossJSONStreamOptions = CrossStreamParserContextOptions;
export declare function toCrossJSONStream<T>(source: T, options: ToCrossJSONStreamOptions): () => void;
export type FromCrossJSONOptions = CrossDeserializerContextOptions;
export declare function fromCrossJSON<T>(source: SerovalNode, options: FromCrossJSONOptions): T;
//# sourceMappingURL=index.d.ts.map