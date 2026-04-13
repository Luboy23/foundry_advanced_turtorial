// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title 高考录取资格证明系统角色注册接口
/// @notice 统一维护考试院、学生和大学管理员三类账户的链上白名单。
interface IAdmissionRoleRegistry {
    /// @dev 描述某一所大学当前登记的管理员配置。
    struct UniversityAdminConfig {
        /// @notice 大学家族键，例如 pku / jiatingdun。
        bytes32 universityKey;
        /// @notice 前端展示用的学校名称。
        string schoolName;
        /// @notice 当前学校管理员钱包地址。
        address admin;
        /// @notice 该管理员配置是否仍处于启用状态。
        bool active;
    }

    /// @notice 读取当前考试院账户。
    function getAuthority() external view returns (address);

    /// @notice 判断某个账户是否为考试院账户。
    function isAuthority(address account) external view returns (bool);

    /// @notice 判断某个账户是否为学生账户。
    function isStudent(address account) external view returns (bool);

    /// @notice 判断某个账户是否属于项目白名单。
    function isWhitelisted(address account) external view returns (bool);

    /// @notice 判断某个账户是否为大学管理员。
    function isUniversityAdmin(address account) external view returns (bool);

    /// @notice 读取管理员账户绑定的大学键。
    /// @dev 未登记时返回零值 bytes32。
    function getUniversityKeyByAdmin(address admin) external view returns (bytes32);

    /// @notice 读取指定大学键的管理员配置。
    function getUniversityConfig(bytes32 universityKey) external view returns (UniversityAdminConfig memory);

    /// @notice 更新考试院账户。
    function setAuthority(address nextAuthority) external;

    /// @notice 设置学生账户的启用状态。
    function setStudent(address student, bool active) external;

    /// @notice 设置某所大学的管理员配置。
    function setUniversityAdmin(bytes32 universityKey, string calldata schoolName, address admin, bool active) external;
}
