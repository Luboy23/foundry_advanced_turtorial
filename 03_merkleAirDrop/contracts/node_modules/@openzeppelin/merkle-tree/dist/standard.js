"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandardMerkleTree = void 0;
const bytes_1 = require("./bytes");
const core_1 = require("./core");
const merkletree_1 = require("./merkletree");
const hashes_1 = require("./hashes");
const errors_1 = require("./utils/errors");
class StandardMerkleTree extends merkletree_1.MerkleTreeImpl {
    constructor(tree, values, leafEncoding) {
        super(tree, values, leaf => (0, hashes_1.standardLeafHash)(leafEncoding, leaf));
        this.tree = tree;
        this.values = values;
        this.leafEncoding = leafEncoding;
    }
    static of(values, leafEncoding, options = {}) {
        // use default nodeHash (standardNodeHash)
        const [tree, indexedValues] = merkletree_1.MerkleTreeImpl.prepare(values, options, leaf => (0, hashes_1.standardLeafHash)(leafEncoding, leaf));
        return new StandardMerkleTree(tree, indexedValues, leafEncoding);
    }
    static load(data) {
        (0, errors_1.validateArgument)(data.format === 'standard-v1', `Unknown format '${data.format}'`);
        (0, errors_1.validateArgument)(data.leafEncoding !== undefined, 'Expected leaf encoding');
        const tree = new StandardMerkleTree(data.tree, data.values, data.leafEncoding);
        tree.validate();
        return tree;
    }
    static verify(root, leafEncoding, leaf, proof) {
        // use default nodeHash (standardNodeHash) for processProof
        return (0, bytes_1.toHex)(root) === (0, core_1.processProof)((0, hashes_1.standardLeafHash)(leafEncoding, leaf), proof);
    }
    static verifyMultiProof(root, leafEncoding, multiproof) {
        // use default nodeHash (standardNodeHash) for processMultiProof
        return ((0, bytes_1.toHex)(root) ===
            (0, core_1.processMultiProof)({
                leaves: multiproof.leaves.map(leaf => (0, hashes_1.standardLeafHash)(leafEncoding, leaf)),
                proof: multiproof.proof,
                proofFlags: multiproof.proofFlags,
            }));
    }
    dump() {
        return {
            format: 'standard-v1',
            leafEncoding: this.leafEncoding,
            tree: this.tree,
            values: this.values,
        };
    }
}
exports.StandardMerkleTree = StandardMerkleTree;
//# sourceMappingURL=standard.js.map