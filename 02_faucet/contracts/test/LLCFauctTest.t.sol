// SPDX-License-Identifier: MIT
// 许可证声明：指定合约的版权许可为 MIT，允许代码的自由使用和修改。

pragma solidity ^0.8.20;
// 指定 Solidity 编译器的版本。这里选择的是 0.8.20，确保合约在这一版本下编译通过。

import "forge-std/Test.sol";
// 导入 forge-std 测试库，提供测试框架和工具。

import {LuLuCoin} from "../src/LuLuCoin.sol";
// 导入 LuLuCoin 合约，用于测试代币的相关操作。

import {LLCFaucet} from "../src/LLCFaucet.sol";
// 导入 LLCFaucet 合约，用于测试水龙头发放代币的功能。

contract LLCFaucetTest is Test {
    // 定义 LLCFaucetTest 测试合约，继承 Test 合约以便使用 forge-std 提供的测试工具。

    LuLuCoin public llc;
    // 定义一个公共的 LuLuCoin 类型的变量 llc，用于测试中的代币合约实例。

    LLCFaucet public faucet;
    // 定义一个公共的 LLCFaucet 类型的变量 faucet，用于测试中的水龙头合约实例。

    address owner = vm.addr(1);
    // 定义一个变量 owner，表示合约所有者的地址。

    address user = vm.addr(2);
    // 定义一个变量 user，表示测试中的用户地址。

    uint256 dripInterval = 10 seconds;
    // 定义一个领取间隔为 10 秒，用于控制用户请求代币的最小间隔时间。

    uint256 public dripLimit = 100;
    // 定义一个领取限制为 100，表示用户每次最多可以领取 100 个代币。

    modifier ownerDeposit() {
        // 定义一个修饰器 ownerDeposit，用于模拟合约所有者存入代币并等待领取间隔。
        vm.startPrank(owner);
        // 模拟合约所有者的操作。
        
        llc.approve(address(faucet), 1_000);
        // 合约所有者授权水龙头合约转移 1,000 个代币。
        
        faucet.deposit(1_000);
        // 合约所有者向水龙头存入 1,000 个代币。
        
        vm.stopPrank();
        // 停止模拟合约所有者的操作。

        vm.warp(block.timestamp + dripInterval);
        // 模拟时间流逝，确保时间超过领取间隔。

        _;
    }

    function setUp() public {
        // 定义 setUp 函数，初始化测试环境。
        llc = new LuLuCoin(owner);
        // 创建一个新的 LuLuCoin 合约实例，指定合约所有者。

        faucet = new LLCFaucet(address(llc), dripInterval, dripLimit, owner);
        // 创建一个新的 LLCFaucet 合约实例，指定代币合约地址、领取间隔、领取限制和合约所有者。

        vm.deal(owner, 1_000 ether);
        // 给合约所有者分配 1,000 个以太币。

        vm.deal(user, 1_000 ether);
        // 给测试中的用户分配 1,000 个以太币。

        vm.prank(owner);
        // 模拟合约所有者的操作。

        llc.mint(1_000);
        // 合约所有者铸造 1,000 个代币。
    }

    function testSuccessIfOwnerSetDripLimit() public {
        // 定义测试函数 testSuccessIfOwnerSetDripLimit，测试合约所有者是否能成功设置领取限制。
        uint256 newLimit = 200;
        // 定义一个新的领取限制为 200。

        vm.startPrank(owner);
        // 模拟合约所有者的操作。
        
        faucet.setDripLimit(newLimit);
        // 合约所有者设置新的领取限制为 200。

        vm.stopPrank();
        // 停止模拟合约所有者的操作。

        assertEq(newLimit, faucet.getDripLimit());
        // 断言新的领取限制已经成功设置。
    }

    function testSuccessIfOwnerSetDripInterval() public {
        // 定义测试函数 testSuccessIfOwnerSetDripInterval，测试合约所有者是否能成功设置领取间隔。
        uint256 newInterval = 20 seconds;
        // 定义一个新的领取间隔为 20 秒。

        vm.startPrank(owner);
        // 模拟合约所有者的操作。

        faucet.setDripInterval(newInterval);
        // 合约所有者设置新的领取间隔为 20 秒。

        vm.stopPrank();
        // 停止模拟合约所有者的操作。

        assertEq(newInterval, faucet.getDripInterval());
        // 断言新的领取间隔已经成功设置。
    }

    function testSuccessIfOwnerSetTokenAddress() public {
        // 定义测试函数 testSuccessIfOwnerSetTokenAddress，测试合约所有者是否能成功设置代币地址。
        address newTokenAddress = vm.addr(3);
        // 定义一个新的代币地址。

        vm.startPrank(owner);
        // 模拟合约所有者的操作。

        faucet.setTokenAddress(newTokenAddress);
        // 合约所有者设置新的代币地址。

        vm.stopPrank();
        // 停止模拟合约所有者的操作。

        assertEq(newTokenAddress, faucet.tokenAddress());
        // 断言新的代币地址已经成功设置。
    }

    function testSuccessIfOwnerDeposit() public {
        // 定义测试函数 testSuccessIfOwnerDeposit，测试合约所有者是否能成功存入代币。
        vm.startPrank(owner);
        // 模拟合约所有者的操作。

        llc.approve(address(faucet), 1_000);
        // 合约所有者授权水龙头合约转移 1,000 个代币。

        faucet.deposit(1_000);
        // 合约所有者向水龙头存入 1,000 个代币。

        vm.stopPrank();
        // 停止模拟合约所有者的操作。

        assertEq(llc.balanceOf(address(faucet)), 1_000);
        // 断言水龙头合约已成功接收 1,000 个代币。
    }

    function testSuccessIfUserDrip() public ownerDeposit {
        // 定义测试函数 testSuccessIfUserDrip，测试用户是否能成功领取代币。
        vm.prank(user);
        // 模拟用户的操作。

        faucet.drip(1);
        // 用户请求领取 1 个代币。

        assertEq(llc.balanceOf(user), 1);
        // 断言用户已经成功领取了 1 个代币。
    }

    function testRevertIfTimeHasNotPassed() public {
        // 定义测试函数 testRevertIfTimeHasNotPassed，测试如果时间未过，则应 revert。
        vm.startPrank(owner);
        // 模拟合约所有者的操作。

        llc.approve(address(faucet), 1_000);
        // 合约所有者授权水龙头合约转移 1,000 个代币。

        faucet.deposit(1_000);
        // 合约所有者向水龙头存入 1,000 个代币。

        vm.stopPrank();
        // 停止模拟合约所有者的操作。

        vm.prank(user);
        // 模拟用户的操作。

        vm.expectRevert();
        // 预期会发生 revert。

        faucet.drip(1);
        // 用户请求领取 1 个代币，但由于时间未过，应 revert。
    }

    function testRevertIfAmountLimit() public ownerDeposit{
        // 定义测试函数 testRevertIfAmountLimit，测试如果请求的代币数量超过限制应 revert。
        vm.prank(user);
        // 模拟用户的操作。

        vm.expectRevert();
        // 预期会发生 revert。

        faucet.drip(101);
        // 用户请求领取 101 个代币，超过了领取限制，应 revert。
    }

    function testRevertIfFaucetEmpty() public ownerDeposit {
        // 定义测试函数 testRevertIfFaucetEmpty，测试如果水龙头代币不足应 revert。
        vm.startPrank(owner);
        // 模拟合约所有者的操作。

        faucet.setDripLimit(2_000);
        // 合约所有者设置领取限制为 2,000。

        vm.stopPrank();
        // 停止模拟合约所有者的操作。

        vm.prank(user);
        // 模拟用户的操作。

        faucet.drip(1_000);
        // 用户请求领取 1,000 个代币。

        assertEq(1_000, llc.balanceOf(user));
        // 断言用户已领取 1,000 个代币。

        assertEq(0, llc.balanceOf(address(llc)));
        // 断言 LuLuCoin 合约余额为 0。

        vm.warp(block.timestamp + dripInterval);
        // 模拟时间流逝，确保时间超过领取间隔。

        vm.expectRevert();
        // 预期会发生 revert。

        faucet.drip(1);
        // 用户再次请求领取 1 个代币，但水龙头已空，应 revert。
    }

    function testDripTimeRightAfterUserDrip() public ownerDeposit {
        // 定义测试函数 testDripTimeRightAfterUserDrip，测试用户领取代币后领取时间是否正确。
        vm.prank(user);
        // 模拟用户的操作。

        faucet.drip(1);
        // 用户请求领取 1 个代币。

        assertEq(block.timestamp, faucet.getDripTime(user));
        // 断言用户的领取时间应该是当前时间。
    }
}
