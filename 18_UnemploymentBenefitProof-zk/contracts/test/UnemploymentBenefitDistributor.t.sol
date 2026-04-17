// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { TestBase } from "./helpers/TestBase.sol";
import { BenefitRoleRegistry } from "../src/BenefitRoleRegistry.sol";
import { UnemploymentCredentialRootRegistry } from "../src/UnemploymentCredentialRootRegistry.sol";
import { UnemploymentBenefitDistributor } from "../src/UnemploymentBenefitDistributor.sol";
import { UnemploymentBenefitProofVerifier } from "../src/UnemploymentBenefitProofVerifier.sol";
import { SampleUnemploymentBenefitFixture } from "./generated/SampleUnemploymentBenefitFixture.sol";

contract UnemploymentBenefitDistributorTest is TestBase {
    address internal constant GOVERNMENT = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address internal constant AGENCY = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address internal constant OTHER = address(0xBEEF);
    address internal applicant;

    BenefitRoleRegistry internal roleRegistry;
    UnemploymentCredentialRootRegistry internal rootRegistry;
    UnemploymentBenefitProofVerifier internal verifier;
    UnemploymentBenefitDistributor internal distributor;

    function setUp() public {
        applicant = SampleUnemploymentBenefitFixture.sampleRecipient();
        roleRegistry = new BenefitRoleRegistry(GOVERNMENT);
        rootRegistry = new UnemploymentCredentialRootRegistry(address(roleRegistry));
        verifier = new UnemploymentBenefitProofVerifier();
        distributor = new UnemploymentBenefitDistributor(
            address(roleRegistry),
            address(rootRegistry),
            address(verifier),
            SampleUnemploymentBenefitFixture.programId(),
            SampleUnemploymentBenefitFixture.programIdField(),
            SampleUnemploymentBenefitFixture.benefitAmountWei()
        );

        vm.startPrank(GOVERNMENT);
        roleRegistry.setApplicant(applicant, true);
        roleRegistry.setApplicant(OTHER, true);
        roleRegistry.setAgency(AGENCY, true);
        rootRegistry.publishCredentialSet(
            SampleUnemploymentBenefitFixture.credentialSetId(),
            SampleUnemploymentBenefitFixture.v1MerkleRoot(),
            SampleUnemploymentBenefitFixture.v1Version(),
            SampleUnemploymentBenefitFixture.v1ReferenceDate(),
            SampleUnemploymentBenefitFixture.v1EligibleCount()
        );
        vm.stopPrank();

        vm.deal(AGENCY, 400 ether);
        vm.deal(applicant, 0);

        vm.prank(AGENCY);
        distributor.fundProgram{ value: 200 ether }();

        vm.prank(AGENCY);
        distributor.setProgramActive(true);
    }

    function test_verifyAndDisburse_succeedsForEligibleApplicant() public {
        uint256 beforeBalance = applicant.balance;

        vm.prank(applicant);
        distributor.verifyAndDisburse(
            SampleUnemploymentBenefitFixture.proofA(),
            SampleUnemploymentBenefitFixture.proofB(),
            SampleUnemploymentBenefitFixture.proofC(),
            SampleUnemploymentBenefitFixture.publicSignals()
        );

        assertEqBool(distributor.hasClaimed(applicant), true, "claim flag mismatch");
        assertEqUint256(
            applicant.balance,
            beforeBalance + SampleUnemploymentBenefitFixture.benefitAmountWei(),
            "recipient balance mismatch"
        );
    }

    function test_verifyAndDisburse_revertsForSameApplicantTwice() public {
        vm.startPrank(applicant);
        distributor.verifyAndDisburse(
            SampleUnemploymentBenefitFixture.proofA(),
            SampleUnemploymentBenefitFixture.proofB(),
            SampleUnemploymentBenefitFixture.proofC(),
            SampleUnemploymentBenefitFixture.publicSignals()
        );

        vm.expectRevert(abi.encodeWithSelector(UnemploymentBenefitDistributor.NullifierAlreadyUsed.selector, SampleUnemploymentBenefitFixture.nullifierHashBytes32()));
        distributor.verifyAndDisburse(
            SampleUnemploymentBenefitFixture.proofA(),
            SampleUnemploymentBenefitFixture.proofB(),
            SampleUnemploymentBenefitFixture.proofC(),
            SampleUnemploymentBenefitFixture.publicSignals()
        );
        vm.stopPrank();
    }

    function test_verifyAndDisburse_revertsForAnotherWallet() public {
        vm.prank(OTHER);
        vm.expectRevert(
            abi.encodeWithSelector(
                UnemploymentBenefitDistributor.RecipientMismatch.selector,
                OTHER,
                SampleUnemploymentBenefitFixture.publicSignals()[2]
            )
        );
        distributor.verifyAndDisburse(
            SampleUnemploymentBenefitFixture.proofA(),
            SampleUnemploymentBenefitFixture.proofB(),
            SampleUnemploymentBenefitFixture.proofC(),
            SampleUnemploymentBenefitFixture.publicSignals()
        );
    }

    function test_verifyAndDisburse_revertsAfterVersionRefresh() public {
        vm.prank(GOVERNMENT);
        rootRegistry.publishCredentialSet(
            SampleUnemploymentBenefitFixture.credentialSetId(),
            SampleUnemploymentBenefitFixture.v2MerkleRoot(),
            SampleUnemploymentBenefitFixture.v2Version(),
            SampleUnemploymentBenefitFixture.v2ReferenceDate(),
            SampleUnemploymentBenefitFixture.v2EligibleCount()
        );

        vm.prank(applicant);
        vm.expectRevert(
            abi.encodeWithSelector(
                UnemploymentBenefitDistributor.CredentialSetMismatch.selector,
                SampleUnemploymentBenefitFixture.v2MerkleRoot(),
                SampleUnemploymentBenefitFixture.publicSignals()[0]
            )
        );
        distributor.verifyAndDisburse(
            SampleUnemploymentBenefitFixture.proofA(),
            SampleUnemploymentBenefitFixture.proofB(),
            SampleUnemploymentBenefitFixture.proofC(),
            SampleUnemploymentBenefitFixture.publicSignals()
        );
    }

    function test_verifyAndDisburse_revertsWhenProgramPaused() public {
        vm.prank(AGENCY);
        distributor.setProgramActive(false);

        vm.prank(applicant);
        vm.expectRevert(
            abi.encodeWithSelector(UnemploymentBenefitDistributor.ProgramInactive.selector, SampleUnemploymentBenefitFixture.programId())
        );
        distributor.verifyAndDisburse(
            SampleUnemploymentBenefitFixture.proofA(),
            SampleUnemploymentBenefitFixture.proofB(),
            SampleUnemploymentBenefitFixture.proofC(),
            SampleUnemploymentBenefitFixture.publicSignals()
        );
    }
}
