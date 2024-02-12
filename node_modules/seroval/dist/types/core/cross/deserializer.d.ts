import BaseDeserializerContext from '../context/deserializer';
import type { BaseDeserializerOptions } from '../context/deserializer';
import type { SerovalMode } from '../plugin';
export type CrossDeserializerContextOptions = BaseDeserializerOptions;
export default class CrossDeserializerContext extends BaseDeserializerContext {
    readonly mode: SerovalMode;
    assignIndexedValue<T>(index: number, value: T): T;
}
//# sourceMappingURL=deserializer.d.ts.map