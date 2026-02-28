import { BytesLike, HexString } from './bytes';
import { MultiProof } from './core';
import { MerkleTreeData, MerkleTreeImpl } from './merkletree';
import { MerkleTreeOptions } from './options';
import { NodeHash } from './hashes';
export interface SimpleMerkleTreeData extends MerkleTreeData<HexString> {
    format: 'simple-v1';
    hash?: 'custom';
}
export interface SimpleMerkleTreeOptions extends MerkleTreeOptions {
    nodeHash?: NodeHash;
}
export declare function formatLeaf(value: BytesLike): HexString;
export declare class SimpleMerkleTree extends MerkleTreeImpl<BytesLike> {
    static of(values: BytesLike[], options?: SimpleMerkleTreeOptions): SimpleMerkleTree;
    static load(data: SimpleMerkleTreeData, nodeHash?: NodeHash): SimpleMerkleTree;
    static verify(root: BytesLike, leaf: BytesLike, proof: BytesLike[], nodeHash?: NodeHash): boolean;
    static verifyMultiProof(root: BytesLike, multiproof: MultiProof<BytesLike, BytesLike>, nodeHash?: NodeHash): boolean;
    dump(): SimpleMerkleTreeData;
}
//# sourceMappingURL=simple.d.ts.map