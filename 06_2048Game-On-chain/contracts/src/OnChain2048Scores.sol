// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title OnChain2048Scores
/// @notice 记录 2048 游戏成绩、历史记录与排行榜
/// @dev 使用环形缓冲与固定长度排行榜限制存储
contract OnChain2048Scores {
    /// @notice 单条成绩记录
    struct ScoreEntry {
        address player; // 玩家地址
        uint64 score; // 分数
        uint32 duration; // 用时（秒）
        uint64 timestamp; // 提交时间戳
    }

    /// @notice 排行榜最大容量
    uint8 public constant MAX_LEADERBOARD = 10;
    /// @notice 单个玩家历史最大记录数
    uint32 public constant MAX_HISTORY = 50;

    /// @dev 玩家历史环形缓冲
    struct HistoryBuffer {
        uint32 head; // 下一次写入位置
        uint32 count; // 历史数量（<= MAX_HISTORY）
        mapping(uint32 => ScoreEntry) entries; // 索引到成绩记录
    }

    /// @notice 玩家最佳分数
    mapping(address => uint64) public bestScores;
    /// @dev 玩家历史成绩
    mapping(address => HistoryBuffer) private histories;
    /// @dev 全局排行榜（按分数降序）
    ScoreEntry[] private leaderboard;

    /// @notice 提交成绩时触发
    /// @param player 提交者地址
    /// @param score 分数
    /// @param duration 用时（秒）
    /// @param previousBest 提交前的最佳分
    /// @param isNewBest 是否刷新最佳分
    event ScoreSubmitted(
        address indexed player,
        uint64 score,
        uint32 duration,
        uint64 previousBest,
        bool isNewBest
    );

    /// @notice 提交成绩并更新历史/排行榜
    /// @param score 分数
    /// @param duration 用时（秒）
    function submitScore(uint64 score, uint32 duration) external {
        require(score > 0, "score=0");

        // 先更新玩家最佳分，再落库当前这局记录。
        uint64 previous = bestScores[msg.sender];
        bool isNewBest = score > previous;
        if (isNewBest) {
            bestScores[msg.sender] = score;
        }

        // 统一构造本次提交条目，复用到历史记录和排行榜。
        ScoreEntry memory entry = ScoreEntry({
            player: msg.sender,
            score: score,
            duration: duration,
            timestamp: uint64(block.timestamp)
        });

        // 历史记录无论是否上榜都保留，排行榜按 Top N 规则更新。
        _pushHistory(msg.sender, entry);
        _upsertLeaderboard(entry);

        emit ScoreSubmitted(
            msg.sender,
            score,
            duration,
            previous,
            isNewBest
        );
    }

    /// @notice 获取排行榜
    /// @return entries 排行榜条目数组
    function getLeaderboard() external view returns (ScoreEntry[] memory) {
        return leaderboard;
    }

    /// @notice 获取玩家历史数量
    /// @param player 玩家地址
    /// @return count 历史数量
    function getPlayerHistoryCount(address player) external view returns (uint256) {
        return histories[player].count;
    }

    /// @notice 获取玩家历史（按最新优先分页）
    /// @param player 玩家地址
    /// @param offset 起始偏移（从最新记录开始）
    /// @param limit 返回条数上限
    /// @return entries 历史记录数组
    function getPlayerHistory(
        address player,
        uint256 offset,
        uint256 limit
    ) external view returns (ScoreEntry[] memory) {
        HistoryBuffer storage buffer = histories[player];
        uint256 count = buffer.count;
        if (offset >= count || limit == 0) {
            return new ScoreEntry[](0);
        }

        uint256 remaining = count - offset;
        uint256 size = limit < remaining ? limit : remaining;
        ScoreEntry[] memory result = new ScoreEntry[](size);
        uint256 maxHistory = uint256(MAX_HISTORY);

        // head 指向“下一次写入位”，倒序读取时要先回退一位再叠加 offset。
        for (uint256 i = 0; i < size; i++) {
            uint256 indexFromHead =
                (uint256(buffer.head) + count - 1 - (offset + i)) % maxHistory;
            result[i] = buffer.entries[uint32(indexFromHead)];
        }

        return result;
    }

    /// @notice 获取排行榜条目数
    /// @return length 排行榜数量
    function leaderboardLength() external view returns (uint256) {
        return leaderboard.length;
    }

    /// @dev 插入或更新排行榜（低分直接忽略）
    function _upsertLeaderboard(ScoreEntry memory entry) internal {
        uint256 length = leaderboard.length;

        // 未满时直接插入，再排序。
        if (length < MAX_LEADERBOARD) {
            leaderboard.push(entry);
            _sortLeaderboard();
            return;
        }

        // 已满时先找当前最低分，再决定是否替换。
        uint256 lowestIndex = 0;
        uint64 lowestScore = leaderboard[0].score;
        for (uint256 i = 1; i < length; i++) {
            if (leaderboard[i].score < lowestScore) {
                lowestScore = leaderboard[i].score;
                lowestIndex = i;
            }
        }

        if (entry.score <= lowestScore) {
            return;
        }

        // 只有新成绩严格大于最低分才会进入 Top N。
        leaderboard[lowestIndex] = entry;
        _sortLeaderboard();
    }

    /// @dev 写入玩家历史（环形覆盖）
    function _pushHistory(address player, ScoreEntry memory entry) internal {
        HistoryBuffer storage buffer = histories[player];
        // 历史未满时顺序追加，保留完整时间线。
        if (buffer.count < MAX_HISTORY) {
            uint32 index = buffer.count;
            buffer.entries[index] = entry;
            buffer.count += 1;
            return;
        }

        // 历史已满时覆盖 head，并将 head 向后推进一格形成环。
        uint32 head = buffer.head;
        buffer.entries[head] = entry;
        buffer.head = head + 1;
        if (buffer.head >= MAX_HISTORY) {
            buffer.head = 0;
        }
    }

    /// @dev 排序规则：分数优先，同分按时间戳更早优先
    function _sortLeaderboard() internal {
        // 排行榜长度上限 10，使用 O(n^2) 排序足够且实现简单直观。
        uint256 length = leaderboard.length;
        for (uint256 i = 0; i < length; i++) {
            for (uint256 j = i + 1; j < length; j++) {
                if (
                    leaderboard[j].score > leaderboard[i].score ||
                    (leaderboard[j].score == leaderboard[i].score &&
                        leaderboard[j].timestamp < leaderboard[i].timestamp)
                ) {
                    ScoreEntry memory temp = leaderboard[i];
                    leaderboard[i] = leaderboard[j];
                    leaderboard[j] = temp;
                }
            }
        }
    }
}
