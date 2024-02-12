import BaseDeserializerContext from '../context/deserializer';
import type { BaseDeserializerOptions } from '../context/deserializer';
import type { SerovalMode } from '../plugin';
export interface VanillaDeserializerContextOptions extends Omit<BaseDeserializerOptions, 'refs'> {
    markedRefs: number[] | Set<number>;
}
export default class VanillaDeserializerContext extends BaseDeserializerContext {
    readonly mode: SerovalMode;
    marked: Set<number>;
    constructor(options: VanillaDeserializerContextOptions);
    assignIndexedValue<T>(index: number, value: T): T;
}
//# sourceMappingURL=deserializer.d.ts.map