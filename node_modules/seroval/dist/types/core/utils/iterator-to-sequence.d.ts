export interface Sequence {
    v: unknown[];
    t: number;
    d: number;
}
export declare function iteratorToSequence<T>(source: Iterable<T>): Sequence;
export declare function sequenceToIterator<T>(sequence: Sequence): () => IterableIterator<T>;
//# sourceMappingURL=iterator-to-sequence.d.ts.map