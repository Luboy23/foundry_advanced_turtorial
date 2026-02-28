"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invariant = exports.validateArgument = exports.InvalidArgumentError = exports.InvariantError = exports.throwError = void 0;
function throwError(message) {
    throw new Error(message);
}
exports.throwError = throwError;
class InvariantError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvariantError';
    }
}
exports.InvariantError = InvariantError;
class InvalidArgumentError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidArgumentError';
    }
}
exports.InvalidArgumentError = InvalidArgumentError;
function validateArgument(condition, message) {
    if (!condition) {
        throw new InvalidArgumentError(message);
    }
}
exports.validateArgument = validateArgument;
function invariant(condition, message) {
    if (!condition) {
        throw new InvariantError(message);
    }
}
exports.invariant = invariant;
//# sourceMappingURL=errors.js.map