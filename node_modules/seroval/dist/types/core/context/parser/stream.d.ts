import type { BaseSyncParserContextOptions } from './sync';
import BaseSyncParserContext from './sync';
import type { SerovalNode, SerovalObjectRecordNode, SerovalPluginNode, SerovalPromiseConstructorNode } from '../../types';
import type { Stream } from '../../stream';
export interface BaseStreamParserContextOptions extends BaseSyncParserContextOptions {
    onParse: (node: SerovalNode, initial: boolean) => void;
    onError?: (error: unknown) => void;
    onDone?: () => void;
}
export default abstract class BaseStreamParserContext extends BaseSyncParserContext {
    private alive;
    private pending;
    private onParseCallback;
    private onErrorCallback?;
    private onDoneCallback?;
    constructor(options: BaseStreamParserContextOptions);
    private initial;
    private buffer;
    private onParseInternal;
    private flush;
    private onParse;
    private onError;
    private onDone;
    private pushPendingState;
    private popPendingState;
    protected parseProperties(properties: Record<string | symbol, unknown>): SerovalObjectRecordNode;
    protected parsePromise(id: number, current: Promise<unknown>): SerovalPromiseConstructorNode;
    protected parsePlugin(id: number, current: unknown): SerovalPluginNode | undefined;
    protected parseStream(id: number, current: Stream<unknown>): SerovalNode;
    private parseWithError;
    /**
     * @private
     */
    start<T>(current: T): void;
    /**
     * @private
     */
    destroy(): void;
    isAlive(): boolean;
}
//# sourceMappingURL=stream.d.ts.map