// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { TestBase } from "./helpers/TestBase.sol";
import { AlcoholRoleRegistry } from "../src/AlcoholRoleRegistry.sol";
import { AgeCredentialRootRegistry } from "../src/AgeCredentialRootRegistry.sol";
import { AlcoholAgeEligibilityVerifier } from "../src/AlcoholAgeEligibilityVerifier.sol";
import { AlcoholAgeProofVerifier } from "../src/AlcoholAgeProofVerifier.sol";
import { SampleAlcoholAgeFixture } from "./generated/SampleAlcoholAgeFixture.sol";

contract AlcoholAgeEligibilityVerifierTest is TestBase {
    address internal constant ISSUER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address internal constant OTHER_BUYER = address(0xBEEF);
    address internal buyer;

    AlcoholRoleRegistry internal roleRegistry;
    AgeCredentialRootRegistry internal rootRegistry;
    AlcoholAgeProofVerifier internal verifier;
    AlcoholAgeEligibilityVerifier internal eligibilityVerifier;

    function setUp() public {
        buyer = SampleAlcoholAgeFixture.sampleRecipient();
        vm.warp(SampleAlcoholAgeFixture.referenceDate());
        roleRegistry = new AlcoholRoleRegistry(ISSUER);
        rootRegistry = new AgeCredentialRootRegistry(address(roleRegistry));
        verifier = new AlcoholAgeProofVerifier();
        eligibilityVerifier = new AlcoholAgeEligibilityVerifier(address(rootRegistry), address(verifier), address(roleRegistry));

        vm.startPrank(ISSUER);
        roleRegistry.setBuyer(buyer, true);
        roleRegistry.setBuyer(OTHER_BUYER, true);
        rootRegistry.publishCredentialSet(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.merkleRoot(),
            SampleAlcoholAgeFixture.version(),
            SampleAlcoholAgeFixture.referenceDate()
        );
        vm.stopPrank();
    }

    function test_verifyEligibility_succeedsForBoundBuyer() public {
        vm.prank(buyer);
        eligibilityVerifier.verifyEligibility(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.sampleVerificationDateYmd(),
            SampleAlcoholAgeFixture.proofA(),
            SampleAlcoholAgeFixture.proofB(),
            SampleAlcoholAgeFixture.proofC()
        );

        AlcoholAgeEligibilityVerifier.EligibilityStatus memory status = eligibilityVerifier.getEligibility(buyer);
        assertEqUint32(status.verifiedRootVersion, SampleAlcoholAgeFixture.version(), "verified version mismatch");
        assertEqBool(eligibilityVerifier.hasValidEligibility(buyer), true, "eligibility should be valid");
    }

    function test_verifyEligibility_revertsForAnotherWallet() public {
        vm.prank(OTHER_BUYER);
        vm.expectRevert(AlcoholAgeEligibilityVerifier.InvalidProof.selector);
        eligibilityVerifier.verifyEligibility(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.sampleVerificationDateYmd(),
            SampleAlcoholAgeFixture.proofA(),
            SampleAlcoholAgeFixture.proofB(),
            SampleAlcoholAgeFixture.proofC()
        );
    }

    function test_hasValidEligibility_turnsFalseAfterVersionUpdate() public {
        vm.prank(buyer);
        eligibilityVerifier.verifyEligibility(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.sampleVerificationDateYmd(),
            SampleAlcoholAgeFixture.proofA(),
            SampleAlcoholAgeFixture.proofB(),
            SampleAlcoholAgeFixture.proofC()
        );

        vm.prank(ISSUER);
        rootRegistry.publishCredentialSet(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.merkleRoot(),
            SampleAlcoholAgeFixture.version() + 1,
            SampleAlcoholAgeFixture.referenceDate()
        );

        assertEqBool(eligibilityVerifier.hasValidEligibility(buyer), false, "eligibility should expire");
    }

    function test_verifyEligibility_revertsForFutureVerificationDate() public {
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                AlcoholAgeEligibilityVerifier.InvalidVerificationDate.selector,
                SampleAlcoholAgeFixture.sampleVerificationDateYmd() + 1,
                SampleAlcoholAgeFixture.sampleVerificationDateYmd()
            )
        );
        eligibilityVerifier.verifyEligibility(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.sampleVerificationDateYmd() + 1,
            SampleAlcoholAgeFixture.proofA(),
            SampleAlcoholAgeFixture.proofB(),
            SampleAlcoholAgeFixture.proofC()
        );
    }
}
