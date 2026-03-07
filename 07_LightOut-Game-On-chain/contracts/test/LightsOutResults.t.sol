// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import { LightsOutResults } from "../src/LightsOutResults.sol";

contract LightsOutResultsTest is Test {
    LightsOutResults private results;
    address private player = address(0xBEEF);

    event ResultSubmitted(
        address indexed player,
        uint8 indexed gridSize,
        uint8 indexed density,
        uint32 moves,
        uint32 durationMs,
        uint64 finishedAt,
        bool usedHint
    );

    function setUp() public {
        // 每个用例独立部署，避免状态串扰
        results = new LightsOutResults();
    }

    function testSubmitAndGetLatest() public {
        // 验证 submit 后 latest 全字段可读且与输入一致
        vm.prank(player);
        results.submitResult(4, 1, 12, 45000, true);

        LightsOutResults.Result memory latest = results.getLatest(player);
        assertEq(latest.player, player);
        assertEq(latest.gridSize, 4);
        assertEq(latest.density, 1);
        assertEq(latest.moves, 12);
        assertEq(latest.durationMs, 45000);
        assertEq(latest.usedHint, true);
        assertGt(latest.finishedAt, 0);
    }

    function testBestByConfig() public {
        // 验证 best 只保留“更优解”，更差成绩不会覆盖
        vm.startPrank(player);
        results.submitResult(5, 2, 18, 60000, false);
        results.submitResult(5, 2, 20, 50000, true);
        results.submitResult(5, 2, 16, 70000, false);
        vm.stopPrank();

        LightsOutResults.Result memory best = results.getBest(player, 5, 2);
        assertEq(best.moves, 16);
        assertEq(best.durationMs, 70000);
    }

    function testBestByConfigTieBreak() public {
        // 同步数时按 durationMs 决胜
        vm.startPrank(player);
        results.submitResult(6, 0, 14, 80000, false);
        results.submitResult(6, 0, 14, 65000, true);
        vm.stopPrank();

        LightsOutResults.Result memory best = results.getBest(player, 6, 0);
        assertEq(best.moves, 14);
        assertEq(best.durationMs, 65000);
    }

    function testInvalidGridSize() public {
        // gridSize 非 4/5/6 应回滚
        vm.prank(player);
        vm.expectRevert("Invalid grid size");
        results.submitResult(3, 1, 12, 1000, false);
    }

    function testInvalidDensity() public {
        // density 仅允许 0/1/2
        vm.prank(player);
        vm.expectRevert("Invalid density");
        results.submitResult(4, 3, 12, 1000, false);
    }

    function testSubmitEmitsEvent() public {
        // 事件字段是前端回放数据源，必须精确校验
        vm.warp(123);
        vm.prank(player);
        vm.expectEmit(true, true, true, true);
        emit ResultSubmitted(player, 4, 1, 10, 5000, 123, false);
        results.submitResult(4, 1, 10, 5000, false);
    }

    function testBestDoesNotUpdateWhenWorse() public {
        // 提交更差成绩后，best 不应被污染
        vm.startPrank(player);
        results.submitResult(4, 1, 10, 5000, false);
        results.submitResult(4, 1, 12, 1000, false);
        results.submitResult(4, 1, 10, 6000, false);
        vm.stopPrank();

        LightsOutResults.Result memory best = results.getBest(player, 4, 1);
        assertEq(best.moves, 10);
        assertEq(best.durationMs, 5000);
    }

    function testBestDifferentConfigsIndependent() public {
        // 不同配置键之间互不影响
        vm.startPrank(player);
        results.submitResult(4, 0, 12, 4000, false);
        results.submitResult(5, 2, 8, 7000, true);
        vm.stopPrank();

        LightsOutResults.Result memory bestA = results.getBest(player, 4, 0);
        LightsOutResults.Result memory bestB = results.getBest(player, 5, 2);
        assertEq(bestA.gridSize, 4);
        assertEq(bestA.density, 0);
        assertEq(bestB.gridSize, 5);
        assertEq(bestB.density, 2);
    }

    function testGetLatestDefaultZero() public view {
        // 未提交过成绩的地址应返回全零结构体
        LightsOutResults.Result memory latest = results.getLatest(address(0x123));
        assertEq(latest.player, address(0));
        assertEq(latest.gridSize, 0);
        assertEq(latest.density, 0);
        assertEq(latest.moves, 0);
        assertEq(latest.durationMs, 0);
        assertEq(latest.finishedAt, 0);
        assertEq(latest.usedHint, false);
    }

    function testFuzzInvalidGridSizeReverts(uint8 gridSize) public {
        // fuzz 覆盖非法棋盘维度区间
        vm.assume(gridSize < 4 || gridSize > 6);
        vm.expectRevert("Invalid grid size");
        results.submitResult(gridSize, 1, 10, 1000, false);
    }

    function testFuzzInvalidDensityReverts(uint8 density) public {
        // fuzz 覆盖非法密度值
        vm.assume(density > 2);
        vm.expectRevert("Invalid density");
        results.submitResult(4, density, 10, 1000, false);
    }
}
