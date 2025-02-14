export declare function throwError(message?: string): never;
export declare class InvariantError extends Error {
    constructor(message?: string);
}
export declare class InvalidArgumentError extends Error {
    constructor(message?: string);
}
export declare function validateArgument(condition: unknown, message?: string): asserts condition;
export declare function invariant(condition: unknown, message?: string): asserts condition;
//# sourceMappingURL=errors.d.ts.map