// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { StoneFallScoreboard } from "../src/StoneFallScoreboard.sol";

interface Vm {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function prank(address newSender) external;
    function warp(uint256 newTimestamp) external;
    function expectRevert(bytes calldata reason) external;
    function expectRevert(bytes4 reason) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory entries);
}

/// @notice StoneFallScoreboard 合约测试（成功路径 + 失败路径 + 边界）
contract StoneFallScoreboardTest {
    Vm private constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    StoneFallScoreboard private scoreboard;

    function setUp() public {
        scoreboard = new StoneFallScoreboard();
    }

    /// @notice 场景：分数为 0 时必须回滚
    function testSubmitScoreZeroReverts() public {
        vm.expectRevert(StoneFallScoreboard.ScoreMustBeGreaterThanZero.selector);
        scoreboard.submitScore(0, 1000, 1);
    }

    /// @notice 场景：提交成功应写入事件字段，并更新最佳分
    function testSubmitScoreEmitsEventAndUpdatesBest() public {
        address player = address(0xA11CE);
        vm.warp(1234);
        vm.recordLogs();

        vm.prank(player);
        scoreboard.submitScore(88, 4567, 12);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1, "event count");
        assertEq(logs[0].emitter, address(scoreboard), "event emitter");

        bytes32 expectedTopic0 = keccak256(
            "ScoreSubmitted(address,uint32,uint32,uint32,uint64)"
        );
        assertEq(logs[0].topics.length, 2, "topic length");
        assertEq(logs[0].topics[0], expectedTopic0, "topic0");
        assertEq(
            logs[0].topics[1],
            bytes32(uint256(uint160(player))),
            "indexed player"
        );

        (uint32 score, uint32 survivalMs, uint32 totalDodged, uint64 finishedAt) =
            abi.decode(logs[0].data, (uint32, uint32, uint32, uint64));
        assertEq(score, 88, "score");
        assertEq(survivalMs, 4567, "survival");
        assertEq(totalDodged, 12, "dodged");
        assertEq(finishedAt, 1234, "finishedAt");

        assertEq(scoreboard.bestScoreOf(player), 88, "best score");
    }

    /// @notice 场景：Top10 排序与满榜替换必须符合规则
    function testLeaderboardSortAndReplacement() public {
        _fillBoardWithAscendingScores();

        // 低于榜尾，不应进入榜单
        vm.prank(address(0x99));
        scoreboard.submitScore(9, 9999, 1);
        StoneFallScoreboard.ScoreEntry[] memory boardA = scoreboard.getLeaderboard();
        assertEq(boardA.length, 10, "top10 length");
        assertEq(boardA[0].score, 19, "rank1 before replace");
        assertEq(boardA[9].score, 10, "rank10 before replace");

        // 更高分进入榜单并成为第一
        vm.prank(address(0x77));
        scoreboard.submitScore(30, 1000, 2);
        StoneFallScoreboard.ScoreEntry[] memory boardB = scoreboard.getLeaderboard();
        assertEq(boardB.length, 10, "top10 length after replace");
        assertEq(boardB[0].score, 30, "rank1 after replace");
        assertEq(boardB[9].score, 11, "rank10 after replace");
    }

    /// @notice 场景：同地址允许重复上榜
    function testLeaderboardAllowsDuplicatePlayer() public {
        address samePlayer = address(0x123);
        vm.prank(samePlayer);
        scoreboard.submitScore(20, 2000, 4);
        vm.prank(samePlayer);
        scoreboard.submitScore(21, 1000, 5);

        StoneFallScoreboard.ScoreEntry[] memory board = scoreboard.getLeaderboard();
        assertEq(board.length, 2, "length");
        assertEq(board[0].player, samePlayer, "rank1 player");
        assertEq(board[1].player, samePlayer, "rank2 player");
    }

    /// @notice 场景：同分时按生存时长降序，再按 finishedAt 升序
    function testLeaderboardTieBreakRule() public {
        vm.warp(200);
        vm.prank(address(0xA));
        scoreboard.submitScore(50, 3000, 1);

        vm.warp(100);
        vm.prank(address(0xB));
        scoreboard.submitScore(50, 3000, 1);

        vm.warp(300);
        vm.prank(address(0xC));
        scoreboard.submitScore(50, 5000, 1);

        StoneFallScoreboard.ScoreEntry[] memory board = scoreboard.getLeaderboard();
        assertEq(board.length, 3, "length");
        assertEq(board[0].player, address(0xC), "higher survival first");
        assertEq(board[1].player, address(0xB), "earlier finishedAt first");
        assertEq(board[2].player, address(0xA), "later finishedAt second");
    }

    /// @notice 场景：历史记录上限 50，且分页读取顺序正确
    function testHistoryCapAndPagination() public {
        address player = address(0x5151);
        for (uint32 i = 1; i <= 53; i++) {
            vm.warp(1000 + i);
            vm.prank(player);
            scoreboard.submitScore(i, 100 + i, 10 + i);
        }

        uint256 count = scoreboard.getUserHistoryCount(player);
        assertEq(count, 50, "history count");

        StoneFallScoreboard.ScoreEntry[] memory latest =
            scoreboard.getUserHistory(player, 0, 3);
        assertEq(latest.length, 3, "latest size");
        assertEq(latest[0].score, 53, "latest #1");
        assertEq(latest[1].score, 52, "latest #2");
        assertEq(latest[2].score, 51, "latest #3");

        StoneFallScoreboard.ScoreEntry[] memory oldest =
            scoreboard.getUserHistory(player, 49, 1);
        assertEq(oldest.length, 1, "oldest size");
        assertEq(oldest[0].score, 4, "oldest retained");
    }

    /// @notice 场景：最佳分只在更高分时更新
    function testBestScoreOnlyUpdatesOnHigherValue() public {
        address player = address(0xBEEF);

        vm.prank(player);
        scoreboard.submitScore(100, 1000, 10);
        assertEq(scoreboard.bestScoreOf(player), 100, "best #1");

        vm.prank(player);
        scoreboard.submitScore(90, 2000, 20);
        assertEq(scoreboard.bestScoreOf(player), 100, "best unchanged");

        vm.prank(player);
        scoreboard.submitScore(120, 1500, 30);
        assertEq(scoreboard.bestScoreOf(player), 120, "best updated");
    }

    /// @notice 模糊测试：多轮随机提交后，排行榜始终保持有序且容量不超过 10
    function testFuzzLeaderboardInvariant(uint256 seed) public {
        uint32 rounds = uint32((seed % 90) + 20);
        for (uint32 i = 0; i < rounds; i++) {
            address player = address(
                uint160(uint256(keccak256(abi.encode(seed, i, "player"))))
            );
            uint32 score = uint32(
                (uint256(keccak256(abi.encode(seed, i, "score"))) % 300) + 1
            );
            uint32 survivalMs = uint32(
                (uint256(keccak256(abi.encode(seed, i, "survival"))) % 120000) + 1
            );
            uint32 totalDodged = uint32(
                (uint256(keccak256(abi.encode(seed, i, "dodged"))) % 9999)
            );

            vm.warp(1000 + i);
            vm.prank(player);
            scoreboard.submitScore(score, survivalMs, totalDodged);
        }

        StoneFallScoreboard.ScoreEntry[] memory board = scoreboard.getLeaderboard();
        require(board.length <= 10, "board overflow");
        _assertLeaderboardSorted(board);
    }

    /// @notice 模糊测试：历史分页在 offset/limit 极值下不越界，且顺序保持“最新优先”
    function testFuzzHistoryPaginationBounds(uint256 seed) public {
        address player = address(
            uint160(uint256(keccak256(abi.encode(seed, "history-player"))))
        );
        uint32 total = uint32((seed % 110) + 1);

        for (uint32 i = 1; i <= total; i++) {
            vm.warp(5000 + i);
            vm.prank(player);
            scoreboard.submitScore(i, 100 + i, i % 200);
        }

        uint256 count = scoreboard.getUserHistoryCount(player);
        uint256 expectedCount = total > 50 ? 50 : total;
        assertEq(count, expectedCount, "history count mismatch");

        uint256 offset = (seed >> 16) % 70;
        uint256 limit = (seed >> 24) % 20;
        StoneFallScoreboard.ScoreEntry[] memory page =
            scoreboard.getUserHistory(player, offset, limit);

        if (offset >= count || limit == 0) {
            assertEq(page.length, 0, "empty page expected");
            return;
        }

        uint256 remain = count - offset;
        uint256 expectedSize = limit < remain ? limit : remain;
        assertEq(page.length, expectedSize, "page size mismatch");

        uint256 expectedFirstScore = uint256(total) - offset;
        assertEq(page[0].score, expectedFirstScore, "first score mismatch");

        for (uint256 i = 1; i < page.length; i++) {
            require(page[i - 1].finishedAt >= page[i].finishedAt, "history order");
            require(page[i - 1].score > page[i].score, "history score order");
        }
    }

    /// @notice 模糊测试：多地址高频提交时，最佳分映射与排行榜排序都保持稳定
    function testFuzzHighFrequencyMultiPlayerSubmissions(uint256 seed) public {
        address[6] memory players;
        uint32[6] memory expectedBest;
        for (uint256 i = 0; i < players.length; i++) {
            players[i] = address(
                uint160(uint256(keccak256(abi.encode(seed, i, "multi-player"))))
            );
        }

        for (uint32 i = 0; i < 120; i++) {
            uint8 index = uint8(
                uint256(keccak256(abi.encode(seed, i, "pick"))) % players.length
            );
            uint32 score = uint32(
                (uint256(keccak256(abi.encode(seed, i, "multi-score"))) % 500) + 1
            );
            uint32 survivalMs = uint32(
                (uint256(keccak256(abi.encode(seed, i, "multi-survival"))) % 200000) + 1
            );
            uint32 dodged = uint32(
                uint256(keccak256(abi.encode(seed, i, "multi-dodged"))) % 2000
            );

            if (score > expectedBest[index]) {
                expectedBest[index] = score;
            }

            vm.warp(10000 + i);
            vm.prank(players[index]);
            scoreboard.submitScore(score, survivalMs, dodged);
        }

        for (uint256 i = 0; i < players.length; i++) {
            assertEq(
                scoreboard.bestScoreOf(players[i]),
                expectedBest[i],
                "best score mismatch"
            );
        }

        StoneFallScoreboard.ScoreEntry[] memory board = scoreboard.getLeaderboard();
        _assertLeaderboardSorted(board);
    }

    function _fillBoardWithAscendingScores() internal {
        for (uint32 i = 0; i < 10; i++) {
            address player = address(uint160(0x100 + i));
            vm.prank(player);
            scoreboard.submitScore(10 + i, 1000 + i, 1 + i);
        }
    }

    function _assertLeaderboardSorted(
        StoneFallScoreboard.ScoreEntry[] memory board
    ) internal pure {
        for (uint256 i = 1; i < board.length; i++) {
            require(_isOrdered(board[i - 1], board[i]), "leaderboard order");
        }
    }

    function _isOrdered(
        StoneFallScoreboard.ScoreEntry memory left,
        StoneFallScoreboard.ScoreEntry memory right
    ) internal pure returns (bool) {
        if (left.score > right.score) return true;
        if (left.score < right.score) return false;

        if (left.survivalMs > right.survivalMs) return true;
        if (left.survivalMs < right.survivalMs) return false;

        return left.finishedAt <= right.finishedAt;
    }

    function assertEq(uint256 a, uint256 b, string memory message) internal pure {
        require(a == b, message);
    }

    function assertEq(address a, address b, string memory message) internal pure {
        require(a == b, message);
    }

    function assertEq(bytes32 a, bytes32 b, string memory message) internal pure {
        require(a == b, message);
    }
}
