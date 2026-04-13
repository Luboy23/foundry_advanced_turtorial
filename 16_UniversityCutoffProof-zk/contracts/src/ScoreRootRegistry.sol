// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IAdmissionRoleRegistry } from "./interfaces/IAdmissionRoleRegistry.sol";
import { IScoreRootRegistry } from "./interfaces/IScoreRootRegistry.sol";

/// @title 官方成绩源登记合约
/// @notice 由考试院统一发布和维护某一届高考成绩的链上根信息。
/// @dev 合约只保存成绩树根和元数据，不保存任何学生明文成绩。
contract ScoreRootRegistry is IScoreRootRegistry {
    /// @dev 成绩源编号一旦创建完成，就不应该再被新的成绩树根配置覆盖。
    error ScoreSourceAlreadyExists(bytes32 scoreSourceId);
    error ScoreSourceNotFound(bytes32 scoreSourceId);
    error InvalidMerkleRoot();
    error InvalidMaxScore(uint32 maxScore);
    error ZeroAddress();
    error Unauthorized(address caller);

    IAdmissionRoleRegistry public immutable roleRegistry;
    mapping(bytes32 => ScoreSource) private s_scoreSources;

    event ScoreSourceCreated(
        bytes32 indexed scoreSourceId,
        string sourceTitle,
        uint32 maxScore,
        uint256 merkleRoot,
        address indexed issuer
    );
    event ScoreSourceRootUpdated(bytes32 indexed scoreSourceId, uint256 merkleRoot);
    event ScoreSourceStatusUpdated(bytes32 indexed scoreSourceId, bool active);

    /// @param roleRegistryAddress 链上角色注册合约地址，用来确认只有考试院能维护成绩源。
    constructor(address roleRegistryAddress) {
        if (roleRegistryAddress == address(0)) {
            revert ZeroAddress();
        }
        roleRegistry = IAdmissionRoleRegistry(roleRegistryAddress);
    }

    /// @inheritdoc IScoreRootRegistry
    /// @dev 创建入口只允许考试院调用，保证所有大学和学生都基于同一份官方成绩事实。
    function createScoreSource(
        bytes32 scoreSourceId,
        string calldata sourceTitle,
        uint32 maxScore,
        uint256 merkleRoot
    ) external {
        // 成绩源是整个系统的信任锚点，因此必须由考试院唯一写入。
        if (!roleRegistry.isAuthority(msg.sender)) {
            revert Unauthorized(msg.sender);
        }
        if (s_scoreSources[scoreSourceId].issuer != address(0)) {
            revert ScoreSourceAlreadyExists(scoreSourceId);
        }
        if (merkleRoot == 0) {
            revert InvalidMerkleRoot();
        }
        if (maxScore == 0) {
            revert InvalidMaxScore(maxScore);
        }

        s_scoreSources[scoreSourceId] = ScoreSource({
            scoreSourceId: scoreSourceId,
            sourceTitle: sourceTitle,
            merkleRoot: merkleRoot,
            maxScore: maxScore,
            issuedAt: uint64(block.timestamp),
            issuer: msg.sender,
            active: true
        });

        emit ScoreSourceCreated(scoreSourceId, sourceTitle, maxScore, merkleRoot, msg.sender);
    }

    /// @inheritdoc IScoreRootRegistry
    /// @dev 允许考试院更新树根，覆盖重新生成成绩树或修复离线数据的场景。
    function updateMerkleRoot(bytes32 scoreSourceId, uint256 newMerkleRoot) external {
        ScoreSource storage scoreSource = _getScoreSourceStorage(scoreSourceId);
        if (!roleRegistry.isAuthority(msg.sender)) {
            revert Unauthorized(msg.sender);
        }
        if (newMerkleRoot == 0) {
            revert InvalidMerkleRoot();
        }

        scoreSource.merkleRoot = newMerkleRoot;
        emit ScoreSourceRootUpdated(scoreSourceId, newMerkleRoot);
    }

    /// @inheritdoc IScoreRootRegistry
    /// @dev 成绩源被停用后，学校规则和学生申请都应停止继续引用这份成绩源。
    function setSourceStatus(bytes32 scoreSourceId, bool active) external {
        ScoreSource storage scoreSource = _getScoreSourceStorage(scoreSourceId);
        if (!roleRegistry.isAuthority(msg.sender)) {
            revert Unauthorized(msg.sender);
        }

        scoreSource.active = active;
        emit ScoreSourceStatusUpdated(scoreSourceId, active);
    }

    /// @inheritdoc IScoreRootRegistry
    function getScoreSource(bytes32 scoreSourceId) external view returns (ScoreSource memory) {
        ScoreSource memory scoreSource = s_scoreSources[scoreSourceId];
        if (scoreSource.issuer == address(0)) {
            revert ScoreSourceNotFound(scoreSourceId);
        }
        return scoreSource;
    }

    /// @dev 统一通过这个私有读取口做存在性校验，避免不同入口遗漏“不存在”的分支。
    function _getScoreSourceStorage(bytes32 scoreSourceId) private view returns (ScoreSource storage scoreSource) {
        scoreSource = s_scoreSources[scoreSourceId];
        if (scoreSource.issuer == address(0)) {
            revert ScoreSourceNotFound(scoreSourceId);
        }
    }
}
