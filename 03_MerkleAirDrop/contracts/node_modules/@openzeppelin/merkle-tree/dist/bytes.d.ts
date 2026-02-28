import type { BytesLike } from '@ethersproject/bytes';
type HexString = string;
import { arrayify as toBytes, hexlify as toHex, concat } from '@ethersproject/bytes';
declare function compare(a: BytesLike, b: BytesLike): number;
export type { HexString, BytesLike };
export { toBytes, toHex, concat, compare };
//# sourceMappingURL=bytes.d.ts.map