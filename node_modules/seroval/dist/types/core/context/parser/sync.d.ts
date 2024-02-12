import type { BaseParserContextOptions } from '../parser';
import { BaseParserContext } from '../parser';
import type { SerovalBoxedNode, SerovalArrayNode, SerovalNode, SerovalNullConstructorNode, SerovalObjectNode, SerovalObjectRecordNode, SerovalErrorNode, SerovalMapNode, SerovalSetNode, SerovalPluginNode, SerovalAggregateErrorNode, SerovalTypedArrayNode, SerovalBigIntTypedArrayNode, SerovalDataViewNode, SerovalPromiseConstructorNode } from '../../types';
import type { Stream } from '../../stream';
import type { BigIntTypedArrayValue, TypedArrayValue } from '../../utils/typed-array';
type ObjectLikeNode = SerovalObjectNode | SerovalNullConstructorNode;
export type BaseSyncParserContextOptions = BaseParserContextOptions;
export default abstract class BaseSyncParserContext extends BaseParserContext {
    protected parseItems(current: unknown[]): SerovalNode[];
    protected parseArray(id: number, current: unknown[]): SerovalArrayNode;
    protected parseProperties(properties: Record<string | symbol, unknown>): SerovalObjectRecordNode;
    protected parsePlainObject(id: number, current: Record<string, unknown>, empty: boolean): ObjectLikeNode;
    protected parseBoxed(id: number, current: object): SerovalBoxedNode;
    protected parseTypedArray(id: number, current: TypedArrayValue): SerovalTypedArrayNode;
    protected parseBigIntTypedArray(id: number, current: BigIntTypedArrayValue): SerovalBigIntTypedArrayNode;
    protected parseDataView(id: number, current: DataView): SerovalDataViewNode;
    protected parseError(id: number, current: Error): SerovalErrorNode;
    protected parseAggregateError(id: number, current: AggregateError): SerovalAggregateErrorNode;
    protected parseMap(id: number, current: Map<unknown, unknown>): SerovalMapNode;
    protected parseSet(id: number, current: Set<unknown>): SerovalSetNode;
    protected parsePlugin(id: number, current: unknown): SerovalPluginNode | undefined;
    protected parseStream(id: number, _current: Stream<unknown>): SerovalNode;
    protected parsePromise(id: number, _current: Promise<unknown>): SerovalPromiseConstructorNode;
    protected parseObject(id: number, current: object): SerovalNode;
    parse<T>(current: T): SerovalNode;
}
export {};
//# sourceMappingURL=sync.d.ts.map