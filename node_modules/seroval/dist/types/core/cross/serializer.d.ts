import type { SerovalNode } from '../types';
import type { BaseSerializerContextOptions } from '../context/serializer';
import BaseSerializerContext from '../context/serializer';
import type { SerovalMode } from '../plugin';
import type { CrossContextOptions } from './parser';
export interface CrossSerializerContextOptions extends BaseSerializerContextOptions, CrossContextOptions {
}
export default class CrossSerializerContext extends BaseSerializerContext {
    readonly mode: SerovalMode;
    scopeId?: string;
    constructor(options: CrossSerializerContextOptions);
    getRefParam(id: number): string;
    protected assignIndexedValue(index: number, value: string): string;
    serializeTop(tree: SerovalNode): string;
}
//# sourceMappingURL=serializer.d.ts.map