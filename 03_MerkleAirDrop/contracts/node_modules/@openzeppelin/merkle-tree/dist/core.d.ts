import { BytesLike, HexString } from './bytes';
import { NodeHash } from './hashes';
export declare function makeMerkleTree(leaves: BytesLike[], nodeHash?: NodeHash): HexString[];
export declare function getProof(tree: BytesLike[], index: number): HexString[];
export declare function processProof(leaf: BytesLike, proof: BytesLike[], nodeHash?: NodeHash): HexString;
export interface MultiProof<T, L = T> {
    leaves: L[];
    proof: T[];
    proofFlags: boolean[];
}
export declare function getMultiProof(tree: BytesLike[], indices: number[]): MultiProof<HexString>;
export declare function processMultiProof(multiproof: MultiProof<BytesLike>, nodeHash?: NodeHash): HexString;
export declare function isValidMerkleTree(tree: BytesLike[], nodeHash?: NodeHash): boolean;
export declare function renderMerkleTree(tree: BytesLike[]): HexString;
//# sourceMappingURL=core.d.ts.map