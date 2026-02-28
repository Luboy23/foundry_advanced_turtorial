import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

const anvil_claimers = [
    ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "5000000000000000000"],
    ["0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "100000000000000000000"],
    ["0x90F79bf6EB2c4f870365E785982E1f101E93b906","5000000000000000000"]
];

const anvil_tree = StandardMerkleTree.of(anvil_claimers, ["address", "uint256"]);

console.log("Merkle Root:" , anvil_tree.root);
console.log("User1 Merkle Proof:" , anvil_tree.getProof(0));
console.log("User2 Merkle Proof:" , anvil_tree.getProof(1));
console.log("User3 Merkle Proof:" , anvil_tree.getProof(2));


