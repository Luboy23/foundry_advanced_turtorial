"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerkleTreeImpl = void 0;
const bytes_1 = require("./bytes");
const core_1 = require("./core");
const options_1 = require("./options");
const errors_1 = require("./utils/errors");
class MerkleTreeImpl {
    constructor(tree, values, leafHash, nodeHash) {
        this.tree = tree;
        this.values = values;
        this.leafHash = leafHash;
        this.nodeHash = nodeHash;
        (0, errors_1.validateArgument)(values.every(({ value }) => typeof value != 'number'), 'Leaf values cannot be numbers');
        this.hashLookup = Object.fromEntries(values.map(({ treeIndex }, valueIndex) => [tree[treeIndex], valueIndex]));
    }
    static prepare(values, options = {}, leafHash, nodeHash) {
        const sortLeaves = options.sortLeaves ?? options_1.defaultOptions.sortLeaves;
        const hashedValues = values.map((value, valueIndex) => ({
            value,
            valueIndex,
            hash: leafHash(value),
        }));
        if (sortLeaves) {
            hashedValues.sort((a, b) => (0, bytes_1.compare)(a.hash, b.hash));
        }
        const tree = (0, core_1.makeMerkleTree)(hashedValues.map(v => v.hash), nodeHash);
        const indexedValues = values.map(value => ({ value, treeIndex: 0 }));
        for (const [leafIndex, { valueIndex }] of hashedValues.entries()) {
            indexedValues[valueIndex].treeIndex = tree.length - leafIndex - 1;
        }
        return [tree, indexedValues];
    }
    get root() {
        return this.tree[0];
    }
    get length() {
        return this.values.length;
    }
    at(index) {
        return this.values.at(index)?.value;
    }
    render() {
        return (0, core_1.renderMerkleTree)(this.tree);
    }
    *entries() {
        for (const [i, { value }] of this.values.entries()) {
            yield [i, value];
        }
    }
    validate() {
        this.values.forEach((_, i) => this._validateValueAt(i));
        (0, errors_1.invariant)((0, core_1.isValidMerkleTree)(this.tree, this.nodeHash), 'Merkle tree is invalid');
    }
    leafLookup(leaf) {
        const lookup = this.hashLookup[this.leafHash(leaf)];
        (0, errors_1.validateArgument)(typeof lookup !== 'undefined', 'Leaf is not in tree');
        return lookup;
    }
    getProof(leaf) {
        // input validity
        const valueIndex = typeof leaf === 'number' ? leaf : this.leafLookup(leaf);
        this._validateValueAt(valueIndex);
        // rebuild tree index and generate proof
        const { treeIndex } = this.values[valueIndex];
        const proof = (0, core_1.getProof)(this.tree, treeIndex);
        // sanity check proof
        (0, errors_1.invariant)(this._verify(this.tree[treeIndex], proof), 'Unable to prove value');
        // return proof in hex format
        return proof;
    }
    getMultiProof(leaves) {
        // input validity
        const valueIndices = leaves.map(leaf => (typeof leaf === 'number' ? leaf : this.leafLookup(leaf)));
        for (const valueIndex of valueIndices) {
            this._validateValueAt(valueIndex);
        }
        // rebuild tree indices and generate proof
        const indices = valueIndices.map(i => this.values[i].treeIndex);
        const proof = (0, core_1.getMultiProof)(this.tree, indices);
        // sanity check proof
        (0, errors_1.invariant)(this._verifyMultiProof(proof), 'Unable to prove values');
        // return multiproof in hex format
        return {
            leaves: proof.leaves.map(hash => this.values[this.hashLookup[hash]].value),
            proof: proof.proof,
            proofFlags: proof.proofFlags,
        };
    }
    verify(leaf, proof) {
        return this._verify(this._leafHash(leaf), proof);
    }
    verifyMultiProof(multiproof) {
        return this._verifyMultiProof({
            leaves: multiproof.leaves.map(l => this._leafHash(l)),
            proof: multiproof.proof,
            proofFlags: multiproof.proofFlags,
        });
    }
    _validateValueAt(index) {
        const value = this.values[index];
        (0, errors_1.validateArgument)(value !== undefined, 'Index out of bounds');
        (0, errors_1.invariant)(this.tree[value.treeIndex] === this.leafHash(value.value), 'Merkle tree does not contain the expected value');
    }
    _leafHash(leaf) {
        if (typeof leaf === 'number') {
            const lookup = this.values[leaf];
            (0, errors_1.validateArgument)(lookup !== undefined, 'Index out of bounds');
            leaf = lookup.value;
        }
        return this.leafHash(leaf);
    }
    _verify(leafHash, proof) {
        return this.root === (0, core_1.processProof)(leafHash, proof, this.nodeHash);
    }
    _verifyMultiProof(multiproof) {
        return this.root === (0, core_1.processMultiProof)(multiproof, this.nodeHash);
    }
}
exports.MerkleTreeImpl = MerkleTreeImpl;
//# sourceMappingURL=merkletree.js.map