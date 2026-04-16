// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IAgeCredentialRootRegistry {
    struct AgeCredentialSet {
        bytes32 setId;
        uint256 merkleRoot;
        uint32 version;
        uint64 referenceDate;
        address issuer;
        uint64 updatedAt;
        bool active;
    }

    function getCredentialSet(bytes32 setId) external view returns (AgeCredentialSet memory);
    function getCurrentCredentialSet() external view returns (AgeCredentialSet memory);
}
