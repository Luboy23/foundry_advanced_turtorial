// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/// @title FlappyScoreboard
/// @notice 记录玩家历史成绩与 Top10 排行榜的简单合约
contract FlappyScoreboard {
    /// @notice 排行榜最大容量（固定为 10）
    uint256 public constant MAX_LEADERBOARD = 10;

    /// @notice 排行榜条目结构
    struct LeaderboardEntry {
        address player;
        uint256 score;
        uint256 timestamp;
    }

    /// @notice 每个玩家的历史最佳分
    mapping(address => uint256) public bestScore;
    /// @notice Top10 排行榜（按分数降序）
    LeaderboardEntry[] private leaderboard;

    /// @notice 当玩家提交成绩时触发
    /// @param player 提交者地址
    /// @param score 本次提交分数
    /// @param timestamp 提交时间戳（区块时间）
    /// @param isBest 是否为个人最佳
    event ScoreSubmitted(address indexed player, uint256 score, uint256 timestamp, bool isBest);

    /// @notice 提交成绩并更新排行榜（若为个人最佳）
    /// @param score 本次成绩
    function submitScore(uint256 score) external {
        // 判断是否突破个人最佳
        bool isBest = score > bestScore[msg.sender];
        if (isBest) {
            // 更新个人最佳并尝试更新榜单
            bestScore[msg.sender] = score;
            _upsertLeaderboard(msg.sender, score);
        }

        // 广播事件供前端监听
        emit ScoreSubmitted(msg.sender, score, block.timestamp, isBest);
    }

    /// @notice 获取当前 Top10 排行榜
    /// @return players 玩家地址数组
    /// @return scores 分数数组
    /// @return timestamps 时间戳数组
    function getLeaderboard()
        external
        view
        returns (address[] memory players, uint256[] memory scores, uint256[] memory timestamps)
    {
        uint256 length = leaderboard.length;
        players = new address[](length);
        scores = new uint256[](length);
        timestamps = new uint256[](length);

        // 拆分结构体数组为三个数组返回（便于前端使用）
        for (uint256 i = 0; i < length; i++) {
            LeaderboardEntry memory entry = leaderboard[i];
            players[i] = entry.player;
            scores[i] = entry.score;
            timestamps[i] = entry.timestamp;
        }
    }

    /// @notice 当前排行榜条目数
    /// @return length 排行榜中条目数量
    function leaderboardLength() external view returns (uint256) {
        return leaderboard.length;
    }

    /// @notice 将玩家成绩插入或更新排行榜，并保持降序
    /// @param player 玩家地址
    /// @param score 分数
    function _upsertLeaderboard(address player, uint256 score) internal {
        uint256 length = leaderboard.length;
        uint256 index = length;

        // 查找玩家是否已在榜上
        for (uint256 i = 0; i < length; i++) {
            if (leaderboard[i].player == player) {
                index = i;
                break;
            }
        }

        if (index < length) {
            // 已存在：更新分数与时间
            leaderboard[index].score = score;
            leaderboard[index].timestamp = block.timestamp;
        } else {
            if (length < MAX_LEADERBOARD) {
                // 未满：直接插入
                leaderboard.push(LeaderboardEntry({player: player, score: score, timestamp: block.timestamp}));
                index = length;
            } else {
                // 已满：低于榜尾则忽略，否则替换榜尾
                if (score <= leaderboard[length - 1].score) {
                    return;
                }
                leaderboard[length - 1] = LeaderboardEntry({player: player, score: score, timestamp: block.timestamp});
                index = length - 1;
            }
        }

        // 向前冒泡排序，保证分数降序
        while (index > 0 && leaderboard[index].score > leaderboard[index - 1].score) {
            LeaderboardEntry memory temp = leaderboard[index - 1];
            leaderboard[index - 1] = leaderboard[index];
            leaderboard[index] = temp;
            index--;
        }
    }
}
