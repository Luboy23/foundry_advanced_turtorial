"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compare = exports.concat = exports.toHex = exports.toBytes = void 0;
const bytes_1 = require("@ethersproject/bytes");
Object.defineProperty(exports, "toBytes", { enumerable: true, get: function () { return bytes_1.arrayify; } });
Object.defineProperty(exports, "toHex", { enumerable: true, get: function () { return bytes_1.hexlify; } });
Object.defineProperty(exports, "concat", { enumerable: true, get: function () { return bytes_1.concat; } });
function compare(a, b) {
    const diff = BigInt((0, bytes_1.hexlify)(a)) - BigInt((0, bytes_1.hexlify)(b));
    return diff > 0 ? 1 : diff < 0 ? -1 : 0;
}
exports.compare = compare;
//# sourceMappingURL=bytes.js.map