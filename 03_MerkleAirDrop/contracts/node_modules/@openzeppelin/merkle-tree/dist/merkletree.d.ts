import { BytesLike, HexString } from './bytes';
import { MultiProof } from './core';
import { LeafHash, NodeHash } from './hashes';
export interface MerkleTreeData<T> {
    format: string;
    tree: HexString[];
    values: {
        value: T;
        treeIndex: number;
    }[];
}
export interface MerkleTree<T> {
    root: HexString;
    length: number;
    at(index: number): T | undefined;
    render(): string;
    dump(): MerkleTreeData<T>;
    entries(): Iterable<[number, T]>;
    validate(): void;
    leafHash(leaf: T): HexString;
    leafLookup(leaf: T): number;
    getProof(leaf: number | T): HexString[];
    getMultiProof(leaves: (number | T)[]): MultiProof<HexString, T>;
    verify(leaf: number | T, proof: HexString[]): boolean;
    verifyMultiProof(multiproof: MultiProof<BytesLike, number | T>): boolean;
}
export declare abstract class MerkleTreeImpl<T> implements MerkleTree<T> {
    protected readonly tree: HexString[];
    protected readonly values: MerkleTreeData<T>['values'];
    readonly leafHash: LeafHash<T>;
    protected readonly nodeHash?: NodeHash | undefined;
    private readonly hashLookup;
    protected constructor(tree: HexString[], values: MerkleTreeData<T>['values'], leafHash: LeafHash<T>, nodeHash?: NodeHash | undefined);
    protected static prepare<T>(values: T[], options: Partial<{
        sortLeaves: boolean;
    }> | undefined, leafHash: LeafHash<T>, nodeHash?: NodeHash): [tree: HexString[], indexedValues: MerkleTreeData<T>['values']];
    get root(): HexString;
    get length(): number;
    at(index: number): T | undefined;
    abstract dump(): MerkleTreeData<T>;
    render(): string;
    entries(): Iterable<[number, T]>;
    validate(): void;
    leafLookup(leaf: T): number;
    getProof(leaf: number | T): HexString[];
    getMultiProof(leaves: (number | T)[]): MultiProof<HexString, T>;
    verify(leaf: number | T, proof: HexString[]): boolean;
    verifyMultiProof(multiproof: MultiProof<BytesLike, number | T>): boolean;
    private _validateValueAt;
    private _leafHash;
    private _verify;
    private _verifyMultiProof;
}
//# sourceMappingURL=merkletree.d.ts.map