// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { TestBase } from "./helpers/TestBase.sol";
import { BenefitRoleRegistry } from "../src/BenefitRoleRegistry.sol";

contract BenefitRoleRegistryTest is TestBase {
    address internal constant GOVERNMENT = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address internal constant APPLICANT = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address internal constant APPLICANT_TWO = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;
    address internal constant AGENCY = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address internal constant OTHER = address(0xBEEF);

    BenefitRoleRegistry internal registry;

    function setUp() public {
        registry = new BenefitRoleRegistry(GOVERNMENT);
    }

    function test_governmentConfiguredOnDeploy() public view {
        assertEqAddress(registry.getGovernment(), GOVERNMENT, "government mismatch");
        assertEqBool(registry.isGovernment(GOVERNMENT), true, "government should be recognized");
    }

    function test_setApplicantAndAgency_updatesWhitelist() public {
        vm.prank(GOVERNMENT);
        registry.setApplicant(APPLICANT, true);

        vm.prank(GOVERNMENT);
        registry.setAgency(AGENCY, true);

        assertEqBool(registry.isApplicant(APPLICANT), true, "applicant should be whitelisted");
        assertEqBool(registry.isAgency(AGENCY), true, "agency should be whitelisted");
        assertEqBool(registry.isWhitelisted(APPLICANT), true, "applicant should be globally whitelisted");
        assertEqBool(registry.isWhitelisted(AGENCY), true, "agency should be globally whitelisted");
    }

    function test_setApplicants_updatesMultipleApplicants() public {
        address[] memory applicants = new address[](2);
        applicants[0] = APPLICANT;
        applicants[1] = APPLICANT_TWO;

        vm.prank(GOVERNMENT);
        registry.setApplicants(applicants, true);

        assertEqBool(registry.isApplicant(APPLICANT), true, "first applicant should be whitelisted");
        assertEqBool(registry.isApplicant(APPLICANT_TWO), true, "second applicant should be whitelisted");
    }

    function test_setApplicants_acceptsExistingApplicantWithoutBreakingState() public {
        vm.prank(GOVERNMENT);
        registry.setApplicant(APPLICANT, true);

        address[] memory applicants = new address[](2);
        applicants[0] = APPLICANT;
        applicants[1] = APPLICANT_TWO;

        vm.prank(GOVERNMENT);
        registry.setApplicants(applicants, true);

        assertEqBool(registry.isApplicant(APPLICANT), true, "existing applicant should remain whitelisted");
        assertEqBool(registry.isApplicant(APPLICANT_TWO), true, "new applicant should be whitelisted");
    }

    function test_nonGovernmentCannotManageRoles() public {
        vm.prank(OTHER);
        vm.expectRevert(abi.encodeWithSelector(BenefitRoleRegistry.Unauthorized.selector, OTHER));
        registry.setApplicant(APPLICANT, true);
    }

    function test_nonGovernmentCannotBatchManageApplicants() public {
        address[] memory applicants = new address[](1);
        applicants[0] = APPLICANT;

        vm.prank(OTHER);
        vm.expectRevert(abi.encodeWithSelector(BenefitRoleRegistry.Unauthorized.selector, OTHER));
        registry.setApplicants(applicants, true);
    }
}
