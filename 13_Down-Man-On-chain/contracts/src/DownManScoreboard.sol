// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DownManScoreboard
/// @notice 记录 DownMan 的链上排行榜、个人历史与个人最佳分
/// @dev 排行榜允许同地址重复上榜；历史使用环形缓冲限制为 50 条
contract DownManScoreboard {
    /// @notice 分数必须大于 0
    error ScoreMustBeGreaterThanZero();

    /// @notice 单条成绩记录
    struct ScoreEntry {
        address player; // 玩家地址
        uint32 score; // 分数
        uint32 survivalMs; // 生存时长（毫秒）
        uint32 totalDodged; // 躲避总数
        uint64 finishedAt; // 提交时间戳
    }

    /// @notice 排行榜最大容量（Top10）
    uint8 public constant MAX_LEADERBOARD = 10;
    /// @notice 单个玩家历史最大容量
    uint32 public constant MAX_HISTORY = 50;

    /// @dev 玩家历史环形缓冲
    struct HistoryBuffer {
        uint32 head; // 下一次写入位置
        uint32 count; // 当前已保存数量（<= MAX_HISTORY）
        mapping(uint32 => ScoreEntry) entries; // 索引 -> 记录
    }

    /// @notice 玩家最佳分（用于前端 HUD）
    mapping(address => uint32) public bestScoreOf;
    /// @dev 玩家历史记录
    mapping(address => HistoryBuffer) private histories;
    /// @dev 全局 Top10 排行榜
    ScoreEntry[] private leaderboard;

    /// @notice 玩家提交成绩事件
    /// @param player 提交者地址
    /// @param score 本局分数
    /// @param survivalMs 生存时长（毫秒）
    /// @param totalDodged 躲避总数
    /// @param finishedAt 提交时间戳
    event ScoreSubmitted(
        address indexed player,
        uint32 score,
        uint32 survivalMs,
        uint32 totalDodged,
        uint64 finishedAt
    );

    /// @notice 提交一局成绩，并更新历史、排行榜与最佳分
    /// @param score 本局分数（必须 > 0）
    /// @param survivalMs 生存时长（毫秒）
    /// @param totalDodged 躲避总数
    function submitScore(
        uint32 score,
        uint32 survivalMs,
        uint32 totalDodged
    ) external {
        if (score == 0) {
            revert ScoreMustBeGreaterThanZero();
        }

        uint64 finishedAt = uint64(block.timestamp);
        ScoreEntry memory entry = ScoreEntry({
            player: msg.sender,
            score: score,
            survivalMs: survivalMs,
            totalDodged: totalDodged,
            finishedAt: finishedAt
        });

        if (score > bestScoreOf[msg.sender]) {
            bestScoreOf[msg.sender] = score;
        }

        _pushHistory(msg.sender, entry);
        _upsertLeaderboard(entry);

        emit ScoreSubmitted(
            msg.sender,
            score,
            survivalMs,
            totalDodged,
            finishedAt
        );
    }

    /// @notice 获取全局排行榜（已按规则排序）
    /// @return entries Top10 成绩列表
    function getLeaderboard() external view returns (ScoreEntry[] memory) {
        return leaderboard;
    }

    /// @notice 获取玩家历史数量
    /// @param player 玩家地址
    /// @return count 历史条数
    function getUserHistoryCount(address player) external view returns (uint256) {
        return histories[player].count;
    }

    /// @notice 获取玩家历史（按“最新优先”分页）
    /// @param player 玩家地址
    /// @param offset 偏移量（0 表示最新一条）
    /// @param limit 本次最多返回条数
    /// @return entries 历史记录数组
    function getUserHistory(
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
        uint256 historyCap = uint256(MAX_HISTORY);

        // head 指向下一次写入位置；倒序读取时从最新一位往回偏移。
        for (uint256 i = 0; i < size; i++) {
            uint256 indexFromHead =
                (uint256(buffer.head) + count - 1 - (offset + i)) % historyCap;
            result[i] = buffer.entries[uint32(indexFromHead)];
        }

        return result;
    }

    /// @dev 写入玩家历史（满 50 后环形覆盖最旧数据）
    function _pushHistory(address player, ScoreEntry memory entry) private {
        HistoryBuffer storage buffer = histories[player];

        if (buffer.count < MAX_HISTORY) {
            uint32 index = buffer.count;
            buffer.entries[index] = entry;
            buffer.count += 1;
            return;
        }

        uint32 head = buffer.head;
        buffer.entries[head] = entry;
        buffer.head = head + 1;
        if (buffer.head >= MAX_HISTORY) {
            buffer.head = 0;
        }
    }

    /// @dev 更新排行榜：通过插入位查找 + 局部移动维护有序 Top10
    function _upsertLeaderboard(ScoreEntry memory entry) private {
        uint256 length = leaderboard.length;
        uint256 insertIndex = _findInsertIndex(entry, length);

        if (length >= MAX_LEADERBOARD && insertIndex >= length) {
            return;
        }

        if (length < MAX_LEADERBOARD) {
            leaderboard.push(entry);
            for (uint256 i = length; i > insertIndex; i--) {
                leaderboard[i] = leaderboard[i - 1];
            }
            leaderboard[insertIndex] = entry;
            return;
        }

        // 满榜时只在“有资格进入榜单”情况下插入，并挤掉榜尾。
        for (uint256 i = length - 1; i > insertIndex; i--) {
            leaderboard[i] = leaderboard[i - 1];
        }
        leaderboard[insertIndex] = entry;
    }

    /// @dev 查找 entry 应插入的位置；若返回 length 代表应位于榜尾之后
    function _findInsertIndex(
        ScoreEntry memory entry,
        uint256 length
    ) private view returns (uint256) {
        for (uint256 i = 0; i < length; i++) {
            if (_isBetter(entry, leaderboard[i])) {
                return i;
            }
        }
        return length;
    }

    /// @dev 比较规则：a 是否优于 b
    function _isBetter(
        ScoreEntry memory a,
        ScoreEntry memory b
    ) private pure returns (bool) {
        if (a.score > b.score) return true;
        if (a.score < b.score) return false;

        if (a.survivalMs > b.survivalMs) return true;
        if (a.survivalMs < b.survivalMs) return false;

        if (a.finishedAt < b.finishedAt) return true;
        return false;
    }
}
