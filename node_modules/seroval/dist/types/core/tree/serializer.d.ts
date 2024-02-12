import type { SerovalNode, SerovalPromiseConstructorNode, SerovalPromiseRejectNode, SerovalPromiseResolveNode } from '../types';
import type { BaseSerializerContextOptions } from '../context/serializer';
import BaseSerializerContext from '../context/serializer';
import type { SerovalMode } from '../plugin';
export type VanillaSerializerContextOptions = BaseSerializerContextOptions;
export default class VanillaSerializerContext extends BaseSerializerContext {
    readonly mode: SerovalMode;
    /**
     * Map tree refs to actual refs
     * @private
     */
    valid: Map<number, number>;
    /**
     * Variables
     * @private
     */
    vars: string[];
    /**
     * Creates the reference param (identifier) from the given reference ID
     * Calling this function means the value has been referenced somewhere
     */
    getRefParam(index: number): string;
    protected assignIndexedValue(index: number, value: string): string;
    protected serializePromiseConstructor(node: SerovalPromiseConstructorNode): string;
    protected serializePromiseResolve(node: SerovalPromiseResolveNode): string;
    protected serializePromiseReject(node: SerovalPromiseRejectNode): string;
    serializeTop(tree: SerovalNode): string;
}
//# sourceMappingURL=serializer.d.ts.map