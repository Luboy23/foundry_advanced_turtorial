// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { TestBase } from "./helpers/TestBase.sol";
import { BenefitRoleRegistry } from "../src/BenefitRoleRegistry.sol";
import { UnemploymentCredentialRootRegistry } from "../src/UnemploymentCredentialRootRegistry.sol";
import { SampleUnemploymentBenefitFixture } from "./generated/SampleUnemploymentBenefitFixture.sol";

contract UnemploymentCredentialRootRegistryTest is TestBase {
    address internal constant GOVERNMENT = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address internal constant OTHER = address(0xBEEF);

    BenefitRoleRegistry internal roleRegistry;
    UnemploymentCredentialRootRegistry internal registry;

    function setUp() public {
        roleRegistry = new BenefitRoleRegistry(GOVERNMENT);
        registry = new UnemploymentCredentialRootRegistry(address(roleRegistry));
    }

    function test_publishCredentialSet_succeeds() public {
        vm.prank(GOVERNMENT);
        registry.publishCredentialSet(
            SampleUnemploymentBenefitFixture.credentialSetId(),
            SampleUnemploymentBenefitFixture.v1MerkleRoot(),
            SampleUnemploymentBenefitFixture.v1Version(),
            SampleUnemploymentBenefitFixture.v1ReferenceDate(),
            SampleUnemploymentBenefitFixture.v1EligibleCount()
        );

        UnemploymentCredentialRootRegistry.UnemploymentCredentialSet memory credentialSet = registry.getCurrentCredentialSet();
        assertEqBytes32(credentialSet.setId, SampleUnemploymentBenefitFixture.credentialSetId(), "set id mismatch");
        assertEqUint256(credentialSet.merkleRoot, SampleUnemploymentBenefitFixture.v1MerkleRoot(), "merkle root mismatch");
        assertEqUint32(credentialSet.version, SampleUnemploymentBenefitFixture.v1Version(), "version mismatch");
        assertEqAddress(credentialSet.issuer, GOVERNMENT, "issuer mismatch");
        assertEqBool(credentialSet.active, true, "set should be active");
    }

    function test_publishCredentialSet_rollsVersionForward() public {
        vm.startPrank(GOVERNMENT);
        registry.publishCredentialSet(
            SampleUnemploymentBenefitFixture.credentialSetId(),
            SampleUnemploymentBenefitFixture.v1MerkleRoot(),
            SampleUnemploymentBenefitFixture.v1Version(),
            SampleUnemploymentBenefitFixture.v1ReferenceDate(),
            SampleUnemploymentBenefitFixture.v1EligibleCount()
        );
        registry.publishCredentialSet(
            SampleUnemploymentBenefitFixture.credentialSetId(),
            SampleUnemploymentBenefitFixture.v2MerkleRoot(),
            SampleUnemploymentBenefitFixture.v2Version(),
            SampleUnemploymentBenefitFixture.v2ReferenceDate(),
            SampleUnemploymentBenefitFixture.v2EligibleCount()
        );
        vm.stopPrank();

        UnemploymentCredentialRootRegistry.UnemploymentCredentialSet memory credentialSet = registry.getCurrentCredentialSet();
        assertEqUint32(credentialSet.version, SampleUnemploymentBenefitFixture.v2Version(), "version should update");
        assertEqUint256(credentialSet.merkleRoot, SampleUnemploymentBenefitFixture.v2MerkleRoot(), "root should update");
    }

    function test_nonGovernmentCannotPublishCredentialSet() public {
        vm.prank(OTHER);
        vm.expectRevert(abi.encodeWithSelector(UnemploymentCredentialRootRegistry.Unauthorized.selector, OTHER));
        registry.publishCredentialSet(
            SampleUnemploymentBenefitFixture.credentialSetId(),
            SampleUnemploymentBenefitFixture.v1MerkleRoot(),
            SampleUnemploymentBenefitFixture.v1Version(),
            SampleUnemploymentBenefitFixture.v1ReferenceDate(),
            SampleUnemploymentBenefitFixture.v1EligibleCount()
        );
    }
}
