// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TicTacToe
/// @notice 链上井字棋核心合约：管理对局状态、结算、历史与排行榜。
/// @dev 对局状态机：WAITING -> PLAYING -> FINISHED（不可逆）。
contract TicTacToe {
    enum GameState {
        WAITING,
        PLAYING,
        FINISHED
    }

    struct Game {
        address player1;
        address player2;
        address currentTurn;
        uint8[9] board;
        GameState state;
        address winner;
        uint256 lastMoveAt; // PLAYING 阶段的计时基准：开局时初始化，之后每次换手后刷新。
    }

    struct PlayerStats {
        uint256 gamesPlayed;
        int256 totalScore;
    }

    enum MatchResult {
        LOSS,
        DRAW,
        WIN
    }

    struct PlayerHistoryEntry {
        uint256 gameId;
        address opponent;
        MatchResult result;
        int8 scoreDelta;
        uint256 endedAt;
    }

    struct LeaderboardEntry {
        address player;
        uint256 gamesPlayed;
        int256 totalScore;
    }

    mapping(uint256 => Game) public games;
    uint256 public gameCounter;

    /// @notice 每回合默认超时时间；开局和每次换手后都从 lastMoveAt 开始重新计时。
    uint256 public constant DEFAULT_TURN_TIMEOUT = 10 minutes;

    event GameCreated(uint256 indexed gameId, address player1);
    event PlayerJoined(uint256 gameId, address player2);
    event MoveMade(uint256 gameId, address player, uint8 position);
    event GameWon(uint256 gameId, address winner);
    event GameDrawn(uint256 gameId);
    event GameCancelled(uint256 gameId);

    /// @dev 标记地址是否存在未结束对局，用于阻止同一地址并行参与多局。
    mapping(address => bool) public playerInGame;
    mapping(address => PlayerStats) public playerStats;
    /// @dev 历史在存储层按结束顺序追加，分页读取时会按“最新在前”反向切片。
    mapping(address => PlayerHistoryEntry[]) private playerHistories;
    mapping(address => bool) private isLeaderboardPlayer;
    /// @dev 合约仅维护参与过有效已结束对局的玩家索引；最终排序由调用方决定。
    address[] private leaderboardPlayers;

    error AlreadyInGame();
    error GameNotAvailable();
    error CannotPlayAgainstYourself();
    error NotYourTurn();
    error InvalidPosition();
    error PositionAlreadyTaken();
    error NotGameCreator();
    error NotParticipant();
    error TimeoutNotReached();
    error NotEligibleToClaim();

    /// @notice 创建新对局，调用者成为 player1 并进入 WAITING 状态。
    /// @dev 同一地址在已有未结束对局时不可重复创建。
    function createGame() external {
        if (playerInGame[msg.sender]) revert AlreadyInGame();
        uint256 gameId = gameCounter++;
        Game storage game = games[gameId];
        game.player1 = msg.sender;
        game.state = GameState.WAITING;
        playerInGame[msg.sender] = true;
        emit GameCreated(gameId, msg.sender);
    }

    /// @notice 加入等待中的对局，成为 player2 并开始对局。
    /// @param gameId 目标对局 ID。
    function joinGame(uint256 gameId) external {
        if (playerInGame[msg.sender]) revert AlreadyInGame();
        Game storage game = games[gameId];
        if (game.state != GameState.WAITING) revert GameNotAvailable();
        if (msg.sender == game.player1) revert CannotPlayAgainstYourself();

        game.player2 = msg.sender;
        game.currentTurn = game.player1;
        game.state = GameState.PLAYING;
        game.lastMoveAt = block.timestamp;
        playerInGame[msg.sender] = true;
        emit PlayerJoined(gameId, msg.sender);
    }

    /// @notice 取消等待中的对局（仅创建者可调用）。
    /// @param gameId 目标对局 ID。
    /// @dev 取消局不写入历史与排行榜，仅释放 player1 占位。
    function cancelGame(uint256 gameId) external {
        Game storage game = games[gameId];
        if (game.state != GameState.WAITING) revert GameNotAvailable();
        if (msg.sender != game.player1) revert NotGameCreator();

        game.state = GameState.FINISHED;
        game.winner = address(0);
        playerInGame[game.player1] = false;

        emit GameCancelled(gameId);
    }

    /// @notice 对局进行中任一参与方可主动认输。
    /// @param gameId 目标对局 ID。
    function resign(uint256 gameId) external {
        Game storage game = games[gameId];
        if (game.state != GameState.PLAYING) revert GameNotAvailable();
        if (msg.sender != game.player1 && msg.sender != game.player2) revert NotParticipant();

        address winner = (msg.sender == game.player1) ? game.player2 : game.player1;
        _finishWithWinner(gameId, game, winner);

        emit GameWon(gameId, winner);
    }

    /// @notice 在当前回合落子。
    /// @param gameId 目标对局 ID。
    /// @param position 落子位置（0-8）。
    /// @dev 本函数负责胜负判定、平局判定与回合切换。
    function makeMove(uint256 gameId, uint8 position) external {
        Game storage game = games[gameId];
        if (game.state != GameState.PLAYING) revert GameNotAvailable();
        if (msg.sender != game.currentTurn) revert NotYourTurn();
        if (position >= 9) revert InvalidPosition();
        if (game.board[position] != 0) revert PositionAlreadyTaken();

        uint8 piece = (msg.sender == game.player1) ? 1 : 2;
        game.board[position] = piece;
        emit MoveMade(gameId, msg.sender, position);

        if (checkWin(game.board, piece)) {
            _finishWithWinner(gameId, game, msg.sender);
            emit GameWon(gameId, msg.sender);
            return;
        }

        if (isDraw(game.board)) {
            _finishAsDraw(gameId, game);
            emit GameDrawn(gameId);
            return;
        }

        game.currentTurn = (msg.sender == game.player1)
            ? game.player2
            : game.player1;
        game.lastMoveAt = block.timestamp;
    }

    /// @dev 判断指定棋子是否形成三连获胜。
    /// @param board 当前棋盘。
    /// @param piece 棋子编码（1=X, 2=O）。
    /// @return 是否满足获胜条件。
    function checkWin(
        uint8[9] memory board,
        uint8 piece
    ) internal pure returns (bool) {
        uint8[3][8] memory winLines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];

        for (uint256 i = 0; i < 8; i++) {
            if (
                board[winLines[i][0]] == piece &&
                board[winLines[i][1]] == piece &&
                board[winLines[i][2]] == piece
            ) {
                return true;
            }
        }
        return false;
    }

    /// @dev 判断棋盘是否已满且无人获胜。
    /// @param board 当前棋盘。
    /// @return 是否为平局。
    function isDraw(uint8[9] memory board) internal pure returns (bool) {
        for (uint8 i = 0; i < 9; i++) {
            if (board[i] == 0) {
                return false;
            }
        }
        return true;
    }

    /// @notice 获取对局状态快照。
    /// @param gameId 对局 ID。
    /// @return player1 玩家1地址。
    /// @return player2 玩家2地址。
    /// @return currentTurn 当前回合地址。
    /// @return board 棋盘状态。
    /// @return state 对局状态。
    /// @return winner 胜者地址（平局为 0 地址）。
    function getGameState(
        uint256 gameId
    )
        external
        view
        returns (
            address player1,
            address player2,
            address currentTurn,
            uint8[9] memory board,
            GameState state,
            address winner
        )
    {
        Game storage game = games[gameId];
        return (
            game.player1,
            game.player2,
            game.currentTurn,
            game.board,
            game.state,
            game.winner
        );
    }

    /// @notice 获取回合计时信息。
    /// @param gameId 对局 ID。
    /// @return lastMoveAt 上次落子时间戳。
    /// @return turnTimeout 回合超时时长（秒）。
    function getTimeInfo(uint256 gameId) external view returns (uint256 lastMoveAt, uint256 turnTimeout) {
        Game storage game = games[gameId];
        return (game.lastMoveAt, DEFAULT_TURN_TIMEOUT);
    }

    /// @notice 在对手超时后发起判胜。
    /// @param gameId 对局 ID。
    /// @dev 仅非当前回合参与方可在超时后调用；lastMoveAt 代表当前行动方开始计时的时间点。
    function claimTimeoutWin(uint256 gameId) external {
        Game storage game = games[gameId];
        if (game.state != GameState.PLAYING) revert GameNotAvailable();
        if (msg.sender != game.player1 && msg.sender != game.player2) revert NotParticipant();
        if (msg.sender == game.currentTurn) revert NotEligibleToClaim();
        if (block.timestamp < game.lastMoveAt + DEFAULT_TURN_TIMEOUT) revert TimeoutNotReached();

        _finishWithWinner(gameId, game, msg.sender);
        emit GameWon(gameId, msg.sender);
    }

    /// @notice 获取某玩家历史记录总条数。
    /// @param player 玩家地址。
    /// @return 历史记录条数。
    function getPlayerHistoryCount(address player) external view returns (uint256) {
        return playerHistories[player].length;
    }

    /// @notice 分页读取玩家历史记录（按时间倒序）。
    /// @param player 玩家地址。
    /// @param offset 偏移量（最新一局为 0）。
    /// @param limit 读取条数上限。
    /// @return page 历史记录页。
    /// @dev 历史存储是追加写入，这里通过反向索引把 offset=0 对齐到最新一局。
    function getPlayerHistoryPage(
        address player,
        uint256 offset,
        uint256 limit
    ) external view returns (PlayerHistoryEntry[] memory page) {
        uint256 total = playerHistories[player].length;
        if (offset >= total || limit == 0) {
            return new PlayerHistoryEntry[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 size = end - offset;
        page = new PlayerHistoryEntry[](size);
        for (uint256 i = 0; i < size; i++) {
            uint256 idx = total - 1 - (offset + i);
            page[i] = playerHistories[player][idx];
        }
    }

    /// @notice 获取排行榜玩家总数。
    /// @return 排行榜玩家数量。
    function getLeaderboardCount() external view returns (uint256) {
        return leaderboardPlayers.length;
    }

    /// @notice 分页读取排行榜原始数据（未排序）。
    /// @param offset 偏移量。
    /// @param limit 读取条数上限。
    /// @return page 排行榜数据页。
    /// @dev 返回顺序等于 leaderboardPlayers 的登记顺序，排序由前端按总分/局数/地址完成。
    function getLeaderboardPage(
        uint256 offset,
        uint256 limit
    ) external view returns (LeaderboardEntry[] memory page) {
        uint256 total = leaderboardPlayers.length;
        if (offset >= total || limit == 0) {
            return new LeaderboardEntry[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 size = end - offset;
        page = new LeaderboardEntry[](size);
        for (uint256 i = 0; i < size; i++) {
            address player = leaderboardPlayers[offset + i];
            PlayerStats storage stats = playerStats[player];
            page[i] = LeaderboardEntry({
                player: player,
                gamesPlayed: stats.gamesPlayed,
                totalScore: stats.totalScore
            });
        }
    }

    /// @dev 以指定赢家结束对局，并写入统计。
    function _finishWithWinner(
        uint256 gameId,
        Game storage game,
        address winner
    ) internal {
        game.state = GameState.FINISHED;
        game.winner = winner;
        _clearPlayerInGame(game);
        _recordFinishedGame(gameId, game.player1, game.player2, winner, false);
    }

    /// @dev 以平局结束对局，并写入统计。
    function _finishAsDraw(uint256 gameId, Game storage game) internal {
        game.state = GameState.FINISHED;
        game.winner = address(0);
        _clearPlayerInGame(game);
        _recordFinishedGame(gameId, game.player1, game.player2, address(0), true);
    }

    /// @dev 清理 playerInGame 占位，允许玩家进入下一局。
    function _clearPlayerInGame(Game storage game) internal {
        playerInGame[game.player1] = false;
        playerInGame[game.player2] = false;
    }

    /// @dev 根据胜负结果写入双方统计与历史。
    function _recordFinishedGame(
        uint256 gameId,
        address player1,
        address player2,
        address winner,
        bool isDrawGame
    ) internal {
        _registerLeaderboardPlayer(player1);
        _registerLeaderboardPlayer(player2);

        if (isDrawGame) {
            _applyStatsAndHistory(gameId, player1, player2, MatchResult.DRAW, 0);
            _applyStatsAndHistory(gameId, player2, player1, MatchResult.DRAW, 0);
            return;
        }

        if (winner == player1) {
            _applyStatsAndHistory(gameId, player1, player2, MatchResult.WIN, 1);
            _applyStatsAndHistory(gameId, player2, player1, MatchResult.LOSS, -1);
        } else {
            _applyStatsAndHistory(gameId, player1, player2, MatchResult.LOSS, -1);
            _applyStatsAndHistory(gameId, player2, player1, MatchResult.WIN, 1);
        }
    }

    /// @dev 对单个玩家写入一条统计与历史记录。
    function _applyStatsAndHistory(
        uint256 gameId,
        address player,
        address opponent,
        MatchResult result,
        int8 scoreDelta
    ) internal {
        PlayerStats storage stats = playerStats[player];
        stats.gamesPlayed += 1;
        stats.totalScore += int256(scoreDelta);

        playerHistories[player].push(
            PlayerHistoryEntry({
                gameId: gameId,
                opponent: opponent,
                result: result,
                scoreDelta: scoreDelta,
                endedAt: block.timestamp
            })
        );
    }

    /// @dev 将玩家加入排行榜索引（幂等）。
    function _registerLeaderboardPlayer(address player) internal {
        if (isLeaderboardPlayer[player]) {
            return;
        }
        isLeaderboardPlayer[player] = true;
        leaderboardPlayers.push(player);
    }
}
