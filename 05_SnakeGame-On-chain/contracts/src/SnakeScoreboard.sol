// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SnakeScoreboard
/// @notice 记录贪吃蛇成绩（全局排行榜 + 个人历史）
/// @dev 使用固定长度数组与环形缓冲，控制存储规模
contract SnakeScoreboard {
    /// @notice 排行榜/个人历史最大记录数
    uint8 public constant MAX_RECORDS = 20;

    /// @notice 全局排行榜记录结构（包含玩家地址）
    struct GlobalEntry {
        address player; // 玩家地址
        uint32 score; // 分数
        uint32 durationSec; // 用时（秒）
        uint16 speedPeak; // 最高速度
        uint64 timestamp; // 提交时间戳
    }

    /// @notice 个人历史记录结构（不包含玩家地址）
    struct UserEntry {
        uint32 score; // 分数
        uint32 durationSec; // 用时（秒）
        uint16 speedPeak; // 最高速度
        uint64 timestamp; // 提交时间戳
    }

    /// @dev 全局 TopN 列表（固定容量）
    GlobalEntry[MAX_RECORDS] private globalTop;
    /// @dev 全局榜单当前数量
    uint8 private globalCount;
    /// @dev 每个玩家的历史记录（环形缓冲）
    mapping(address => UserEntry[MAX_RECORDS]) private userRecent;
    /// @dev 玩家历史数量
    mapping(address => uint8) private userCount;
    /// @dev 环形写入索引
    mapping(address => uint8) private userIndex;

    /// @notice 当玩家提交成绩时触发
    /// @param player 提交者地址
    /// @param score 分数
    /// @param durationSec 用时（秒）
    /// @param speedPeak 最高速度
    /// @param timestamp 区块时间戳
    event ScoreSubmitted(
        address indexed player,
        uint32 score,
        uint32 durationSec,
        uint16 speedPeak,
        uint64 timestamp
    );

    /// @notice 提交成绩并更新排行榜与个人历史
    /// @param score 分数
    /// @param durationSec 用时（秒）
    /// @param speedPeak 最高速度
    function submitScore(
        uint32 score,
        uint32 durationSec,
        uint16 speedPeak
    ) external {
        require(score > 0, "Score must be > 0");

        GlobalEntry memory globalEntry = GlobalEntry({
            player: msg.sender,
            score: score,
            durationSec: durationSec,
            speedPeak: speedPeak,
            timestamp: uint64(block.timestamp)
        });

        UserEntry memory userEntry = UserEntry({
            score: score,
            durationSec: durationSec,
            speedPeak: speedPeak,
            timestamp: globalEntry.timestamp
        });

        _insertGlobal(globalEntry);
        _insertUser(msg.sender, userEntry);

        emit ScoreSubmitted(
            msg.sender,
            score,
            durationSec,
            speedPeak,
            globalEntry.timestamp
        );
    }

    /// @notice 获取全局排行榜（按排序规则返回）
    /// @return entries 排行榜条目数组
    function getGlobalTop() external view returns (GlobalEntry[] memory) {
        GlobalEntry[] memory result = new GlobalEntry[](globalCount);
        for (uint8 i = 0; i < globalCount; i++) {
            result[i] = globalTop[i];
        }
        return result;
    }

    /// @notice 获取玩家近期成绩（按环形缓冲顺序输出）
    /// @param user 玩家地址
    /// @return entries 该玩家近期成绩数组
    function getUserRecent(address user) external view returns (UserEntry[] memory) {
        uint8 count = userCount[user];
        UserEntry[] memory result = new UserEntry[](count);
        if (count == 0) {
            return result;
        }

        if (count < MAX_RECORDS) {
            for (uint8 i = 0; i < count; i++) {
                result[i] = userRecent[user][i];
            }
            return result;
        }

        uint8 start = userIndex[user];
        for (uint8 i = 0; i < count; i++) {
            uint8 idx = uint8((start + i) % MAX_RECORDS);
            result[i] = userRecent[user][idx];
        }
        return result;
    }

    /// @notice 获取全局榜单条目数
    /// @return count 当前榜单数量
    function getGlobalCount() external view returns (uint8) {
        return globalCount;
    }

    /// @notice 获取玩家历史记录数量
    /// @param user 玩家地址
    /// @return count 该玩家历史数量
    function getUserCount(address user) external view returns (uint8) {
        return userCount[user];
    }

    /// @dev 插入全局榜单（低分直接忽略）
    function _insertGlobal(GlobalEntry memory entry) private {
        if (globalCount < MAX_RECORDS) {
            globalTop[globalCount] = entry;
            globalCount += 1;
            _bubbleUp(globalCount - 1);
            return;
        }

        if (!_isBetter(entry, globalTop[globalCount - 1])) {
            return;
        }

        globalTop[globalCount - 1] = entry;
        _bubbleUp(globalCount - 1);
    }

    /// @dev 向前冒泡排序，维持排行榜降序
    function _bubbleUp(uint8 index) private {
        uint8 i = index;
        while (i > 0 && _isBetter(globalTop[i], globalTop[i - 1])) {
            GlobalEntry memory temp = globalTop[i - 1];
            globalTop[i - 1] = globalTop[i];
            globalTop[i] = temp;
            i -= 1;
        }
    }

    /// @dev 写入玩家历史（环形覆盖）
    function _insertUser(address player, UserEntry memory entry) private {
        uint8 index = userIndex[player];
        userRecent[player][index] = entry;
        if (userCount[player] < MAX_RECORDS) {
            userCount[player] += 1;
        }
        userIndex[player] = uint8((index + 1) % MAX_RECORDS);
    }

    /// @dev 排序规则：分数优先，其次时间戳
    function _isBetter(GlobalEntry memory a, GlobalEntry memory b) private pure returns (bool) {
        if (a.score > b.score) return true;
        if (a.score < b.score) return false;
        if (a.timestamp > b.timestamp) return true;
        if (a.timestamp < b.timestamp) return false;
        return false;
    }
}
