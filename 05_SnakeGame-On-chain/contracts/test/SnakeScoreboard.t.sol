// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SnakeScoreboard.sol";

/// @notice SnakeScoreboard 合约测试
contract SnakeScoreboardTest is Test {
    SnakeScoreboard private scoreboard;

    /// @notice 部署合约并初始化测试环境
    function setUp() public {
        scoreboard = new SnakeScoreboard();
    }

    /// @notice 分数为 0 时必须 revert
    function testSubmitScoreZeroReverts() public {
        vm.expectRevert(bytes("Score must be > 0"));
        scoreboard.submitScore(0, 1, 1);
    }

    /// @notice 提交成绩会触发事件并写入个人记录
    function testSubmitScoreEmitsEventAndRecordsUser() public {
        address player = address(0x1);
        uint32 score = 12;
        uint32 duration = 34;
        uint16 speed = 5;
        uint64 ts = 100;

        vm.warp(ts);
        vm.prank(player);
        vm.expectEmit(true, false, false, true);
        emit SnakeScoreboard.ScoreSubmitted(player, score, duration, speed, ts);
        scoreboard.submitScore(score, duration, speed);

        assertEq(scoreboard.getUserCount(player), 1, "user count");
        SnakeScoreboard.UserEntry[] memory recent = scoreboard.getUserRecent(
            player
        );
        assertEq(recent.length, 1, "recent length");
        assertEq(recent[0].score, score, "score");
        assertEq(recent[0].durationSec, duration, "duration");
        assertEq(recent[0].speedPeak, speed, "speed");
        assertEq(recent[0].timestamp, ts, "timestamp");
    }

    /// @notice 全局排行榜按分数降序排序
    function testGlobalTopSortedByScoreDesc() public {
        _submitAs(address(0x1), 10, 1, 1);
        _submitAs(address(0x2), 30, 1, 1);
        _submitAs(address(0x3), 20, 1, 1);

        SnakeScoreboard.GlobalEntry[] memory board = scoreboard.getGlobalTop();
        assertEq(board.length, 3, "length");
        assertEq(board[0].score, 30, "rank1");
        assertEq(board[1].score, 20, "rank2");
        assertEq(board[2].score, 10, "rank3");
    }

    /// @notice 同分情况下按时间戳倒序（新记录靠前）
    function testGlobalTopTieBreakByTimestamp() public {
        address a = address(0x10);
        address b = address(0x11);
        vm.warp(100);
        _submitAs(a, 50, 1, 1);
        vm.warp(200);
        _submitAs(b, 50, 1, 1);

        SnakeScoreboard.GlobalEntry[] memory board = scoreboard.getGlobalTop();
        assertEq(board.length, 2, "length");
        assertEq(board[0].player, b, "newer first");
        assertEq(board[1].player, a, "older second");
    }

    /// @notice 排行榜已满时，低分不进入榜单
    function testGlobalTopMaxAndNoReplaceOnLowScore() public {
        _fillLeaderboard(20, 10);
        uint8 count = scoreboard.getGlobalCount();
        assertEq(count, 20, "count max");

        address low = address(0x99);
        _submitAs(low, 9, 1, 1);

        SnakeScoreboard.GlobalEntry[] memory board = scoreboard.getGlobalTop();
        assertEq(board.length, 20, "still max");
        require(!_contains(board, low), "low should not enter");
    }

    /// @notice 排行榜已满时，高分替换榜尾并进入榜单
    function testGlobalTopReplacesLowestWhenHigher() public {
        _fillLeaderboard(20, 10);

        address high = address(0x77);
        _submitAs(high, 999, 1, 1);

        SnakeScoreboard.GlobalEntry[] memory board = scoreboard.getGlobalTop();
        assertEq(board.length, 20, "still max");
        require(_contains(board, high), "higher should enter");
    }

    /// @notice 个人历史在未满时按插入顺序返回
    function testUserRecentOrderWhenNotFull() public {
        address player = address(0xabc);
        _submitAs(player, 5, 1, 1);
        _submitAs(player, 6, 2, 2);
        _submitAs(player, 7, 3, 3);

        SnakeScoreboard.UserEntry[] memory recent = scoreboard.getUserRecent(
            player
        );
        assertEq(recent.length, 3, "recent length");
        assertEq(recent[0].score, 5, "first");
        assertEq(recent[1].score, 6, "second");
        assertEq(recent[2].score, 7, "third");
    }

    /// @notice 个人历史超出上限时按环形缓冲保留最近 20 条
    function testUserRecentRingBufferOrderWhenFull() public {
        address player = address(0x999);
        for (uint32 i = 1; i <= 25; i++) {
            _submitAs(player, i, i, 1);
        }

        assertEq(scoreboard.getUserCount(player), 20, "count capped");
        SnakeScoreboard.UserEntry[] memory recent = scoreboard.getUserRecent(
            player
        );
        assertEq(recent.length, 20, "recent length");
        assertEq(recent[0].score, 6, "oldest retained");
        assertEq(recent[19].score, 25, "newest retained");
    }

    /// @notice Fuzz：随机数量提交后榜单顺序保持正确
    function testFuzzGlobalTopOrdering(uint8 nSeed, uint32 baseScore) public {
        uint8 n = uint8(bound(nSeed, 1, 30));
        uint32 base = uint32(bound(baseScore, 1, 1000));
        for (uint8 i = 0; i < n; i++) {
            address player = address(uint160(uint256(0x1000 + i)));
            uint32 score = uint32(base + uint32(i * 3));
            vm.warp(1000 + i);
            _submitAs(player, score, 1, 1);
        }

        SnakeScoreboard.GlobalEntry[] memory board = scoreboard.getGlobalTop();
        for (uint256 i = 0; i + 1 < board.length; i++) {
            assertGe(board[i].score, board[i + 1].score, "score order");
            if (board[i].score == board[i + 1].score) {
                assertGe(
                    board[i].timestamp,
                    board[i + 1].timestamp,
                    "timestamp order"
                );
            }
        }
    }

    /// @notice Fuzz：单次提交后计数正确
    function testFuzzSingleSubmitCounts(uint32 score) public {
        score = uint32(bound(score, 1, type(uint32).max));
        scoreboard.submitScore(score, 1, 1);
        assertEq(scoreboard.getGlobalCount(), 1, "global count");
        assertEq(scoreboard.getUserCount(address(this)), 1, "user count");
    }

    /// @notice 使用指定地址提交成绩的辅助方法
    function _submitAs(
        address player,
        uint32 score,
        uint32 duration,
        uint16 speed
    ) internal {
        vm.prank(player);
        scoreboard.submitScore(score, duration, speed);
    }

    /// @notice 填充排行榜的辅助方法
    function _fillLeaderboard(uint256 count, uint32 startScore) internal {
        for (uint256 i = 0; i < count; i++) {
            address player = address(uint160(0x200 + i));
            uint32 score = startScore + uint32(i * 2);
            _submitAs(player, score, 1, 1);
        }
    }

    /// @notice 判断榜单是否包含指定玩家
    function _contains(
        SnakeScoreboard.GlobalEntry[] memory entries,
        address player
    ) internal pure returns (bool) {
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].player == player) {
                return true;
            }
        }
        return false;
    }
}
