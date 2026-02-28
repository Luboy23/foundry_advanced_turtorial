// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {LLCAirDrop} from "../src/LLCAirDrop.sol";
import {LuLuCoin} from "../src/LuLuCoin.sol";
import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";

contract LLCAirDropTest is Test {
    LLCAirDrop airdrop;
    LuLuCoin llc;
    address owner;
    address user1;
    address user2;

    uint256 user1_airdrop_amount = 10 * 1e18; // 10 LLC (18 decimals)
    uint256 user2_airdrop_amount = 100 * 1e18; // 100 LLC (18 decimals)
    uint256 totalAmount = 1000 * 1e18; // Total seeded balance

    // Generated via `node contracts/script/generate_test_merkle.js`.
    // Proofs correspond to test_claimers indices 0 (user1) and 1 (user2).
    bytes32 merkleRoot =0x6850843d6919baad9651497d3e155c499a0f4659816bc1835a75a9cf84c17387;
    bytes32[] user1_proof = [bytes32(0x687416b9620fdfffbc03f1d9ed74447f5385b296239ae04fd587ec81529e3742)];
    bytes32[] user2_proof = [bytes32(0x50b63efa26465f52c21d33bcaef779d44fc14fa2876d72b749cfde3e959244cc)];

    function setUp() public {
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        llc = new LuLuCoin(owner);
        airdrop = new LLCAirDrop(merkleRoot, llc);

        vm.startPrank(owner);
        llc.mint(totalAmount);
        llc.transfer(address(airdrop), totalAmount);
        vm.stopPrank();

        console.log("user1 address", user1);
        console.log("user2 address", user2);
    }

    function testUser1CanClaim() public {
        uint256 startBalance = llc.balanceOf(user1);
        airdrop.claim(user1, user1_airdrop_amount, user1_proof);
        uint256 endBalance = llc.balanceOf(user1);

        assertEq(startBalance, 0);
        assertEq(endBalance, user1_airdrop_amount);
        assertTrue(airdrop.getClaimState(user1));
    }

    function testUserCannotClaimTwice() public {
        airdrop.claim(user1, user1_airdrop_amount, user1_proof);

        vm.expectRevert();
        airdrop.claim(user1, user1_airdrop_amount, user1_proof);
    }

    function testClaimWithInvalidProofFailed() public {
        bytes32[] memory wrongProof = new bytes32[] (1);
        wrongProof[0] = bytes32(uint256(0x11111));

        vm.expectRevert();
        airdrop.claim(user1, user1_airdrop_amount, wrongProof);
    }

    function testInsufficientContractBalance() public {
        vm.prank(address(airdrop));
        llc.transfer(owner, totalAmount);

        vm.expectRevert();
        airdrop.claim(user1, user1_airdrop_amount, user1_proof);
    }

}
