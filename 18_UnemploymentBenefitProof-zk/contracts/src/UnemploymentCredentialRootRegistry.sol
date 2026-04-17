// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IBenefitRoleRegistry } from "./interfaces/IBenefitRoleRegistry.sol";
import { IUnemploymentCredentialRootRegistry } from "./interfaces/IUnemploymentCredentialRootRegistry.sol";

/// @title 失业资格集合根登记
/// @notice 由政府发布当前有效的失业资格 Merkle root 和版本。
/// @dev 合约只保存“当前有效名单”的摘要信息，完整名单与私有凭证由链下服务维护。
contract UnemploymentCredentialRootRegistry is IUnemploymentCredentialRootRegistry {
    error ZeroAddress();
    error ZeroSetId();
    error InvalidMerkleRoot();
    error InvalidVersion(uint32 version);
    error InvalidReferenceDate(uint64 referenceDate);
    error Unauthorized(address caller);
    error CredentialSetNotFound(bytes32 setId);
    error VersionNotAdvanced(uint32 currentVersion, uint32 nextVersion);

    IBenefitRoleRegistry public immutable roleRegistry;

    bytes32 private s_currentSetId;
    mapping(bytes32 => UnemploymentCredentialSet) private s_sets;

    event CredentialSetPublished(
        bytes32 indexed setId,
        uint32 indexed version,
        uint256 merkleRoot,
        uint64 referenceDate,
        uint32 eligibleCount,
        address indexed issuer
    );
    event CredentialSetStatusUpdated(bytes32 indexed setId, bool active);

    /// @notice 初始化角色登记合约地址。
    /// @param roleRegistryAddress 用于校验政府权限的角色登记合约。
    constructor(address roleRegistryAddress) {
        if (roleRegistryAddress == address(0)) {
            revert ZeroAddress();
        }
        roleRegistry = IBenefitRoleRegistry(roleRegistryAddress);
    }

    /// @notice 发布新的资格名单摘要。
    /// @dev 这里要求版本只能前进，避免旧名单覆盖新名单；切换到新名单时会显式停用旧名单。
    /// @param setId 资格名单的稳定标识。
    /// @param merkleRoot 名单摘要根。
    /// @param version 资格名单版本号。
    /// @param referenceDate 名单对应的业务参考日期。
    /// @param eligibleCount 名单中的合格人数。
    function publishCredentialSet(
        bytes32 setId,
        uint256 merkleRoot,
        uint32 version,
        uint64 referenceDate,
        uint32 eligibleCount
    ) external {
        if (!roleRegistry.isGovernment(msg.sender)) {
            revert Unauthorized(msg.sender);
        }
        if (setId == bytes32(0)) {
            revert ZeroSetId();
        }
        if (merkleRoot == 0) {
            revert InvalidMerkleRoot();
        }
        if (version == 0) {
            revert InvalidVersion(version);
        }
        if (referenceDate == 0) {
            revert InvalidReferenceDate(referenceDate);
        }

        UnemploymentCredentialSet storage current = s_sets[setId];
        if (current.issuer != address(0) && version <= current.version) {
            revert VersionNotAdvanced(current.version, version);
        }

        // 切换到新名单前，先把旧的 current set 标记为 inactive，避免前后两个版本同时被认为有效。
        bytes32 activeSetId = s_currentSetId;
        if (activeSetId != bytes32(0) && activeSetId != setId) {
            s_sets[activeSetId].active = false;
            emit CredentialSetStatusUpdated(activeSetId, false);
        }

        current.setId = setId;
        current.merkleRoot = merkleRoot;
        current.version = version;
        current.referenceDate = referenceDate;
        current.eligibleCount = eligibleCount;
        current.issuer = msg.sender;
        current.updatedAt = uint64(block.timestamp);
        current.active = true;
        s_currentSetId = setId;

        emit CredentialSetPublished(setId, version, merkleRoot, referenceDate, eligibleCount, msg.sender);
    }

    /// @notice 更新当前名单的激活状态。
    /// @dev 该接口保留给政府做紧急停用，不负责切换版本。
    /// @param active 当前名单是否继续生效。
    function setCurrentSetStatus(bool active) external {
        if (!roleRegistry.isGovernment(msg.sender)) {
            revert Unauthorized(msg.sender);
        }

        UnemploymentCredentialSet storage current = _getCurrentSetStorage();
        current.active = active;
        current.updatedAt = uint64(block.timestamp);
        emit CredentialSetStatusUpdated(current.setId, active);
    }

    /// @notice 返回当前激活名单的 setId。
    /// @return 当前生效名单标识。
    function currentSetId() external view returns (bytes32) {
        return s_currentSetId;
    }

    /// @notice 按 setId 读取历史资格名单。
    /// @param setId 目标名单标识。
    /// @return credentialSet 对应版本的资格名单结构。
    function getCredentialSet(bytes32 setId) external view returns (UnemploymentCredentialSet memory) {
        UnemploymentCredentialSet memory credentialSet = s_sets[setId];
        if (credentialSet.issuer == address(0)) {
            revert CredentialSetNotFound(setId);
        }
        return credentialSet;
    }

    /// @inheritdoc IUnemploymentCredentialRootRegistry
    function getCurrentCredentialSet() external view returns (UnemploymentCredentialSet memory) {
        return _getCurrentSet();
    }

    /// @notice 统一读取当前名单的内存副本。
    /// @dev 该私有函数把“未发布名单”的异常处理集中起来，避免多个外部接口重复判断。
    function _getCurrentSet() private view returns (UnemploymentCredentialSet memory current) {
        bytes32 activeSetId = s_currentSetId;
        current = s_sets[activeSetId];
        if (activeSetId == bytes32(0) || current.issuer == address(0)) {
            revert CredentialSetNotFound(activeSetId);
        }
    }

    /// @notice 读取当前名单的存储引用。
    /// @dev 只有需要原地修改 active / updatedAt 的写路径才会使用该版本。
    function _getCurrentSetStorage() private view returns (UnemploymentCredentialSet storage current) {
        bytes32 activeSetId = s_currentSetId;
        current = s_sets[activeSetId];
        if (activeSetId == bytes32(0) || current.issuer == address(0)) {
            revert CredentialSetNotFound(activeSetId);
        }
    }
}
