// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { TestBase } from "./helpers/TestBase.sol";
import { AlcoholRoleRegistry } from "../src/AlcoholRoleRegistry.sol";
import { AgeCredentialRootRegistry } from "../src/AgeCredentialRootRegistry.sol";
import { SampleAlcoholAgeFixture } from "./generated/SampleAlcoholAgeFixture.sol";

contract AgeCredentialRootRegistryTest is TestBase {
    address internal constant ISSUER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address internal constant OTHER = address(0xBEEF);

    AlcoholRoleRegistry internal roleRegistry;
    AgeCredentialRootRegistry internal registry;

    function setUp() public {
        roleRegistry = new AlcoholRoleRegistry(ISSUER);
        registry = new AgeCredentialRootRegistry(address(roleRegistry));
    }

    function test_publishCredentialSet_succeeds() public {
        vm.prank(ISSUER);
        registry.publishCredentialSet(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.merkleRoot(),
            SampleAlcoholAgeFixture.version(),
            SampleAlcoholAgeFixture.referenceDate()
        );

        AgeCredentialRootRegistry.AgeCredentialSet memory credentialSet = registry.getCurrentCredentialSet();
        assertEqBytes32(credentialSet.setId, SampleAlcoholAgeFixture.credentialSetId(), "set id mismatch");
        assertEqUint256(credentialSet.merkleRoot, SampleAlcoholAgeFixture.merkleRoot(), "merkle root mismatch");
        assertEqUint32(credentialSet.version, SampleAlcoholAgeFixture.version(), "version mismatch");
        assertEqAddress(credentialSet.issuer, ISSUER, "issuer mismatch");
        assertEqBool(credentialSet.active, true, "set should be active");
    }

    function test_publishCredentialSet_rollsVersionForward() public {
        vm.startPrank(ISSUER);
        registry.publishCredentialSet(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.merkleRoot(),
            SampleAlcoholAgeFixture.version(),
            SampleAlcoholAgeFixture.referenceDate()
        );
        registry.publishCredentialSet(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.merkleRoot(),
            SampleAlcoholAgeFixture.version() + 1,
            SampleAlcoholAgeFixture.referenceDate()
        );
        vm.stopPrank();

        AgeCredentialRootRegistry.AgeCredentialSet memory credentialSet = registry.getCurrentCredentialSet();
        assertEqUint32(credentialSet.version, SampleAlcoholAgeFixture.version() + 1, "version should update");
    }

    function test_nonIssuerCannotPublishCredentialSet() public {
        vm.prank(OTHER);
        vm.expectRevert(abi.encodeWithSelector(AgeCredentialRootRegistry.Unauthorized.selector, OTHER));
        registry.publishCredentialSet(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.merkleRoot(),
            SampleAlcoholAgeFixture.version(),
            SampleAlcoholAgeFixture.referenceDate()
        );
    }
}
