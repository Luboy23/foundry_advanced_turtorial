// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IAlcoholRoleRegistry } from "./interfaces/IAlcoholRoleRegistry.sol";
import { IAgeCredentialRootRegistry } from "./interfaces/IAgeCredentialRootRegistry.sol";

/// @title 年龄凭证根登记合约
/// @notice 由唯一签发机构维护当前有效的年龄凭证集合与版本号。
contract AgeCredentialRootRegistry is IAgeCredentialRootRegistry {
    error ZeroAddress();
    error ZeroSetId();
    error InvalidMerkleRoot();
    error InvalidVersion(uint32 version);
    error InvalidReferenceDate(uint64 referenceDate);
    error Unauthorized(address caller);
    error CredentialSetNotFound(bytes32 setId);

    IAlcoholRoleRegistry public immutable roleRegistry;

    bytes32 private s_currentSetId;
    mapping(bytes32 => AgeCredentialSet) private s_sets;

    event CredentialSetPublished(
        bytes32 indexed setId,
        uint32 indexed version,
        uint256 merkleRoot,
        uint64 referenceDate,
        address indexed issuer
    );
    event CredentialSetStatusUpdated(bytes32 indexed setId, bool active);

    constructor(address roleRegistryAddress) {
        if (roleRegistryAddress == address(0)) {
            revert ZeroAddress();
        }
        roleRegistry = IAlcoholRoleRegistry(roleRegistryAddress);
    }

    function publishCredentialSet(bytes32 setId, uint256 merkleRoot, uint32 version, uint64 referenceDate) external {
        if (!roleRegistry.isIssuer(msg.sender)) {
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

        bytes32 activeSetId = s_currentSetId;
        // 当前系统只承认一份 active 集合。
        // 发布新集合时，旧 active 集合会立即降为 inactive。
        if (activeSetId != bytes32(0) && activeSetId != setId) {
            s_sets[activeSetId].active = false;
            emit CredentialSetStatusUpdated(activeSetId, false);
        }

        AgeCredentialSet storage current = s_sets[setId];
        // 这里更新的不只是 root，还包括版本、参考日期和最新发布时间；
        // 资格验证和前端展示都会以这份当前集合为准。
        current.setId = setId;
        current.merkleRoot = merkleRoot;
        current.version = version;
        current.referenceDate = referenceDate;
        current.issuer = msg.sender;
        current.updatedAt = uint64(block.timestamp);
        current.active = true;
        s_currentSetId = setId;

        emit CredentialSetPublished(setId, version, merkleRoot, referenceDate, msg.sender);
    }

    function setCurrentSetStatus(bool active) external {
        if (!roleRegistry.isIssuer(msg.sender)) {
            revert Unauthorized(msg.sender);
        }

        // 这里控制的是“当前集合是否可被系统继续承认”，
        // 不会删除历史集合记录本身。
        AgeCredentialSet storage current = _getCurrentSetStorage();
        current.active = active;
        current.updatedAt = uint64(block.timestamp);
        emit CredentialSetStatusUpdated(current.setId, active);
    }

    function currentSetId() external view returns (bytes32) {
        return s_currentSetId;
    }

    function getCredentialSet(bytes32 setId) external view returns (AgeCredentialSet memory) {
        AgeCredentialSet memory credentialSet = s_sets[setId];
        if (credentialSet.issuer == address(0)) {
            revert CredentialSetNotFound(setId);
        }
        return credentialSet;
    }

    function getCurrentCredentialSet() external view returns (AgeCredentialSet memory) {
        return _getCurrentSet();
    }

    function _getCurrentSet() private view returns (AgeCredentialSet memory current) {
        bytes32 activeSetId = s_currentSetId;
        current = s_sets[activeSetId];
        if (activeSetId == bytes32(0) || current.issuer == address(0)) {
            revert CredentialSetNotFound(activeSetId);
        }
    }

    function _getCurrentSetStorage() private view returns (AgeCredentialSet storage current) {
        bytes32 activeSetId = s_currentSetId;
        current = s_sets[activeSetId];
        if (activeSetId == bytes32(0) || current.issuer == address(0)) {
            revert CredentialSetNotFound(activeSetId);
        }
    }
}
