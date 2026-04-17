// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IBenefitRoleRegistry } from "./interfaces/IBenefitRoleRegistry.sol";

/// @title 失业一次性补助平台角色登记
/// @notice 统一维护政府、申请人和发放机构三方的链上白名单。
/// @dev 该合约只负责角色边界，不承载名单版本或资金状态，避免权限和业务状态耦合。
contract BenefitRoleRegistry is IBenefitRoleRegistry {
    error ZeroAddress();
    error Unauthorized(address caller);

    address private s_government;
    mapping(address => bool) private s_applicants;
    mapping(address => bool) private s_agencies;

    event GovernmentUpdated(address indexed government);
    event ApplicantUpdated(address indexed applicant, bool active);
    event AgencyUpdated(address indexed agency, bool active);

    /// @notice 部署时写入初始政府账户。
    /// @param initialGovernment 默认拥有管理权限的地址。
    constructor(address initialGovernment) {
        if (initialGovernment == address(0)) {
            revert ZeroAddress();
        }

        s_government = initialGovernment;
        emit GovernmentUpdated(initialGovernment);
    }

    /// @notice 保护所有角色写接口，确保只有政府能调整白名单。
    modifier onlyGovernment() {
        if (msg.sender != s_government) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    /// @inheritdoc IBenefitRoleRegistry
    function getGovernment() external view returns (address) {
        return s_government;
    }

    /// @inheritdoc IBenefitRoleRegistry
    function isGovernment(address account) external view returns (bool) {
        return account == s_government;
    }

    /// @inheritdoc IBenefitRoleRegistry
    function isApplicant(address account) external view returns (bool) {
        return s_applicants[account];
    }

    /// @inheritdoc IBenefitRoleRegistry
    function isAgency(address account) external view returns (bool) {
        return s_agencies[account];
    }

    /// @inheritdoc IBenefitRoleRegistry
    function isWhitelisted(address account) external view returns (bool) {
        return account == s_government || s_applicants[account] || s_agencies[account];
    }

    /// @notice 更换政府账户。
    /// @dev 这里不保留旧政府的任何特权，切换成功后旧地址立即失去管理权限。
    /// @param nextGovernment 新的政府账户地址。
    function setGovernment(address nextGovernment) external onlyGovernment {
        if (nextGovernment == address(0)) {
            revert ZeroAddress();
        }

        s_government = nextGovernment;
        emit GovernmentUpdated(nextGovernment);
    }

    /// @notice 单独更新一个申请人的角色状态。
    /// @param applicant 目标申请人地址。
    /// @param active 是否开通申请权限。
    function setApplicant(address applicant, bool active) external onlyGovernment {
        if (applicant == address(0)) {
            revert ZeroAddress();
        }

        s_applicants[applicant] = active;
        emit ApplicantUpdated(applicant, active);
    }

    /// @inheritdoc IBenefitRoleRegistry
    function setApplicants(address[] calldata applicants, bool active) external onlyGovernment {
        uint256 length = applicants.length;
        for (uint256 index = 0; index < length; index++) {
            address applicant = applicants[index];
            if (applicant == address(0)) {
                revert ZeroAddress();
            }

            s_applicants[applicant] = active;
            emit ApplicantUpdated(applicant, active);
        }
    }

    /// @notice 更新发放机构角色状态。
    /// @param agency 目标发放机构地址。
    /// @param active 是否开通发放权限。
    function setAgency(address agency, bool active) external onlyGovernment {
        if (agency == address(0)) {
            revert ZeroAddress();
        }

        s_agencies[agency] = active;
        emit AgencyUpdated(agency, active);
    }
}
