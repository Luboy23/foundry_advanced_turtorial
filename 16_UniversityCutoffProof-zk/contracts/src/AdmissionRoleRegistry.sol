// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IAdmissionRoleRegistry } from "./interfaces/IAdmissionRoleRegistry.sol";

/// @title 高考录取资格证明系统角色注册合约
/// @notice 统一维护考试院、学生和大学管理员的链上身份白名单。
/// @dev 其他业务合约只从这里查询角色，避免多个合约各自维护一份权限状态导致漂移。
contract AdmissionRoleRegistry is IAdmissionRoleRegistry {
    /// @dev 角色注册表里的零地址通常意味着配置缺失，因此单独作为基础错误分支。
    error ZeroAddress();
    error ZeroKey();
    error Unauthorized(address caller);
    error AdminAlreadyAssigned(address admin, bytes32 universityKey);
    error UniversityNotFound(bytes32 universityKey);

    address private s_authority;
    mapping(address => bool) private s_students;
    mapping(bytes32 => UniversityAdminConfig) private s_universityConfigs;
    mapping(address => bytes32) private s_adminToUniversityKey;

    event AuthorityUpdated(address indexed authority);
    event StudentUpdated(address indexed student, bool active);
    event UniversityAdminUpdated(
        bytes32 indexed universityKey,
        string schoolName,
        address indexed admin,
        bool active
    );

    /// @param initialAuthority 初始化时写入考试院账户，后续所有角色维护都以该地址为唯一入口。
    constructor(address initialAuthority) {
        if (initialAuthority == address(0)) {
            revert ZeroAddress();
        }
        s_authority = initialAuthority;
        emit AuthorityUpdated(initialAuthority);
    }

    /// @dev 角色变更统一收口到考试院，保证白名单真相源只有一个。
    modifier onlyAuthority() {
        if (msg.sender != s_authority) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    /// @inheritdoc IAdmissionRoleRegistry
    function getAuthority() external view returns (address) {
        return s_authority;
    }

    /// @inheritdoc IAdmissionRoleRegistry
    function isAuthority(address account) external view returns (bool) {
        return account == s_authority;
    }

    /// @inheritdoc IAdmissionRoleRegistry
    function isStudent(address account) external view returns (bool) {
        return s_students[account];
    }

    /// @inheritdoc IAdmissionRoleRegistry
    /// @dev 前端首页和角色守卫通过这个统一入口快速判断当前钱包是否属于三方之一。
    function isWhitelisted(address account) external view returns (bool) {
        return account == s_authority || s_students[account] || _isUniversityAdmin(account);
    }

    /// @inheritdoc IAdmissionRoleRegistry
    function isUniversityAdmin(address account) external view returns (bool) {
        return _isUniversityAdmin(account);
    }

    /// @inheritdoc IAdmissionRoleRegistry
    function getUniversityKeyByAdmin(address admin) external view returns (bytes32) {
        if (!_isUniversityAdmin(admin)) {
            return bytes32(0);
        }
        return s_adminToUniversityKey[admin];
    }

    /// @inheritdoc IAdmissionRoleRegistry
    function getUniversityConfig(bytes32 universityKey) external view returns (UniversityAdminConfig memory) {
        UniversityAdminConfig memory config = s_universityConfigs[universityKey];
        if (config.universityKey == bytes32(0)) {
            revert UniversityNotFound(universityKey);
        }
        return config;
    }

    /// @inheritdoc IAdmissionRoleRegistry
    /// @dev 直接替换唯一 authority，而不是保留双 authority 过渡期，便于前端稳定判断权限。
    function setAuthority(address nextAuthority) external onlyAuthority {
        if (nextAuthority == address(0)) {
            revert ZeroAddress();
        }
        s_authority = nextAuthority;
        emit AuthorityUpdated(nextAuthority);
    }

    /// @inheritdoc IAdmissionRoleRegistry
    /// @dev 学生侧只需要布尔启停状态，不额外记录复杂元数据，便于前端快速校验是否能进入学生工作台。
    function setStudent(address student, bool active) external onlyAuthority {
        if (student == address(0)) {
            revert ZeroAddress();
        }

        s_students[student] = active;
        emit StudentUpdated(student, active);
    }

    /// @inheritdoc IAdmissionRoleRegistry
    /// @dev 大学管理员和大学键一旦绑定，学校规则合约就可以沿着这个绑定关系做严格权限校验。
    function setUniversityAdmin(bytes32 universityKey, string calldata schoolName, address admin, bool active)
        external
        onlyAuthority
    {
        if (universityKey == bytes32(0)) {
            revert ZeroKey();
        }

        UniversityAdminConfig storage currentConfig = s_universityConfigs[universityKey];

        if (active) {
            if (admin == address(0)) {
                revert ZeroAddress();
            }

            bytes32 existingKey = s_adminToUniversityKey[admin];
            // 同一个管理员地址不能同时归属两所大学，否则前端无法稳定映射到唯一大学工作台。
            if (existingKey != bytes32(0) && existingKey != universityKey) {
                revert AdminAlreadyAssigned(admin, existingKey);
            }

            // 更换管理员时先清理旧绑定，避免旧地址继续被识别成大学管理员。
            if (currentConfig.admin != address(0) && currentConfig.admin != admin) {
                delete s_adminToUniversityKey[currentConfig.admin];
            }

            currentConfig.universityKey = universityKey;
            currentConfig.schoolName = schoolName;
            currentConfig.admin = admin;
            currentConfig.active = true;
            s_adminToUniversityKey[admin] = universityKey;
            emit UniversityAdminUpdated(universityKey, schoolName, admin, true);
            return;
        }

        if (currentConfig.admin != address(0)) {
            delete s_adminToUniversityKey[currentConfig.admin];
        }

        currentConfig.universityKey = universityKey;
        currentConfig.schoolName = schoolName;
        currentConfig.admin = address(0);
        currentConfig.active = false;
        emit UniversityAdminUpdated(universityKey, schoolName, address(0), false);
    }

    /// @dev 大学管理员的有效性同时取决于是否绑定大学键以及该配置当前是否仍处于 active。
    function _isUniversityAdmin(address account) private view returns (bool) {
        bytes32 universityKey = s_adminToUniversityKey[account];
        if (universityKey == bytes32(0)) {
            return false;
        }

        UniversityAdminConfig memory config = s_universityConfigs[universityKey];
        return config.active && config.admin == account;
    }
}
