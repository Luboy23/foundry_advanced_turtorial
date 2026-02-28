// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title LLCAirDrop
/// @notice Merkle-based airdrop for LuLuCoin.
contract LLCAirDrop {
    using SafeERC20 for IERC20;

    event LLCAirDrop__Claimed(address account, uint256 amount);

    error LLCAirDrop__InvaildAmount();
    error LLCAirDrop__AlreadyClaimed();
    error LLCAirDrop__InvalidProof();

    IERC20 public immutable lulucoin;
    bytes32 private immutable merkleRoot;
    mapping(address => bool) public hasClaimed;

    constructor(bytes32 _merkleRoot, IERC20 _tokenAddress) {
        merkleRoot = _merkleRoot;
        lulucoin = _tokenAddress;
    }

    /// @notice Claim airdropped tokens for an account using a Merkle proof.
    /// @dev The account can differ from msg.sender to allow third-party claims.
    /// @param account Recipient address included in the Merkle tree.
    /// @param amount Token amount in the smallest unit.
    /// @param merkleProof Proof for the (account, amount) leaf; must match off-chain tree generation.
    function claim(address account, uint256 amount, bytes32[] calldata merkleProof) external {
        if (amount == 0 || lulucoin.balanceOf(address(this)) < amount) {
            revert LLCAirDrop__InvaildAmount();
        }

        if (hasClaimed[account]) {
            revert LLCAirDrop__AlreadyClaimed();
        }

        // Keep leaf hashing consistent with the off-chain Merkle tree scripts.
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(account, amount))));

        if (!MerkleProof.verify(merkleProof, merkleRoot, leaf)) {
            revert LLCAirDrop__InvalidProof();
        }

        emit LLCAirDrop__Claimed(account, amount);
        lulucoin.safeTransfer(account, amount);
        hasClaimed[account] = true;
    }

    function getMerkleRoot() external view returns (bytes32) {
        return merkleRoot;
    }

    function getAirDropTokenAddress() external view returns (IERC20) {
        return lulucoin;
    }

    function getClaimState(address account) external view returns (bool) {
        return hasClaimed[account];
    }
}
