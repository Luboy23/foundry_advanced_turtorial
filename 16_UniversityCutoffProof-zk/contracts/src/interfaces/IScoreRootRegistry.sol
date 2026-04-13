// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title 成绩源登记接口
/// @notice 统一暴露考试院发布的成绩源读取与管理能力。
interface IScoreRootRegistry {
    /// @dev 描述某一届成绩源在链上的最小事实集合。
    struct ScoreSource {
        /// @notice 成绩源唯一标识。
        bytes32 scoreSourceId;
        /// @notice 成绩源标题，例如 2026 全国统一高考。
        string sourceTitle;
        /// @notice 成绩树根，用于约束学生成绩凭证必须来自这份官方成绩数据。
        uint256 merkleRoot;
        /// @notice 当前成绩源的总分上限。
        uint32 maxScore;
        /// @notice 链上发布时间戳。
        uint64 issuedAt;
        /// @notice 发布该成绩源的考试院地址。
        address issuer;
        /// @notice 成绩源是否处于启用状态。
        bool active;
    }

    /// @notice 创建新的成绩源。
    function createScoreSource(
        bytes32 scoreSourceId,
        string calldata sourceTitle,
        uint32 maxScore,
        uint256 merkleRoot
    ) external;

    /// @notice 更新既有成绩源的树根。
    function updateMerkleRoot(bytes32 scoreSourceId, uint256 newMerkleRoot) external;

    /// @notice 调整成绩源启用状态。
    function setSourceStatus(bytes32 scoreSourceId, bool active) external;

    /// @notice 读取成绩源详情。
    function getScoreSource(bytes32 scoreSourceId) external view returns (ScoreSource memory);
}
