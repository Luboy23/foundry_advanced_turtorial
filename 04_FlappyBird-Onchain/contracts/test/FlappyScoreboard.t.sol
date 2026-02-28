// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/FlappyScoreboard.sol";

/// @notice FlappyScoreboard 的基础单元测试
contract FlappyScoreboardTest is Test {
    /// @notice 被测合约实例
    FlappyScoreboard private scoreboard;

    /// @notice 测试初始化：部署合约
    function setUp() public {
        scoreboard = new FlappyScoreboard();
    }

    /// @notice 个人最佳分只在更高分时更新
    function testBestScoreUpdatesOnlyOnHigherScore() public {
        address player = address(0x1);

        // 第一次提交 5 分
        vm.prank(player);
        scoreboard.submitScore(5);
        assertEq(scoreboard.bestScore(player), 5);

        // 提交更低分数不会覆盖
        vm.prank(player);
        scoreboard.submitScore(3);
        assertEq(scoreboard.bestScore(player), 5);

        // 提交更高分数会更新
        vm.prank(player);
        scoreboard.submitScore(9);
        assertEq(scoreboard.bestScore(player), 9);
    }

    /// @notice 排行榜始终保持 Top10
    function testLeaderboardKeepsTop10() public {
        // 构造 12 位玩家提交递增分数
        for (uint256 i = 1; i <= 12; i++) {
            address player = address(uint160(i));
            vm.prank(player);
            scoreboard.submitScore(i * 10);
        }

        (address[] memory players, uint256[] memory scores, uint256[] memory timestamps) = scoreboard.getLeaderboard();
        assertEq(players.length, 10);
        assertEq(scores.length, 10);
        assertEq(timestamps.length, 10);

        // 最高分应为 120，最低分应为 30
        assertEq(scores[0], 120);
        assertEq(scores[9], 30);
    }

}
