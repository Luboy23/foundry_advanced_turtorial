// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LightsOutResults
/// @notice 记录 LightsOut 通关结果（最新记录 + 按配置最佳）
/// @dev 以 gridSize + density 作为配置键，便于区分不同难度
contract LightsOutResults {
    /// @notice 单次通关结果
    struct Result {
        address player; // 玩家地址
        uint8 gridSize; // 棋盘大小
        uint8 density; // 密度等级
        uint32 moves; // 步数
        uint32 durationMs; // 用时（毫秒）
        uint64 finishedAt; // 完成时间戳
        bool usedHint; // 是否使用提示
    }

    /// @dev 玩家最新一次结果
    mapping(address => Result) private latestResult;
    /// @dev 玩家在不同配置下的最佳结果
    mapping(address => mapping(bytes32 => Result)) private bestByConfig;

    /// @notice 玩家提交成绩时触发
    /// @param player 玩家地址
    /// @param gridSize 棋盘大小
    /// @param density 密度等级
    /// @param moves 步数
    /// @param durationMs 用时（毫秒）
    /// @param finishedAt 完成时间戳
    /// @param usedHint 是否使用提示
    event ResultSubmitted(
        address indexed player,
        uint8 indexed gridSize,
        uint8 indexed density,
        uint32 moves,
        uint32 durationMs,
        uint64 finishedAt,
        bool usedHint
    );

    /// @notice 提交成绩并更新最新/最佳记录
    /// @param gridSize 棋盘大小
    /// @param density 密度等级
    /// @param moves 步数
    /// @param durationMs 用时（毫秒）
    /// @param usedHint 是否使用提示
    function submitResult(
        uint8 gridSize,
        uint8 density,
        uint32 moves,
        uint32 durationMs,
        bool usedHint
    ) external {
        // 仅接受教学项目定义的棋盘规模与密度枚举，避免前端传入脏数据
        require(_validGridSize(gridSize), "Invalid grid size");
        require(density <= 2, "Invalid density");

        uint64 finishedAt = uint64(block.timestamp);
        // 先构建内存结构，后续分别写入 latest 与 best，减少重复字段赋值
        Result memory result = Result({
            player: msg.sender,
            gridSize: gridSize,
            density: density,
            moves: moves,
            durationMs: durationMs,
            finishedAt: finishedAt,
            usedHint: usedHint
        });

        // latest 记录始终覆盖，用于“最近一局”展示
        latestResult[msg.sender] = result;

        // best 按配置维度独立维护，避免 4x4 与 6x6 互相覆盖成绩
        bytes32 key = _configKey(gridSize, density);
        Result storage best = bestByConfig[msg.sender][key];
        // 最优判定规则：
        // 1) 首次提交直接写入
        // 2) 步数更少更优
        // 3) 步数相同则耗时更短更优
        if (
            best.player == address(0) ||
            moves < best.moves ||
            (moves == best.moves && durationMs < best.durationMs)
        ) {
            bestByConfig[msg.sender][key] = result;
        }

        // 事件作为前端索引与排行榜刷新依据，字段尽量完整
        emit ResultSubmitted(
            msg.sender,
            gridSize,
            density,
            moves,
            durationMs,
            finishedAt,
            usedHint
        );
    }

    /// @notice 获取玩家最新成绩
    /// @param player 玩家地址
    /// @return result 最新成绩
    function getLatest(address player) external view returns (Result memory) {
        return latestResult[player];
    }

    /// @notice 获取玩家在指定配置下的最佳成绩
    /// @param player 玩家地址
    /// @param gridSize 棋盘大小
    /// @param density 密度等级
    /// @return result 最佳成绩
    function getBest(
        address player,
        uint8 gridSize,
        uint8 density
    ) external view returns (Result memory) {
        return bestByConfig[player][_configKey(gridSize, density)];
    }

    /// @dev 生成配置 key：gridSize + density
    function _configKey(
        uint8 gridSize,
        uint8 density
    ) private pure returns (bytes32) {
        return keccak256(abi.encode(gridSize, density));
    }

    /// @dev 校验棋盘大小是否在允许范围
    function _validGridSize(uint8 gridSize) private pure returns (bool) {
        return gridSize == 4 || gridSize == 5 || gridSize == 6;
    }
}
