// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {LuLuCoin} from "../src/LuLuCoin.sol";
import {LLCFaucet} from "../src/LLCFaucet.sol";

/// @notice LLCFaucet 行为测试：权限、间隔、限额与余额约束
contract LLCFaucetTest is Test {
    LuLuCoin public llc;
    LLCFaucet public faucet;
    address owner = vm.addr(1);
    address user = vm.addr(2);
    uint256 dripInterval = 10 seconds;
    uint256 public dripLimit = 100;

    /// @dev 管理员存入代币并推进时间，作为测试前置条件
    modifier ownerDeposit() {
        vm.startPrank(owner);
        llc.approve(address(faucet), 1_000);
        faucet.deposit(1_000);
        vm.stopPrank();

        vm.warp(block.timestamp + dripInterval);

        _;
    }

    /// @dev 部署合约、分配 ETH、为 owner 铸币
    function setUp() public {
        llc = new LuLuCoin(owner);
        faucet = new LLCFaucet(address(llc), dripInterval, dripLimit, owner);

        vm.deal(owner, 1_000 ether);
        vm.deal(user, 1_000 ether);

        vm.prank(owner);
        llc.mint(1_000);
    }

    /// @notice 仅管理员可成功设置领取上限
    function testSuccessIfOwnerSetDripLimit() public {
        uint256 newLimit = 200;

        vm.startPrank(owner);
        faucet.setDripLimit(newLimit);
        vm.stopPrank();

        assertEq(newLimit, faucet.getDripLimit());
    }

    /// @notice 仅管理员可成功设置领取间隔
    function testSuccessIfOwnerSetDripInterval() public {
        uint256 newInterval = 20 seconds;

        vm.startPrank(owner);
        faucet.setDripInterval(newInterval);
        vm.stopPrank();

        assertEq(newInterval, faucet.getDripInterval());
    }

    /// @notice 仅管理员可成功更新代币地址
    function testSuccessIfOwnerSetTokenAddress() public {
        address newTokenAddress = vm.addr(3);

        vm.startPrank(owner);
        faucet.setTokenAddress(newTokenAddress);
        vm.stopPrank();

        assertEq(newTokenAddress, faucet.tokenAddress());
    }

    /// @notice 管理员可向水龙头成功存入代币
    function testSuccessIfOwnerDeposit() public {
        vm.startPrank(owner);
        llc.approve(address(faucet), 1_000);
        faucet.deposit(1_000);
        vm.stopPrank();

        assertEq(llc.balanceOf(address(faucet)), 1_000);
    }

    /// @notice 用户满足条件时可成功领取
    function testSuccessIfUserDrip() public ownerDeposit {
        vm.prank(user);
        faucet.drip(1);

        assertEq(llc.balanceOf(user), 1);
    }

    /// @notice 未到领取间隔应 revert
    function testRevertIfTimeHasNotPassed() public {
        vm.startPrank(owner);
        llc.approve(address(faucet), 1_000);
        faucet.deposit(1_000);
        vm.stopPrank();

        vm.prank(user);
        vm.expectRevert();
        faucet.drip(1);
    }

    /// @notice 超过领取上限应 revert
    function testRevertIfAmountLimit() public ownerDeposit {
        vm.prank(user);
        vm.expectRevert();
        faucet.drip(101);
    }

    /// @notice 水龙头余额不足应 revert
    function testRevertIfFaucetEmpty() public ownerDeposit {
        vm.startPrank(owner);
        faucet.setDripLimit(2_000);
        vm.stopPrank();

        vm.prank(user);
        faucet.drip(1_000);

        assertEq(1_000, llc.balanceOf(user));
        assertEq(0, llc.balanceOf(address(llc)));

        vm.warp(block.timestamp + dripInterval);

        vm.expectRevert();
        faucet.drip(1);
    }

    /// @notice 领取后应记录正确的时间戳
    function testDripTimeRightAfterUserDrip() public ownerDeposit {
        vm.prank(user);
        faucet.drip(1);

        assertEq(block.timestamp, faucet.getDripTime(user));
    }
}
