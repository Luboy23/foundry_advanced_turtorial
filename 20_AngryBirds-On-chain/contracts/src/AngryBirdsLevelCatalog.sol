// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AngryBirdsLevelCatalog {
    error InvalidContentHash();
    error InvalidLevelId();
    error InvalidLevelVersion();
    error InvalidOrder();
    error InvalidOwner();
    error LevelNotFound();
    error Unauthorized();

    struct LevelConfig {
        bytes32 levelId;
        uint32 version;
        bytes32 contentHash;
        uint32 order;
        bool enabled;
    }

    struct CatalogPointer {
        bytes32 levelId;
        uint32 version;
    }

    address public owner;

    mapping(bytes32 => mapping(uint32 => LevelConfig)) private _levels;
    mapping(bytes32 => mapping(uint32 => bool)) private _exists;
    mapping(bytes32 => uint256) private _catalogIndexByKey;
    CatalogPointer[] private _catalogPointers;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event LevelUpserted(
        bytes32 indexed levelId,
        uint32 indexed version,
        bytes32 contentHash,
        uint32 order,
        bool enabled
    );
    event LevelEnabledUpdated(bytes32 indexed levelId, uint32 indexed version, bool enabled);

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice 转移目录管理员权限，只有当前 owner 可调用。
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert InvalidOwner();
        }

        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice 新增或更新关卡配置（upsert 语义）；同一关卡版本只保留一条记录。
    function upsertLevel(LevelConfig calldata config) external onlyOwner {
        _validateConfig(config);

        _levels[config.levelId][config.version] = config;
        _exists[config.levelId][config.version] = true;

        bytes32 compositeKey = _compositeKey(config.levelId, config.version);
        if (_catalogIndexByKey[compositeKey] == 0) {
            _catalogPointers.push(CatalogPointer({ levelId: config.levelId, version: config.version }));
            _catalogIndexByKey[compositeKey] = _catalogPointers.length;
        }

        emit LevelUpserted(
            config.levelId,
            config.version,
            config.contentHash,
            config.order,
            config.enabled
        );
    }

    /// @notice 切换某个关卡版本的启用状态，不会删除原配置数据。
    function setLevelEnabled(bytes32 levelId, uint32 version, bool enabled) external onlyOwner {
        if (!_exists[levelId][version]) {
            revert LevelNotFound();
        }

        _levels[levelId][version].enabled = enabled;
        emit LevelEnabledUpdated(levelId, version, enabled);
    }

    /// @notice 查询单个关卡版本的完整配置，不存在则回滚。
    function getLevel(bytes32 levelId, uint32 version) external view returns (LevelConfig memory) {
        if (!_exists[levelId][version]) {
            revert LevelNotFound();
        }

        return _levels[levelId][version];
    }

    /// @notice 返回目录中的所有关卡，并按 order 升序排序后输出。
    function getCatalog() external view returns (LevelConfig[] memory) {
        LevelConfig[] memory levels = new LevelConfig[](_catalogPointers.length);
        for (uint256 i = 0; i < _catalogPointers.length; i++) {
            CatalogPointer memory pointer = _catalogPointers[i];
            levels[i] = _levels[pointer.levelId][pointer.version];
        }

        for (uint256 i = 1; i < levels.length; i++) {
            LevelConfig memory current = levels[i];
            uint256 j = i;
            while (j > 0 && levels[j - 1].order > current.order) {
                levels[j] = levels[j - 1];
                j--;
            }
            levels[j] = current;
        }

        return levels;
    }

    /// @notice 判断关卡版本是否存在于目录中。
    function levelExists(bytes32 levelId, uint32 version) external view returns (bool) {
        return _exists[levelId][version];
    }

    /// @notice 判断关卡版本是否可用（存在且 enabled=true）。
    function isLevelEnabled(bytes32 levelId, uint32 version) external view returns (bool) {
        return _exists[levelId][version] && _levels[levelId][version].enabled;
    }

    /// @dev 统一校验上链配置字段，避免脏数据进入目录。
    function _validateConfig(LevelConfig calldata config) private pure {
        if (config.levelId == bytes32(0)) {
            revert InvalidLevelId();
        }
        if (config.version == 0) {
            revert InvalidLevelVersion();
        }
        if (config.contentHash == bytes32(0)) {
            revert InvalidContentHash();
        }
        if (config.order == 0) {
            revert InvalidOrder();
        }
    }

    /// @dev 由 levelId + version 生成复合主键，用于目录去重与索引定位。
    function _compositeKey(bytes32 levelId, uint32 version) private pure returns (bytes32) {
        return keccak256(abi.encode(levelId, version));
    }
}
