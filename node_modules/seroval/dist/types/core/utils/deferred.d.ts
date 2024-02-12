export interface Deferred {
    promise: Promise<unknown>;
    resolve(value: unknown): void;
    reject(value: unknown): void;
}
export declare function createDeferred(): Deferred;
//# sourceMappingURL=deferred.d.ts.map