// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { TestBase } from "./helpers/TestBase.sol";
import { AdmissionRoleRegistry } from "../src/AdmissionRoleRegistry.sol";

/// @notice 保护角色白名单真相源的核心行为：
/// 1. 初始化 authority 正确；
/// 2. 学生和大学管理员能被正确写入；
/// 3. 非考试院地址不能越权修改白名单。
contract AdmissionRoleRegistryTest is TestBase {
    bytes32 internal constant PKU_KEY = bytes32("pku");
    address internal constant AUTHORITY = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address internal constant STUDENT = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address internal constant PKU_ADMIN = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address internal constant OTHER = address(0xBEEF);

    AdmissionRoleRegistry internal registry;

    /// @dev 每个测试用例前都重新部署一份干净的角色注册合约，避免状态相互污染。
    function setUp() public {
        registry = new AdmissionRoleRegistry(AUTHORITY);
    }

    /// @notice 场景意图：部署时应正确写入唯一考试院账户。
    function test_authorityConfiguredOnDeploy() public view {
        assertEqAddress(registry.getAuthority(), AUTHORITY, "authority mismatch");
        assertEqBool(registry.isAuthority(AUTHORITY), true, "authority should be recognized");
    }

    /// @notice 场景意图：考试院启用学生后，学生应同时出现在学生表和总白名单里。
    function test_setStudent_updatesWhitelist() public {
        vm.prank(AUTHORITY);
        registry.setStudent(STUDENT, true);

        assertEqBool(registry.isStudent(STUDENT), true, "student not enabled");
        assertEqBool(registry.isWhitelisted(STUDENT), true, "student should be whitelisted");
    }

    /// @notice 场景意图：大学管理员登记成功后，应能读回大学键绑定关系。
    function test_setUniversityAdmin_updatesUniversityBinding() public {
        vm.prank(AUTHORITY);
        registry.setUniversityAdmin(PKU_KEY, unicode"北京大学", PKU_ADMIN, true);

        assertEqBool(registry.isUniversityAdmin(PKU_ADMIN), true, "university admin not enabled");
        assertEqBytes32(registry.getUniversityKeyByAdmin(PKU_ADMIN), PKU_KEY, "university key mismatch");
        assertEqBool(registry.isWhitelisted(PKU_ADMIN), true, "university admin should be whitelisted");
    }

    /// @notice 边界保护：非考试院地址不能修改角色注册表。
    function test_nonAuthorityCannotManageRegistry() public {
        vm.prank(OTHER);
        vm.expectRevert(abi.encodeWithSelector(AdmissionRoleRegistry.Unauthorized.selector, OTHER));
        registry.setStudent(STUDENT, true);
    }
}
