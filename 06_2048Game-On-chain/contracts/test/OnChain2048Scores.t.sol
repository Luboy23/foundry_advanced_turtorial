// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { OnChain2048Scores } from "../src/OnChain2048Scores.sol";

interface Vm {
    function warp(uint256 newTimestamp) external;
    function prank(address newSender) external;
    function expectRevert(bytes calldata reason) external;
}

contract OnChain2048ScoresTest {
    Vm private constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    OnChain2048Scores private scores;

    function setUp() public {
        scores = new OnChain2048Scores();
    }

    function testSubmitScoreZeroReverts() public {
        vm.expectRevert(bytes("score=0"));
        scores.submitScore(0, 1);
    }

    function testHistoryEmptyReturnsZero() public {
        assertEq(
            scores.getPlayerHistoryCount(address(this)),
            0,
            "history count"
        );

        OnChain2048Scores.ScoreEntry[] memory history = scores
            .getPlayerHistory(address(this), 0, 10);
        assertEq(history.length, 0, "history empty");

        OnChain2048Scores.ScoreEntry[] memory emptyLimit = scores
            .getPlayerHistory(address(this), 0, 0);
        assertEq(emptyLimit.length, 0, "history limit zero");
    }

    function testSubmitScoreRecordsHistoryAndLeaderboard() public {
        scores.submitScore(120, 42);

        assertEq(scores.bestScores(address(this)), 120, "best score");

        OnChain2048Scores.ScoreEntry[] memory board = scores.getLeaderboard();
        assertEq(board.length, 1, "leaderboard length");
        assertEq(board[0].player, address(this), "player address");
        assertEq(board[0].score, 120, "player score");
        assertEq(uint256(board[0].duration), 42, "duration stored");

        OnChain2048Scores.ScoreEntry[] memory history = scores
            .getPlayerHistory(address(this), 0, 10);
        assertEq(history.length, 1, "history length");
        assertEq(history[0].score, 120, "history score");
        assertEq(uint256(history[0].duration), 42, "history duration");
    }

    function testSubmitScoreLowerStillRecorded() public {
        scores.submitScore(200, 30);
        scores.submitScore(120, 60);

        assertEq(scores.bestScores(address(this)), 200, "best score unchanged");

        OnChain2048Scores.ScoreEntry[] memory history = scores
            .getPlayerHistory(address(this), 0, 10);
        assertEq(history.length, 2, "history length");
        assertEq(history[0].score, 120, "history latest");
        assertEq(history[1].score, 200, "history previous");

        OnChain2048Scores.ScoreEntry[] memory board = scores.getLeaderboard();
        assertEq(board.length, 2, "leaderboard length");
        assertEq(board[0].score, 200, "leaderboard rank1");
        assertEq(board[1].score, 120, "leaderboard rank2");
    }

    function testHistoryPaginationOffsets() public {
        scores.submitScore(10, 1);
        scores.submitScore(20, 2);
        scores.submitScore(30, 3);

        OnChain2048Scores.ScoreEntry[] memory latest = scores
            .getPlayerHistory(address(this), 0, 1);
        assertEq(latest.length, 1, "latest length");
        assertEq(latest[0].score, 30, "latest score");

        OnChain2048Scores.ScoreEntry[] memory middle = scores
            .getPlayerHistory(address(this), 1, 1);
        assertEq(middle.length, 1, "middle length");
        assertEq(middle[0].score, 20, "middle score");

        OnChain2048Scores.ScoreEntry[] memory oldest = scores
            .getPlayerHistory(address(this), 2, 5);
        assertEq(oldest.length, 1, "oldest length");
        assertEq(oldest[0].score, 10, "oldest score");
    }

    function testLeaderboardAllowsDuplicatePlayers() public {
        scores.submitScore(50, 15);
        vm.warp(2000);
        scores.submitScore(150, 45);

        OnChain2048Scores.ScoreEntry[] memory board = scores.getLeaderboard();
        assertEq(board.length, 2, "two entries");
        assertEq(board[0].player, address(this), "player rank1");
        assertEq(board[1].player, address(this), "player rank2");
    }

    function testHistoryCappedAndPaginated() public {
        uint256 max = scores.MAX_HISTORY();
        uint256 total = max + 5;

        for (uint256 i = 0; i < total; i++) {
            scores.submitScore(uint64(10 + i), uint32(1 + i));
        }

        assertEq(
            scores.getPlayerHistoryCount(address(this)),
            max,
            "history capped"
        );

        OnChain2048Scores.ScoreEntry[] memory page1 = scores.getPlayerHistory(
            address(this),
            0,
            3
        );
        assertEq(page1.length, 3, "page1 length");
        assertEq(page1[0].score, uint64(10 + total - 1), "newest");
        assertEq(page1[2].score, uint64(10 + total - 3), "third newest");

        OnChain2048Scores.ScoreEntry[] memory page2 = scores.getPlayerHistory(
            address(this),
            3,
            3
        );
        assertEq(page2.length, 3, "page2 length");
        assertEq(page2[0].score, uint64(10 + total - 4), "page2 first");
    }

    function testHistoryWrapDropsOldest() public {
        uint256 max = scores.MAX_HISTORY();
        uint256 total = max + 2;

        for (uint256 i = 0; i < total; i++) {
            scores.submitScore(uint64(1 + i), uint32(1 + i));
        }

        OnChain2048Scores.ScoreEntry[] memory oldest = scores
            .getPlayerHistory(address(this), max - 1, 1);
        assertEq(oldest.length, 1, "oldest length");
        assertEq(oldest[0].score, 3, "oldest retained");
    }

    function testLeaderboardSortedByScore() public {
        _submitAs(address(0x1), 30, 10);
        _submitAs(address(0x2), 50, 12);
        _submitAs(address(0x3), 40, 11);

        OnChain2048Scores.ScoreEntry[] memory board = scores.getLeaderboard();
        assertEq(board.length, 3, "length");
        assertEq(board[0].score, 50, "rank1");
        assertEq(board[1].score, 40, "rank2");
        assertEq(board[2].score, 30, "rank3");
    }

    function testLeaderboardTieBreakByTimestamp() public {
        vm.warp(2000);
        _submitAs(address(0x10), 100, 10);
        vm.warp(1000);
        _submitAs(address(0x11), 100, 12);

        OnChain2048Scores.ScoreEntry[] memory board = scores.getLeaderboard();
        assertEq(board.length, 2, "length");
        assertEq(board[0].player, address(0x11), "earlier timestamp first");
        assertEq(board[1].player, address(0x10), "later timestamp second");
    }

    function testLeaderboardMaxSizeAndNoReplacementWhenLow() public {
        _fillLeaderboard(10, 10);
        assertEq(scores.leaderboardLength(), 10, "max length");

        address newPlayer = address(0x99);
        _submitAs(newPlayer, 10, 5);

        OnChain2048Scores.ScoreEntry[] memory board = scores.getLeaderboard();
        assertEq(board.length, 10, "still max length");
        require(!_contains(board, newPlayer), "low score should not enter");
    }

    function testLeaderboardReplacesLowestWhenHigher() public {
        _fillLeaderboard(10, 10);

        address newPlayer = address(0x77);
        _submitAs(newPlayer, 55, 20);

        OnChain2048Scores.ScoreEntry[] memory board = scores.getLeaderboard();
        assertEq(board.length, 10, "still max length");
        require(_contains(board, newPlayer), "higher score should enter");
    }

    function _submitAs(address player, uint64 score, uint32 duration) internal {
        vm.prank(player);
        scores.submitScore(score, duration);
    }

    function _fillLeaderboard(uint256 count, uint64 startScore) internal {
        for (uint256 i = 0; i < count; i++) {
            address player = address(uint160(0x100 + i));
            uint64 score = startScore + uint64(i * 10);
            uint32 duration = uint32(10 + i);
            _submitAs(player, score, duration);
        }
    }

    function _contains(
        OnChain2048Scores.ScoreEntry[] memory entries,
        address player
    ) internal pure returns (bool) {
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].player == player) {
                return true;
            }
        }
        return false;
    }

    function assertEq(uint256 a, uint256 b, string memory message) internal pure {
        require(a == b, message);
    }

    function assertEq(address a, address b, string memory message) internal pure {
        require(a == b, message);
    }

    function assertEq(uint32 a, uint32 b, string memory message) internal pure {
        require(a == b, message);
    }
}
