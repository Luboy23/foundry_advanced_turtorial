// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

library MerkleProofLib {
    function verify(bytes32[] calldata proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        bytes32 computedHash = leaf;
        uint256 proofLength = proof.length;

        for (uint256 index = 0; index < proofLength; index++) {
            bytes32 proofElement = proof[index];
            computedHash = computedHash <= proofElement
                ? keccak256(abi.encodePacked(computedHash, proofElement))
                : keccak256(abi.encodePacked(proofElement, computedHash));
        }

        return computedHash == root;
    }
}
