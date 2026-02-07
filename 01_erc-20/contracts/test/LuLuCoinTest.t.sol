// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {LuLuCoin} from "../src/LuLuCoin.sol";

/// @notice Tests for LuLuCoin owner-only mint/burn behavior.
contract LuLuCoinTest is Test {
    LuLuCoin public llc;

    address owner = vm.addr(1);
    address user = vm.addr(2);

    /// @dev Deploys the token and seeds the owner with ETH for transactions.
    function setUp() public {
        llc = new LuLuCoin(owner);
        vm.deal(owner, 10 ether);
    }

    /// @notice Owner can mint tokens.
    function testSuccessIfOwnerMint() public {
        vm.startPrank(owner);
        llc.mint(10 ether);
        vm.stopPrank();

        assertEq(llc.balanceOf(owner), 10 ether);
    }

    /// @notice Non-owner cannot mint tokens.
    /// @dev Expects revert from Ownable.
    function testRevertIfUserMint() public {
        vm.startPrank(user);
        vm.expectRevert();
        llc.mint(10 ether);
        vm.stopPrank();

        assertEq(llc.balanceOf(user), 0 ether);
    }

    /// @notice Owner can burn tokens.
    function testSuccessIfOwnerBurn() public {
        vm.startPrank(owner);
        llc.mint(10 ether);
        vm.stopPrank();

        assertEq(llc.balanceOf(owner), 10 ether);

        vm.startPrank(owner);
        llc.burn(5 ether);
        vm.stopPrank();

        assertEq(llc.balanceOf(owner), 5 ether);
    }

    /// @notice Non-owner cannot burn tokens.
    /// @dev Expects revert from Ownable.
    function testRevertIfUserBurn() public {
        vm.startPrank(owner);
        llc.mint(10 ether);
        vm.stopPrank();

        assertEq(llc.balanceOf(owner), 10 ether);

        vm.startPrank(user);
        vm.expectRevert();
        llc.burn(5 ether);
        vm.stopPrank();

        assertEq(llc.balanceOf(owner), 10 ether);
        assertEq(llc.balanceOf(user), 0 ether);
    }
}
