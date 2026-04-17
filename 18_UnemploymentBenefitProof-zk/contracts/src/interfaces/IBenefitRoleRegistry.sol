// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title 失业补助角色登记接口
/// @notice 前端、脚本和其他合约统一通过该接口查询或更新三方角色白名单。
interface IBenefitRoleRegistry {
    /// @notice 返回当前政府账户地址。
    /// @return government 当前拥有最高管理权限的地址。
    function getGovernment() external view returns (address);

    /// @notice 判断地址是否为政府账户。
    /// @param account 待检查的账户地址。
    /// @return 是否具有政府权限。
    function isGovernment(address account) external view returns (bool);

    /// @notice 判断地址是否已开通申请资格。
    /// @param account 待检查的账户地址。
    /// @return 是否具有申请人权限。
    function isApplicant(address account) external view returns (bool);

    /// @notice 判断地址是否为发放机构账户。
    /// @param account 待检查的账户地址。
    /// @return 是否具有发放机构权限。
    function isAgency(address account) external view returns (bool);

    /// @notice 判断地址是否在任意一类角色白名单中。
    /// @param account 待检查的账户地址。
    /// @return 是否已被平台识别为可用角色。
    function isWhitelisted(address account) external view returns (bool);

    /// @notice 批量更新申请人角色。
    /// @dev 政府在发布新资格名单前，会先用该接口把新增申请地址同步为可领取凭证的账户。
    /// @param applicants 需要更新的申请地址列表。
    /// @param active 是否开通对应角色。
    function setApplicants(address[] calldata applicants, bool active) external;
}
