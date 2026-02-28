import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

const test_claimers = [
    ["0x29E3b139f4393aDda86303fcdAa35F60Bb7092bF", "10000000000000000000"],
    ["0x537C8f3d3E18dF5517a58B3fB9D9143697996802", "100000000000000000000"]
];

const test_tree = StandardMerkleTree.of(test_claimers, ["address", "uint256"]);

console.log("Merkle Root:" , test_tree.root);
console.log("User1 Merkle Proof:" , test_tree.getProof(0));
console.log("User2 Merkle Proof:" , test_tree.getProof(1));
