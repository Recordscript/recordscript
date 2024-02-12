import { SerovalObjectFlags } from '../constants';
import type { Plugin, PluginAccessOptions, SerovalMode } from '../plugin';
import type { SerovalArrayNode, SerovalNode, SerovalObjectRecordKey, SerovalObjectRecordNode, SerovalReferenceNode, SerovalObjectNode, SerovalNullConstructorNode, SerovalRegExpNode, SerovalDateNode, SerovalSetNode, SerovalMapNode, SerovalArrayBufferNode, SerovalTypedArrayNode, SerovalBigIntTypedArrayNode, SerovalDataViewNode, SerovalAggregateErrorNode, SerovalErrorNode, SerovalPromiseNode, SerovalWKSymbolNode, SerovalBoxedNode, SerovalPluginNode, SerovalPromiseConstructorNode, SerovalPromiseResolveNode, SerovalPromiseRejectNode, SerovalIteratorFactoryInstanceNode, SerovalIteratorFactoryNode, SerovalAsyncIteratorFactoryInstanceNode, SerovalAsyncIteratorFactoryNode, SerovalSpecialReferenceNode, SerovalStreamConstructorNode, SerovalStreamNextNode, SerovalStreamThrowNode, SerovalStreamReturnNode } from '../types';
declare const enum AssignmentType {
    Index = 0,
    Add = 1,
    Set = 2,
    Delete = 3
}
interface IndexAssignment {
    t: AssignmentType.Index;
    s: string;
    k: undefined;
    v: string;
}
interface SetAssignment {
    t: AssignmentType.Set;
    s: string;
    k: string;
    v: string;
}
interface AddAssignment {
    t: AssignmentType.Add;
    s: string;
    k: undefined;
    v: string;
}
interface DeleteAssignment {
    t: AssignmentType.Delete;
    s: string;
    k: string;
    v: undefined;
}
type Assignment = IndexAssignment | AddAssignment | SetAssignment | DeleteAssignment;
export interface FlaggedObject {
    type: SerovalObjectFlags;
    value: string;
}
type SerovalNodeWithProperties = SerovalObjectNode | SerovalNullConstructorNode | SerovalAggregateErrorNode | SerovalErrorNode;
export interface BaseSerializerContextOptions extends PluginAccessOptions {
    features: number;
    markedRefs: number[] | Set<number>;
}
export default abstract class BaseSerializerContext implements PluginAccessOptions {
    /**
     * @private
     */
    features: number;
    /**
     * To check if an object is synchronously referencing itself
     * @private
     */
    stack: number[];
    /**
     * Array of object mutations
     * @private
     */
    flags: FlaggedObject[];
    /**
     * Array of assignments to be done (used for recursion)
     * @private
     */
    assignments: Assignment[];
    plugins?: Plugin<any, any>[] | undefined;
    /**
     * Refs that are...referenced
     * @private
     */
    marked: Set<number>;
    constructor(options: BaseSerializerContextOptions);
    abstract readonly mode: SerovalMode;
    createFunction(parameters: string[], body: string): string;
    createEffectfulFunction(parameters: string[], body: string): string;
    /**
     * A tiny function that tells if a reference
     * is to be accessed. This is a requirement for
     * deciding whether or not we should generate
     * an identifier for the object
     */
    protected markRef(id: number): void;
    protected isMarked(id: number): boolean;
    /**
     * Converts the ID of a reference into a identifier string
     * that is used to refer to the object instance in the
     * generated script.
     */
    abstract getRefParam(id: number): string;
    protected pushObjectFlag(flag: SerovalObjectFlags, id: number): void;
    private resolveFlags;
    protected resolvePatches(): string | undefined;
    /**
     * Generates the inlined assignment for the reference
     * This is different from the assignments array as this one
     * signifies creation rather than mutation
     */
    protected createAssignment(source: string, value: string): void;
    protected createAddAssignment(ref: number, value: string): void;
    protected createSetAssignment(ref: number, key: string, value: string): void;
    protected createDeleteAssignment(ref: number, key: string): void;
    protected createArrayAssign(ref: number, index: number | string, value: string): void;
    protected createObjectAssign(ref: number, key: string, value: string): void;
    /**
     * Checks if the value is in the stack. Stack here is a reference
     * structure to know if a object is to be accessed in a TDZ.
     */
    isIndexedValueInStack(node: SerovalNode): boolean;
    /**
     * Produces an assignment expression. `id` generates a reference
     * parameter (through `getRefParam`) and has the option to
     * return the reference parameter directly or assign a value to
     * it.
     */
    protected abstract assignIndexedValue(id: number, value: string): string;
    protected serializeReference(node: SerovalReferenceNode): string;
    protected serializeArrayItem(id: number, item: SerovalNode | undefined, index: number): string;
    protected serializeArray(node: SerovalArrayNode): string;
    protected serializeProperty(source: SerovalNodeWithProperties, key: SerovalObjectRecordKey, val: SerovalNode): string;
    protected serializeProperties(source: SerovalNodeWithProperties, record: SerovalObjectRecordNode): string;
    protected serializeObject(node: SerovalObjectNode): string;
    protected serializeWithObjectAssign(source: SerovalNodeWithProperties, value: SerovalObjectRecordNode, serialized: string): string;
    private serializeStringKeyAssignment;
    protected serializeAssignment(source: SerovalNodeWithProperties, mainAssignments: Assignment[], key: SerovalObjectRecordKey, value: SerovalNode): void;
    protected serializeAssignments(source: SerovalNodeWithProperties, node: SerovalObjectRecordNode): string | undefined;
    protected serializeDictionary(node: SerovalNodeWithProperties, init: string): string;
    protected serializeNullConstructor(node: SerovalNullConstructorNode): string;
    protected serializeDate(node: SerovalDateNode): string;
    protected serializeRegExp(node: SerovalRegExpNode): string;
    protected serializeSetItem(id: number, item: SerovalNode): string;
    protected serializeSet(node: SerovalSetNode): string;
    protected serializeMapEntry(id: number, key: SerovalNode, val: SerovalNode, sentinel: string): string;
    protected serializeMap(node: SerovalMapNode): string;
    protected serializeArrayBuffer(node: SerovalArrayBufferNode): string;
    protected serializeTypedArray(node: SerovalTypedArrayNode | SerovalBigIntTypedArrayNode): string;
    protected serializeDataView(node: SerovalDataViewNode): string;
    protected serializeAggregateError(node: SerovalAggregateErrorNode): string;
    protected serializeError(node: SerovalErrorNode): string;
    protected serializePromise(node: SerovalPromiseNode): string;
    protected serializeWellKnownSymbol(node: SerovalWKSymbolNode): string;
    protected serializeBoxed(node: SerovalBoxedNode): string;
    protected serializePlugin(node: SerovalPluginNode): string;
    private getConstructor;
    protected serializePromiseConstructor(node: SerovalPromiseConstructorNode): string;
    protected serializePromiseResolve(node: SerovalPromiseResolveNode): string;
    protected serializePromiseReject(node: SerovalPromiseRejectNode): string;
    private serializeSpecialReferenceValue;
    protected serializeSpecialReference(node: SerovalSpecialReferenceNode): string;
    protected serializeIteratorFactory(node: SerovalIteratorFactoryNode): string;
    protected serializeIteratorFactoryInstance(node: SerovalIteratorFactoryInstanceNode): string;
    protected serializeAsyncIteratorFactory(node: SerovalAsyncIteratorFactoryNode): string;
    protected serializeAsyncIteratorFactoryInstance(node: SerovalAsyncIteratorFactoryInstanceNode): string;
    protected serializeStreamConstructor(node: SerovalStreamConstructorNode): string;
    protected serializeStreamNext(node: SerovalStreamNextNode): string;
    protected serializeStreamThrow(node: SerovalStreamThrowNode): string;
    protected serializeStreamReturn(node: SerovalStreamReturnNode): string;
    serialize(node: SerovalNode): string;
}
export {};
//# sourceMappingURL=serializer.d.ts.map