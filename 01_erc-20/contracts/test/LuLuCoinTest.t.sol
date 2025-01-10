// SPDX-License-Identifier: MIT
// 许可证声明：合约测试文件也采用 MIT 许可。

pragma solidity ^0.8.20;
// 指定 Solidity 编译器版本。

import "forge-std/Test.sol";
// 导入 Foundry 的测试库，用于提供断言和测试环境控制功能。

import {LuLuCoin} from "../src/LuLuCoin.sol";
// 导入要测试的主合约 LuLuCoin。

contract LuLuCoinTest is Test {
    // 声明 LuLuCoinTest 测试合约，继承 Foundry 的 Test 基类。
    
    LuLuCoin public llc;
    // 定义 LuLuCoin 类型的公共变量 `llc`，用于保存被测试的合约实例。

    address owner = vm.addr(1);
    // 使用 Foundry 提供的虚拟地址生成器生成一个模拟的所有者地址。

    address user = vm.addr(2);
    // 使用 Foundry 提供的虚拟地址生成器生成一个模拟的用户地址。

    function setUp() public {
        // setUp 函数：在每个测试用例运行之前调用，用于初始化测试环境。

        llc = new LuLuCoin(owner);
        // 部署 LuLuCoin 合约实例，并将 `owner` 设置为合约所有者。

        vm.deal(owner, 10 ether);
        // 为 `owner` 地址分配 10 ETH，用于支付交易费用或操作测试逻辑。
    }

    function testSuccessIfOwnerMint() public {
        // 测试用例：合约所有者成功铸造代币。

        vm.startPrank(owner);
        // 开始模拟 `owner` 地址的交易行为。

        llc.mint(10 ether);
        // 调用 mint 函数，铸造 10 个代币。

        vm.stopPrank();
        // 停止模拟交易行为。

        assertEq(llc.balanceOf(owner), 10 ether);
        // 验证 `owner` 地址的代币余额是否为 10。
    }

    function testRevertIfUserMint() public {
        // 测试用例：非所有者尝试铸造代币，应触发回退。

        vm.startPrank(user);
        // 开始模拟 `user` 地址的交易行为。

        vm.expectRevert();
        // 期待 revert 操作，因为 `user` 不是合约所有者。

        llc.mint(10 ether);
        // 尝试调用 mint 函数。

        vm.stopPrank();
        // 停止模拟交易行为。

        assertEq(llc.balanceOf(user), 0 ether);
        // 验证 `user` 地址的代币余额是否仍然为 0。
    }

    function testSuccessIfOwnerBurn() public {
        // 测试用例：合约所有者成功销毁代币。

        vm.startPrank(owner);
        llc.mint(10 ether);
        vm.stopPrank();
        // 合约所有者先铸造 10 个代币。

        assertEq(llc.balanceOf(owner), 10 ether);
        // 验证铸造后的余额是否为 10。

        vm.startPrank(owner);
        llc.burn(5 ether);
        vm.stopPrank();
        // 合约所有者销毁 5 个代币。

        assertEq(llc.balanceOf(owner), 5 ether);
        // 验证销毁后的余额是否为 5。
    }

    function testRevertIfUserBurn() public {
        // 测试用例：非所有者尝试销毁代币，应触发回退。

        vm.startPrank(owner);
        llc.mint(10 ether);
        vm.stopPrank();
        // 合约所有者先铸造 10 个代币。

        assertEq(llc.balanceOf(owner), 10 ether);
        // 验证铸造后的余额是否为 10。

        vm.startPrank(user);
        vm.expectRevert();
        llc.burn(5 ether);
        vm.stopPrank();
        // 非所有者尝试销毁代币，期待回退。

        assertEq(llc.balanceOf(owner), 10 ether);
        // 验证所有者的代币余额未受影响。

        assertEq(llc.balanceOf(user), 0 ether);
        // 验证用户的代币余额仍为 0。
    }
}
