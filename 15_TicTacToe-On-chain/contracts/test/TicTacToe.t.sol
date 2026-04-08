// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {TicTacToe} from "src/TicTacToe.sol";

contract TicTacToeTest is Test {
    TicTacToe ttt;
    address p1 = address(0x1);
    address p2 = address(0x2);
    address p3 = address(0x3);

    /// @notice 每个用例前重新部署合约，保证测试相互隔离。
    function setUp() public {
        ttt = new TicTacToe();
    }

    /// @dev 辅助函数：以 p1 身份创建对局并返回 gameId。
    function _createGameAsP1() internal returns (uint256 gameId) {
        vm.prank(p1);
        ttt.createGame();
        gameId = ttt.gameCounter() - 1;
    }

    /// @dev 辅助函数：以 p2 身份加入指定对局。
    function _joinGameAsP2(uint256 gameId) internal {
        vm.prank(p2);
        ttt.joinGame(gameId);
    }

    /// @dev 辅助函数：快速完成“创建 + 加入”进入 PLAYING 状态。
    function _startGame() internal returns (uint256 gameId) {
        gameId = _createGameAsP1();
        _joinGameAsP2(gameId);
    }

    /// @dev 辅助函数：读取对局状态快照，简化断言书写。
    function _getState(uint256 gameId)
        internal
        view
        returns (
            address player1,
            address player2,
            address currentTurn,
            uint8[9] memory board,
            TicTacToe.GameState state,
            address winner
        )
    {
        return ttt.getGameState(gameId);
    }

    /// @notice 用例：创建对局后状态应为 WAITING，且 playerInGame 正确置位。
    function testCreateGame() public {
        uint256 gameId = _createGameAsP1();
        assertEq(gameId, 0);
        (address _p1, address _p2, address curr, , TicTacToe.GameState state, address winner) = _getState(gameId);
        assertEq(_p1, p1);
        assertEq(_p2, address(0));
        assertEq(curr, address(0));
        assertEq(uint8(state), uint8(TicTacToe.GameState.WAITING));
        assertEq(winner, address(0));
        assertTrue(ttt.playerInGame(p1));
    }

    /// @notice 用例：同一玩家已有未结束对局时再次创建应回滚。
    function testCreateGameRevertsWhenAlreadyInGame() public {
        _createGameAsP1();
        vm.prank(p1);
        vm.expectRevert(TicTacToe.AlreadyInGame.selector);
        ttt.createGame();
    }

    /// @notice 用例：加入对局后 player2、currentTurn 与状态应正确更新。
    function testJoinGame() public {
        uint256 gameId = _createGameAsP1();
        _joinGameAsP2(gameId);
        (address _p1, address _p2, address curr, , TicTacToe.GameState state, ) = _getState(gameId);
        assertEq(_p1, p1);
        assertEq(_p2, p2);
        assertEq(curr, p1);
        assertEq(uint8(state), uint8(TicTacToe.GameState.PLAYING));
        assertTrue(ttt.playerInGame(p2));
    }

    /// @notice 用例：已在局内的玩家不能再次加入其他对局。
    function testJoinGameRevertsWhenAlreadyInGame() public {
        uint256 gameId = _createGameAsP1();
        vm.prank(p1);
        vm.expectRevert(TicTacToe.AlreadyInGame.selector);
        ttt.joinGame(gameId);
    }

    /// @notice 用例：非 WAITING 状态下加入对局应回滚。
    function testJoinGameRevertsWhenGameNotAvailable() public {
        uint256 gameId = _createGameAsP1();
        vm.prank(p1);
        ttt.cancelGame(gameId);

        vm.prank(p2);
        vm.expectRevert(TicTacToe.GameNotAvailable.selector);
        ttt.joinGame(gameId);
    }

    /// @notice 用例：即便篡改占位映射，也不能与自己对战。
    function testJoinGameRevertsWhenPlayAgainstSelfAfterStateTamper() public {
        uint256 gameId = _createGameAsP1();
        bytes32 inGameSlot = keccak256(abi.encode(p1, uint256(2)));
        vm.store(address(ttt), inGameSlot, bytes32(0));

        vm.prank(p1);
        vm.expectRevert(TicTacToe.CannotPlayAgainstYourself.selector);
        ttt.joinGame(gameId);
    }

    /// @notice 用例：验证典型胜利路径（p1 连成一线）会正确结算。
    function testMakeMoveWinP1() public {
        uint256 gameId = _createGameAsP1();
        _joinGameAsP2(gameId);
        // 落子顺序：p1:0, p2:3, p1:1, p2:4, p1:2 -> p1 获胜
        vm.prank(p1); ttt.makeMove(gameId, 0);
        vm.prank(p2); ttt.makeMove(gameId, 3);
        vm.prank(p1); ttt.makeMove(gameId, 1);
        vm.prank(p2); ttt.makeMove(gameId, 4);
        vm.prank(p1); ttt.makeMove(gameId, 2);
        (, , , , TicTacToe.GameState state, address winner) = _getState(gameId);
        assertEq(uint8(state), uint8(TicTacToe.GameState.FINISHED));
        assertEq(winner, p1);
        assertFalse(ttt.playerInGame(p1));
        assertFalse(ttt.playerInGame(p2));
    }

    /// @notice 用例：验证平局路径会正确结算且 winner 为零地址。
    function testDraw() public {
        uint256 gameId = _createGameAsP1();
        _joinGameAsP2(gameId);
        // 平局路径：0,1,2,4,3,5,7,6,8
        vm.prank(p1); ttt.makeMove(gameId, 0);
        vm.prank(p2); ttt.makeMove(gameId, 1);
        vm.prank(p1); ttt.makeMove(gameId, 2);
        vm.prank(p2); ttt.makeMove(gameId, 4);
        vm.prank(p1); ttt.makeMove(gameId, 3);
        vm.prank(p2); ttt.makeMove(gameId, 5);
        vm.prank(p1); ttt.makeMove(gameId, 7);
        vm.prank(p2); ttt.makeMove(gameId, 6);
        vm.prank(p1); ttt.makeMove(gameId, 8);
        (, , , , TicTacToe.GameState state, address winner) = _getState(gameId);
        assertEq(uint8(state), uint8(TicTacToe.GameState.FINISHED));
        assertEq(winner, address(0));
        assertFalse(ttt.playerInGame(p1));
        assertFalse(ttt.playerInGame(p2));
    }

    /// @notice 用例：创建者可取消等待中对局，且不会产生赢家。
    function testCancelGame() public {
        uint256 gameId = _createGameAsP1();
        vm.prank(p1);
        ttt.cancelGame(gameId);
        (, , , , TicTacToe.GameState state, address winner) = _getState(gameId);
        assertEq(uint8(state), uint8(TicTacToe.GameState.FINISHED));
        assertEq(winner, address(0));
        assertFalse(ttt.playerInGame(p1));
    }

    /// @notice 用例：非创建者取消等待局应回滚。
    function testCancelGameRevertsWhenNotCreator() public {
        uint256 gameId = _createGameAsP1();
        vm.prank(p2);
        vm.expectRevert(TicTacToe.NotGameCreator.selector);
        ttt.cancelGame(gameId);
    }

    /// @notice 用例：非等待状态取消对局应回滚。
    function testCancelGameRevertsWhenNotWaiting() public {
        uint256 gameId = _startGame();
        vm.prank(p1);
        vm.expectRevert(TicTacToe.GameNotAvailable.selector);
        ttt.cancelGame(gameId);
    }

    /// @notice 用例：进行中认输后，对手应成为赢家并结束对局。
    function testResign() public {
        uint256 gameId = _createGameAsP1();
        _joinGameAsP2(gameId);
        vm.prank(p1);
        ttt.resign(gameId);
        (, , , , TicTacToe.GameState state, address winner) = _getState(gameId);
        assertEq(uint8(state), uint8(TicTacToe.GameState.FINISHED));
        assertEq(winner, p2);
        assertFalse(ttt.playerInGame(p1));
        assertFalse(ttt.playerInGame(p2));
    }

    /// @notice 用例：非进行中状态认输应回滚。
    function testResignRevertsWhenGameNotPlaying() public {
        uint256 gameId = _createGameAsP1();
        vm.prank(p1);
        vm.expectRevert(TicTacToe.GameNotAvailable.selector);
        ttt.resign(gameId);
    }

    /// @notice 用例：非参与方认输应回滚。
    function testResignRevertsWhenNotParticipant() public {
        uint256 gameId = _startGame();
        vm.prank(p3);
        vm.expectRevert(TicTacToe.NotParticipant.selector);
        ttt.resign(gameId);
    }

    /// @notice 用例：非进行中状态落子应回滚。
    function testMakeMoveRevertsWhenGameNotPlaying() public {
        uint256 gameId = _createGameAsP1();
        vm.prank(p1);
        vm.expectRevert(TicTacToe.GameNotAvailable.selector);
        ttt.makeMove(gameId, 0);
    }

    /// @notice 用例：非当前回合玩家落子应回滚。
    function testMakeMoveRevertsWhenNotYourTurn() public {
        uint256 gameId = _startGame();
        vm.prank(p2);
        vm.expectRevert(TicTacToe.NotYourTurn.selector);
        ttt.makeMove(gameId, 0);
    }

    /// @notice 用例：落子位置越界应回滚。
    function testMakeMoveRevertsWhenInvalidPosition() public {
        uint256 gameId = _startGame();
        vm.prank(p1);
        vm.expectRevert(TicTacToe.InvalidPosition.selector);
        ttt.makeMove(gameId, 9);
    }

    /// @notice 用例：重复占用同一格应回滚。
    function testMakeMoveRevertsWhenPositionAlreadyTaken() public {
        uint256 gameId = _startGame();
        vm.prank(p1);
        ttt.makeMove(gameId, 0);

        vm.prank(p2);
        vm.expectRevert(TicTacToe.PositionAlreadyTaken.selector);
        ttt.makeMove(gameId, 0);
    }

    /// @notice 用例：成功落子后应正确切换回合并更新时间戳。
    function testMakeMoveUpdatesTurnAndTimestamp() public {
        uint256 gameId = _startGame();
        (uint256 startedAt, uint256 timeout) = ttt.getTimeInfo(gameId);
        assertEq(timeout, ttt.DEFAULT_TURN_TIMEOUT());

        vm.warp(startedAt + 7);
        vm.prank(p1);
        ttt.makeMove(gameId, 0);

        (, , address currentTurn, , TicTacToe.GameState state, ) = _getState(gameId);
        assertEq(uint8(state), uint8(TicTacToe.GameState.PLAYING));
        assertEq(currentTurn, p2);

        (uint256 lastMoveAt, ) = ttt.getTimeInfo(gameId);
        assertEq(lastMoveAt, block.timestamp);
    }

    /// @notice 用例：超时后由非当前回合方发起判胜应成功。
    function testClaimTimeoutWin() public {
        uint256 gameId = _createGameAsP1();
        _joinGameAsP2(gameId);
        // 当前轮到 p1，因此超时后只有 p2 可以发起判胜
        // 时间快进到 DEFAULT_TURN_TIMEOUT 之后
        (uint256 lastMoveAt, uint256 turnTimeout) = ttt.getTimeInfo(gameId);
        vm.warp(lastMoveAt + turnTimeout + 1);
        vm.prank(p2);
        ttt.claimTimeoutWin(gameId);
        (, , , , TicTacToe.GameState state, address winner) = _getState(gameId);
        assertEq(uint8(state), uint8(TicTacToe.GameState.FINISHED));
        assertEq(winner, p2);
    }

    /// @notice 用例：未达到超时阈值时判胜应回滚。
    function testClaimTimeoutTooEarlyReverts() public {
        uint256 gameId = _createGameAsP1();
        _joinGameAsP2(gameId);
        (uint256 lastMoveAt, uint256 turnTimeout) = ttt.getTimeInfo(gameId);
        vm.warp(lastMoveAt + turnTimeout - 1);
        vm.prank(p2);
        vm.expectRevert(TicTacToe.TimeoutNotReached.selector);
        ttt.claimTimeoutWin(gameId);
    }

    /// @notice 用例：当前回合玩家不能发起超时判胜。
    function testClaimTimeoutByCurrentTurnReverts() public {
        uint256 gameId = _createGameAsP1();
        _joinGameAsP2(gameId);
        (uint256 lastMoveAt, uint256 turnTimeout) = ttt.getTimeInfo(gameId);
        vm.warp(lastMoveAt + turnTimeout + 1);
        // 当前轮到 p1，因此 p1 不能发起超时判胜
        vm.prank(p1);
        vm.expectRevert(TicTacToe.NotEligibleToClaim.selector);
        ttt.claimTimeoutWin(gameId);
    }

    /// @notice 用例：非参与方不能发起超时判胜。
    function testClaimTimeoutRevertsWhenNotParticipant() public {
        uint256 gameId = _startGame();
        (uint256 lastMoveAt, uint256 turnTimeout) = ttt.getTimeInfo(gameId);
        vm.warp(lastMoveAt + turnTimeout + 1);

        vm.prank(p3);
        vm.expectRevert(TicTacToe.NotParticipant.selector);
        ttt.claimTimeoutWin(gameId);
    }

    /// @notice 用例：非进行中状态不能发起超时判胜。
    function testClaimTimeoutRevertsWhenGameNotPlaying() public {
        uint256 gameId = _createGameAsP1();
        vm.prank(p2);
        vm.expectRevert(TicTacToe.GameNotAvailable.selector);
        ttt.claimTimeoutWin(gameId);
    }

    /// @notice 用例：胜负结算后应更新双方积分与排行榜人数。
    function testStatsAndLeaderboardUpdatedOnWin() public {
        uint256 gameId = _createGameAsP1();
        _joinGameAsP2(gameId);
        // p1 获胜路径
        vm.prank(p1); ttt.makeMove(gameId, 0);
        vm.prank(p2); ttt.makeMove(gameId, 3);
        vm.prank(p1); ttt.makeMove(gameId, 1);
        vm.prank(p2); ttt.makeMove(gameId, 4);
        vm.prank(p1); ttt.makeMove(gameId, 2);

        (uint256 p1Games, int256 p1Score) = ttt.playerStats(p1);
        (uint256 p2Games, int256 p2Score) = ttt.playerStats(p2);
        assertEq(p1Games, 1);
        assertEq(p1Score, 1);
        assertEq(p2Games, 1);
        assertEq(p2Score, -1);
        assertEq(ttt.getLeaderboardCount(), 2);
    }

    /// @notice 用例：平局只增加场次，不改变积分。
    function testDrawUpdatesStatsWithoutScoreChange() public {
        uint256 gameId = _createGameAsP1();
        _joinGameAsP2(gameId);
        // 平局路径：0,1,2,4,3,5,7,6,8
        vm.prank(p1); ttt.makeMove(gameId, 0);
        vm.prank(p2); ttt.makeMove(gameId, 1);
        vm.prank(p1); ttt.makeMove(gameId, 2);
        vm.prank(p2); ttt.makeMove(gameId, 4);
        vm.prank(p1); ttt.makeMove(gameId, 3);
        vm.prank(p2); ttt.makeMove(gameId, 5);
        vm.prank(p1); ttt.makeMove(gameId, 7);
        vm.prank(p2); ttt.makeMove(gameId, 6);
        vm.prank(p1); ttt.makeMove(gameId, 8);

        (uint256 p1Games, int256 p1Score) = ttt.playerStats(p1);
        (uint256 p2Games, int256 p2Score) = ttt.playerStats(p2);
        assertEq(p1Games, 1);
        assertEq(p2Games, 1);
        assertEq(p1Score, 0);
        assertEq(p2Score, 0);
    }

    /// @notice 用例：取消等待局不应写入历史和排行榜。
    function testCancelGameDoesNotAffectHistoryOrLeaderboard() public {
        uint256 gameId = _createGameAsP1();
        vm.prank(p1);
        ttt.cancelGame(gameId);

        (uint256 p1Games, int256 p1Score) = ttt.playerStats(p1);
        assertEq(p1Games, 0);
        assertEq(p1Score, 0);
        assertEq(ttt.getLeaderboardCount(), 0);
        assertEq(ttt.getPlayerHistoryCount(p1), 0);
    }

    /// @notice 用例：超时判胜应同步写入双方统计与历史。
    function testClaimTimeoutUpdatesStatsAndHistory() public {
        uint256 gameId = _startGame();
        (uint256 lastMoveAt, uint256 turnTimeout) = ttt.getTimeInfo(gameId);
        vm.warp(lastMoveAt + turnTimeout + 1);

        vm.prank(p2);
        ttt.claimTimeoutWin(gameId);

        (uint256 p1Games, int256 p1Score) = ttt.playerStats(p1);
        (uint256 p2Games, int256 p2Score) = ttt.playerStats(p2);
        assertEq(p1Games, 1);
        assertEq(p2Games, 1);
        assertEq(p1Score, -1);
        assertEq(p2Score, 1);
        assertEq(ttt.getPlayerHistoryCount(p1), 1);
        assertEq(ttt.getPlayerHistoryCount(p2), 1);
    }

    /// @notice 用例：历史分页应按“最新在前”返回记录。
    function testPlayerHistoryPaginationReturnsNewestFirst() public {
        uint256 g1 = _createGameAsP1();
        _joinGameAsP2(g1);
        vm.prank(p1); ttt.resign(g1); // p2 获胜

        uint256 g2 = _createGameAsP1();
        _joinGameAsP2(g2);
        vm.prank(p2); ttt.resign(g2); // p1 获胜

        assertEq(ttt.getPlayerHistoryCount(p1), 2);

        TicTacToe.PlayerHistoryEntry[] memory page1 = ttt.getPlayerHistoryPage(p1, 0, 1);
        assertEq(page1.length, 1);
        assertEq(page1[0].gameId, g2);
        assertEq(uint8(page1[0].result), uint8(TicTacToe.MatchResult.WIN));
        assertEq(page1[0].scoreDelta, 1);

        TicTacToe.PlayerHistoryEntry[] memory page2 = ttt.getPlayerHistoryPage(p1, 1, 1);
        assertEq(page2.length, 1);
        assertEq(page2[0].gameId, g1);
        assertEq(uint8(page2[0].result), uint8(TicTacToe.MatchResult.LOSS));
        assertEq(page2[0].scoreDelta, -1);
    }

    /// @notice 用例：排行榜分页返回的条目应与链上统计一致。
    function testLeaderboardPageHasConsistentEntries() public {
        uint256 gameId = _createGameAsP1();
        _joinGameAsP2(gameId);
        vm.prank(p1); ttt.resign(gameId); // p2 获胜

        TicTacToe.LeaderboardEntry[] memory entries = ttt.getLeaderboardPage(0, 20);
        assertEq(entries.length, 2);

        bool sawP1 = false;
        bool sawP2 = false;
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].player == p1) {
                sawP1 = true;
                assertEq(entries[i].gamesPlayed, 1);
                assertEq(entries[i].totalScore, -1);
            }
            if (entries[i].player == p2) {
                sawP2 = true;
                assertEq(entries[i].gamesPlayed, 1);
                assertEq(entries[i].totalScore, 1);
            }
        }
        assertTrue(sawP1);
        assertTrue(sawP2);
    }

    /// @notice 用例：历史分页在越界或 limit=0 时应返回空数组。
    function testPlayerHistoryPageReturnsEmptyForOutOfRangeAndZeroLimit() public {
        TicTacToe.PlayerHistoryEntry[] memory emptyPage = ttt.getPlayerHistoryPage(p1, 0, 10);
        assertEq(emptyPage.length, 0);

        uint256 gameId = _startGame();
        vm.prank(p1);
        ttt.resign(gameId);

        TicTacToe.PlayerHistoryEntry[] memory outOfRange = ttt.getPlayerHistoryPage(p1, 2, 1);
        assertEq(outOfRange.length, 0);

        TicTacToe.PlayerHistoryEntry[] memory zeroLimit = ttt.getPlayerHistoryPage(p1, 0, 0);
        assertEq(zeroLimit.length, 0);
    }

    /// @notice 用例：排行榜分页在越界或 limit=0 时应返回空数组。
    function testLeaderboardPageReturnsEmptyForOutOfRangeAndZeroLimit() public {
        TicTacToe.LeaderboardEntry[] memory emptyPage = ttt.getLeaderboardPage(0, 10);
        assertEq(emptyPage.length, 0);

        uint256 gameId = _startGame();
        vm.prank(p1);
        ttt.resign(gameId);

        TicTacToe.LeaderboardEntry[] memory outOfRange = ttt.getLeaderboardPage(3, 1);
        assertEq(outOfRange.length, 0);

        TicTacToe.LeaderboardEntry[] memory zeroLimit = ttt.getLeaderboardPage(0, 0);
        assertEq(zeroLimit.length, 0);
    }
}
