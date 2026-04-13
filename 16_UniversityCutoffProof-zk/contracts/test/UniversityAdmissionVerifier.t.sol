// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { TestBase } from "./helpers/TestBase.sol";
import { AdmissionRoleRegistry } from "../src/AdmissionRoleRegistry.sol";
import { ScoreRootRegistry } from "../src/ScoreRootRegistry.sol";
import { UniversityAdmissionVerifier } from "../src/UniversityAdmissionVerifier.sol";
import { UniversityCutoffProofVerifier } from "../src/UniversityCutoffProofVerifier.sol";
import { IUniversityCutoffProofVerifier } from "../src/interfaces/IUniversityCutoffProofVerifier.sol";
import { SampleAdmissionFixture } from "./generated/SampleAdmissionFixture.sol";

contract MockUniversityCutoffProofVerifier is IUniversityCutoffProofVerifier {
    bool private s_shouldVerify = true;

    /// @notice 测试里通过开关真假返回值，分别覆盖“证明通过”和“证明失败”两条分支。
    function setShouldVerify(bool shouldVerify) external {
        s_shouldVerify = shouldVerify;
    }

    function verifyProof(
        uint256[2] memory,
        uint256[2][2] memory,
        uint256[2] memory,
        uint256[6] memory
    ) external view returns (bool) {
        return s_shouldVerify;
    }
}

/// @notice 保护大学申请两阶段状态机的核心行为：
/// 1. 学生提交时只落一条 Pending 申请；
/// 2. 大学审批时才写入录取或拒绝结果；
/// 3. 任意学校一旦批准，学生会被全局锁定，不能再被其他学校录取。
contract UniversityAdmissionVerifierTest is TestBase {
    event ApplicationSubmitted(bytes32 indexed schoolId, address indexed applicant, uint256 nullifierHash);
    event ApplicationApproved(bytes32 indexed schoolId, address indexed applicant, uint64 approvedAt);
    event ApplicationRejected(bytes32 indexed schoolId, address indexed applicant, uint64 rejectedAt);

    bytes32 internal constant PKU_KEY = bytes32("pku");
    bytes32 internal constant JIATINGDUN_KEY = bytes32("jiatingdun");
    bytes32 internal constant ELIGIBLE_PKU_SCHOOL_ID = bytes32("pku");

    address internal constant AUTHORITY = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address internal constant STUDENT = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address internal constant SECOND_STUDENT = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;
    address internal constant PKU_ADMIN = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address internal constant JIATINGDUN_ADMIN = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;
    address internal constant OTHER = address(0xCAFE);

    uint32 internal constant ELIGIBLE_PKU_CUTOFF = 60;
    uint256 internal constant PKU_NULLIFIER = 101;
    uint256 internal constant JIATINGDUN_NULLIFIER = 202;
    uint256 internal constant SECOND_STUDENT_NULLIFIER = 303;

    AdmissionRoleRegistry internal roleRegistry;
    ScoreRootRegistry internal scoreRootRegistry;
    MockUniversityCutoffProofVerifier internal mockVerifier;
    UniversityAdmissionVerifier internal universityAdmissionVerifier;

    /// @dev 每个测试前都搭一套完整最小环境：角色、成绩源、两所学校规则和 mock verifier。
    function setUp() public {
        roleRegistry = new AdmissionRoleRegistry(AUTHORITY);
        vm.prank(AUTHORITY);
        roleRegistry.setStudent(STUDENT, true);
        vm.prank(AUTHORITY);
        roleRegistry.setStudent(SECOND_STUDENT, true);
        vm.prank(AUTHORITY);
        roleRegistry.setUniversityAdmin(PKU_KEY, SampleAdmissionFixture.pkuSchoolName(), PKU_ADMIN, true);
        vm.prank(AUTHORITY);
        roleRegistry.setUniversityAdmin(
            JIATINGDUN_KEY, SampleAdmissionFixture.jiatingdunSchoolName(), JIATINGDUN_ADMIN, true
        );

        scoreRootRegistry = new ScoreRootRegistry(address(roleRegistry));
        mockVerifier = new MockUniversityCutoffProofVerifier();
        universityAdmissionVerifier =
            new UniversityAdmissionVerifier(address(scoreRootRegistry), address(mockVerifier), address(roleRegistry));

        vm.prank(AUTHORITY);
        scoreRootRegistry.createScoreSource(
            SampleAdmissionFixture.scoreSourceId(),
            SampleAdmissionFixture.scoreSourceTitle(),
            SampleAdmissionFixture.maxScore(),
            SampleAdmissionFixture.merkleRoot()
        );

        vm.prank(PKU_ADMIN);
        universityAdmissionVerifier.createSchool(
            PKU_KEY,
            ELIGIBLE_PKU_SCHOOL_ID,
            SampleAdmissionFixture.pkuSchoolName(),
            SampleAdmissionFixture.scoreSourceId(),
            ELIGIBLE_PKU_CUTOFF
        );
        vm.prank(PKU_ADMIN);
        universityAdmissionVerifier.setSchoolStatus(ELIGIBLE_PKU_SCHOOL_ID, true);

        vm.prank(JIATINGDUN_ADMIN);
        universityAdmissionVerifier.createSchool(
            JIATINGDUN_KEY,
            SampleAdmissionFixture.jiatingdunSchoolId(),
            SampleAdmissionFixture.jiatingdunSchoolName(),
            SampleAdmissionFixture.scoreSourceId(),
            SampleAdmissionFixture.jiatingdunCutoff()
        );
        vm.prank(JIATINGDUN_ADMIN);
        universityAdmissionVerifier.setSchoolStatus(SampleAdmissionFixture.jiatingdunSchoolId(), true);
    }

    function test_submitApplication_createsPendingRecordAndMarksNullifier() public {
        vm.prank(STUDENT);
        vm.expectEmit(true, true, true, true);
        emit ApplicationSubmitted(ELIGIBLE_PKU_SCHOOL_ID, STUDENT, PKU_NULLIFIER);
        universityAdmissionVerifier.submitApplication(
            ELIGIBLE_PKU_SCHOOL_ID,
            PKU_NULLIFIER,
            SampleAdmissionFixture.proofA(),
            SampleAdmissionFixture.proofB(),
            SampleAdmissionFixture.proofC()
        );

        UniversityAdmissionVerifier.ApplicationRecord memory application =
            universityAdmissionVerifier.getApplication(ELIGIBLE_PKU_SCHOOL_ID, STUDENT);

        assertEqBytes32(application.schoolId, ELIGIBLE_PKU_SCHOOL_ID, "school id mismatch");
        assertEqAddress(application.applicant, STUDENT, "applicant mismatch");
        assertEqUint256(application.nullifierHash, PKU_NULLIFIER, "nullifier mismatch");
        assertTrue(application.submittedAt != 0, "submittedAt missing");
        assertEqUint256(uint256(application.decidedAt), 0, "decidedAt should be zero");
        assertEqUint256(
            uint256(application.status), uint256(UniversityAdmissionVerifier.ApplicationStatus.Pending), "status mismatch"
        );
        assertEqBool(
            universityAdmissionVerifier.usedNullifiers(ELIGIBLE_PKU_SCHOOL_ID, PKU_NULLIFIER), true, "nullifier not recorded"
        );

        (UniversityAdmissionVerifier.ApplicationRecord memory lockedApplication, bool exists) =
            universityAdmissionVerifier.getStudentApplication(STUDENT);
        address[] memory applicants = universityAdmissionVerifier.getSchoolApplicants(ELIGIBLE_PKU_SCHOOL_ID);

        assertEqBool(exists, true, "student application should exist");
        assertEqBytes32(lockedApplication.schoolId, ELIGIBLE_PKU_SCHOOL_ID, "student lock school mismatch");
        assertEqUint256(applicants.length, 1, "school applicants length mismatch");
        assertEqAddress(applicants[0], STUDENT, "school applicant mismatch");
    }

    /// @notice 边界保护：同校重复提交必须被永久锁挡住，而不是落第二条 Pending 记录。
    function test_submitApplication_revertsWhenStudentAlreadyAppliedToSameSchool() public {
        _submitAs(STUDENT, ELIGIBLE_PKU_SCHOOL_ID, PKU_NULLIFIER);

        vm.prank(STUDENT);
        vm.expectRevert(
            abi.encodeWithSelector(
                UniversityAdmissionVerifier.StudentAlreadyApplied.selector, STUDENT, ELIGIBLE_PKU_SCHOOL_ID
            )
        );
        universityAdmissionVerifier.submitApplication(
            ELIGIBLE_PKU_SCHOOL_ID,
            PKU_NULLIFIER + 1,
            SampleAdmissionFixture.proofA(),
            SampleAdmissionFixture.proofB(),
            SampleAdmissionFixture.proofC()
        );
    }

    /// @notice 边界保护：当前版本不允许跨校并行申请，因此换学校再次提交也必须失败。
    function test_submitApplication_revertsWhenStudentAlreadyAppliedToOtherSchool() public {
        _submitAs(STUDENT, ELIGIBLE_PKU_SCHOOL_ID, PKU_NULLIFIER);

        vm.prank(STUDENT);
        vm.expectRevert(
            abi.encodeWithSelector(
                UniversityAdmissionVerifier.StudentAlreadyApplied.selector, STUDENT, ELIGIBLE_PKU_SCHOOL_ID
            )
        );
        universityAdmissionVerifier.submitApplication(
            SampleAdmissionFixture.jiatingdunSchoolId(),
            JIATINGDUN_NULLIFIER,
            SampleAdmissionFixture.proofA(),
            SampleAdmissionFixture.proofB(),
            SampleAdmissionFixture.proofC()
        );
    }

    /// @notice 场景意图：大学批准后，申请记录和学生全局录取状态都应同步更新。
    function test_approveApplication_marksStudentAdmitted() public {
        _submitAs(STUDENT, ELIGIBLE_PKU_SCHOOL_ID, PKU_NULLIFIER);

        vm.prank(PKU_ADMIN);
        vm.expectEmit(true, true, true, true);
        emit ApplicationApproved(ELIGIBLE_PKU_SCHOOL_ID, STUDENT, uint64(block.timestamp));
        universityAdmissionVerifier.approveApplication(ELIGIBLE_PKU_SCHOOL_ID, STUDENT);

        UniversityAdmissionVerifier.ApplicationRecord memory application =
            universityAdmissionVerifier.getApplication(ELIGIBLE_PKU_SCHOOL_ID, STUDENT);
        UniversityAdmissionVerifier.AdmissionRecord memory admission = universityAdmissionVerifier.getAdmission(STUDENT);

        assertEqUint256(
            uint256(application.status), uint256(UniversityAdmissionVerifier.ApplicationStatus.Approved), "status mismatch"
        );
        assertTrue(application.decidedAt != 0, "decidedAt missing");
        assertEqBytes32(admission.schoolId, ELIGIBLE_PKU_SCHOOL_ID, "admission school mismatch");
        assertEqBool(admission.admitted, true, "admission flag mismatch");
        assertTrue(admission.admittedAt != 0, "admittedAt missing");
    }

    /// @notice 场景意图：大学拒绝后，申请状态应变为 Rejected，但不会写入录取记录。
    function test_rejectApplication_marksApplicationRejected() public {
        _submitAs(STUDENT, ELIGIBLE_PKU_SCHOOL_ID, PKU_NULLIFIER);

        vm.prank(PKU_ADMIN);
        vm.expectEmit(true, true, true, true);
        emit ApplicationRejected(ELIGIBLE_PKU_SCHOOL_ID, STUDENT, uint64(block.timestamp));
        universityAdmissionVerifier.rejectApplication(ELIGIBLE_PKU_SCHOOL_ID, STUDENT);

        UniversityAdmissionVerifier.ApplicationRecord memory application =
            universityAdmissionVerifier.getApplication(ELIGIBLE_PKU_SCHOOL_ID, STUDENT);
        UniversityAdmissionVerifier.AdmissionRecord memory admission = universityAdmissionVerifier.getAdmission(STUDENT);

        assertEqUint256(
            uint256(application.status), uint256(UniversityAdmissionVerifier.ApplicationStatus.Rejected), "status mismatch"
        );
        assertTrue(application.decidedAt != 0, "decidedAt missing");
        assertEqBool(admission.admitted, false, "student should not be admitted");
        assertEqBytes32(admission.schoolId, bytes32(0), "admission school should be empty");
    }

    function test_submitApplication_revertsWhenStudentAlreadyLockedAfterApproval() public {
        _submitAs(STUDENT, ELIGIBLE_PKU_SCHOOL_ID, PKU_NULLIFIER);

        vm.prank(PKU_ADMIN);
        universityAdmissionVerifier.approveApplication(ELIGIBLE_PKU_SCHOOL_ID, STUDENT);

        vm.prank(STUDENT);
        vm.expectRevert(
            abi.encodeWithSelector(
                UniversityAdmissionVerifier.StudentAlreadyApplied.selector, STUDENT, ELIGIBLE_PKU_SCHOOL_ID
            )
        );
        universityAdmissionVerifier.submitApplication(
            SampleAdmissionFixture.jiatingdunSchoolId(),
            JIATINGDUN_NULLIFIER,
            SampleAdmissionFixture.proofA(),
            SampleAdmissionFixture.proofB(),
            SampleAdmissionFixture.proofC()
        );
    }

    function test_submitApplication_revertsWhenStudentAlreadyLockedAfterRejection() public {
        _submitAs(STUDENT, ELIGIBLE_PKU_SCHOOL_ID, PKU_NULLIFIER);

        vm.prank(PKU_ADMIN);
        universityAdmissionVerifier.rejectApplication(ELIGIBLE_PKU_SCHOOL_ID, STUDENT);

        vm.prank(STUDENT);
        vm.expectRevert(
            abi.encodeWithSelector(
                UniversityAdmissionVerifier.StudentAlreadyApplied.selector, STUDENT, ELIGIBLE_PKU_SCHOOL_ID
            )
        );
        universityAdmissionVerifier.submitApplication(
            SampleAdmissionFixture.jiatingdunSchoolId(),
            JIATINGDUN_NULLIFIER,
            SampleAdmissionFixture.proofA(),
            SampleAdmissionFixture.proofB(),
            SampleAdmissionFixture.proofC()
        );
    }

    function test_reviewApplication_revertsForNonSchoolAdmin() public {
        _submitAs(STUDENT, ELIGIBLE_PKU_SCHOOL_ID, PKU_NULLIFIER);

        vm.prank(OTHER);
        vm.expectRevert(abi.encodeWithSelector(UniversityAdmissionVerifier.Unauthorized.selector, OTHER));
        universityAdmissionVerifier.approveApplication(ELIGIBLE_PKU_SCHOOL_ID, STUDENT);

        vm.prank(JIATINGDUN_ADMIN);
        vm.expectRevert(abi.encodeWithSelector(UniversityAdmissionVerifier.Unauthorized.selector, JIATINGDUN_ADMIN));
        universityAdmissionVerifier.rejectApplication(ELIGIBLE_PKU_SCHOOL_ID, STUDENT);
    }

    function test_reviewApplication_revertsWhenAlreadyApproved() public {
        _submitAs(STUDENT, ELIGIBLE_PKU_SCHOOL_ID, PKU_NULLIFIER);

        vm.prank(PKU_ADMIN);
        universityAdmissionVerifier.approveApplication(ELIGIBLE_PKU_SCHOOL_ID, STUDENT);

        vm.prank(PKU_ADMIN);
        vm.expectRevert(
            abi.encodeWithSelector(
                UniversityAdmissionVerifier.ApplicationNotPending.selector,
                ELIGIBLE_PKU_SCHOOL_ID,
                STUDENT,
                uint8(UniversityAdmissionVerifier.ApplicationStatus.Approved)
            )
        );
        universityAdmissionVerifier.approveApplication(ELIGIBLE_PKU_SCHOOL_ID, STUDENT);
    }

    function test_reviewApplication_revertsWhenAlreadyRejected() public {
        _submitAs(STUDENT, ELIGIBLE_PKU_SCHOOL_ID, PKU_NULLIFIER);

        vm.prank(PKU_ADMIN);
        universityAdmissionVerifier.rejectApplication(ELIGIBLE_PKU_SCHOOL_ID, STUDENT);

        vm.prank(PKU_ADMIN);
        vm.expectRevert(
            abi.encodeWithSelector(
                UniversityAdmissionVerifier.ApplicationNotPending.selector,
                ELIGIBLE_PKU_SCHOOL_ID,
                STUDENT,
                uint8(UniversityAdmissionVerifier.ApplicationStatus.Rejected)
            )
        );
        universityAdmissionVerifier.rejectApplication(ELIGIBLE_PKU_SCHOOL_ID, STUDENT);
    }

    function test_submitApplication_revertsOnInactiveSchool() public {
        vm.prank(PKU_ADMIN);
        universityAdmissionVerifier.setSchoolStatus(ELIGIBLE_PKU_SCHOOL_ID, false);

        vm.prank(STUDENT);
        vm.expectRevert(
            abi.encodeWithSelector(UniversityAdmissionVerifier.SchoolInactive.selector, ELIGIBLE_PKU_SCHOOL_ID)
        );
        universityAdmissionVerifier.submitApplication(
            ELIGIBLE_PKU_SCHOOL_ID,
            PKU_NULLIFIER,
            SampleAdmissionFixture.proofA(),
            SampleAdmissionFixture.proofB(),
            SampleAdmissionFixture.proofC()
        );
    }

    function test_setSchoolStatus_openRuleMarksActiveAndFrozen() public {
        bytes32 stagedSchoolId = bytes32("pku-next");
        bytes32 stagedSourceId = bytes32("GAOKAO_2027");

        vm.prank(AUTHORITY);
        scoreRootRegistry.createScoreSource(stagedSourceId, unicode"2027 全国统一高考", 100, uint256(keccak256("2027-root")));

        vm.prank(PKU_ADMIN);
        universityAdmissionVerifier.createSchool(
            PKU_KEY,
            stagedSchoolId,
            unicode"北京大学 2027 规则",
            stagedSourceId,
            88
        );

        UniversityAdmissionVerifier.SchoolConfig memory beforeOpen = universityAdmissionVerifier.getSchool(stagedSchoolId);
        assertEqBool(beforeOpen.active, false, "draft should start inactive");
        assertEqBool(beforeOpen.cutoffFrozen, false, "draft should start unfrozen");

        vm.prank(PKU_ADMIN);
        universityAdmissionVerifier.setSchoolStatus(stagedSchoolId, true);

        UniversityAdmissionVerifier.SchoolConfig memory opened = universityAdmissionVerifier.getSchool(stagedSchoolId);
        assertEqBool(opened.active, true, "opened rule should be active");
        assertEqBool(opened.cutoffFrozen, true, "opened rule should freeze cutoff");
        assertTrue(opened.updatedAt != 0, "opened rule should update timestamp");
    }

    function test_submitApplication_revertsOnInactiveScoreSource() public {
        vm.prank(AUTHORITY);
        scoreRootRegistry.setSourceStatus(SampleAdmissionFixture.scoreSourceId(), false);

        vm.prank(STUDENT);
        vm.expectRevert(
            abi.encodeWithSelector(
                UniversityAdmissionVerifier.ScoreSourceInactive.selector, SampleAdmissionFixture.scoreSourceId()
            )
        );
        universityAdmissionVerifier.submitApplication(
            ELIGIBLE_PKU_SCHOOL_ID,
            PKU_NULLIFIER,
            SampleAdmissionFixture.proofA(),
            SampleAdmissionFixture.proofB(),
            SampleAdmissionFixture.proofC()
        );
    }

    function test_submitApplication_revertsOnInvalidProofFromMockVerifier() public {
        mockVerifier.setShouldVerify(false);

        vm.prank(STUDENT);
        vm.expectRevert(UniversityAdmissionVerifier.InvalidProof.selector);
        universityAdmissionVerifier.submitApplication(
            ELIGIBLE_PKU_SCHOOL_ID,
            PKU_NULLIFIER,
            SampleAdmissionFixture.proofA(),
            SampleAdmissionFixture.proofB(),
            SampleAdmissionFixture.proofC()
        );
    }

    function test_submitApplication_withRealVerifier_succeedsForFixture() public {
        UniversityAdmissionVerifier realVerifierAdmission = _deployRealVerifierAdmission();

        vm.prank(SampleAdmissionFixture.sampleRecipient());
        realVerifierAdmission.submitApplication(
            SampleAdmissionFixture.sampleSuccessSchoolId(),
            SampleAdmissionFixture.sampleNullifierHash(),
            SampleAdmissionFixture.proofA(),
            SampleAdmissionFixture.proofB(),
            SampleAdmissionFixture.proofC()
        );

        UniversityAdmissionVerifier.ApplicationRecord memory application =
            realVerifierAdmission.getApplication(
                SampleAdmissionFixture.sampleSuccessSchoolId(), SampleAdmissionFixture.sampleRecipient()
            );

        assertEqUint256(
            uint256(application.status), uint256(UniversityAdmissionVerifier.ApplicationStatus.Pending), "status mismatch"
        );
        assertEqBool(
            realVerifierAdmission.usedNullifiers(
                SampleAdmissionFixture.sampleSuccessSchoolId(), SampleAdmissionFixture.sampleNullifierHash()
            ),
            true,
            "nullifier not recorded"
        );
    }

    function test_createSchool_revertsWhenSameUniversityReusesSameScoreSource() public {
        vm.prank(PKU_ADMIN);
        vm.expectRevert(
            abi.encodeWithSelector(
                UniversityAdmissionVerifier.ScoreSourceRuleAlreadyExists.selector,
                PKU_KEY,
                SampleAdmissionFixture.scoreSourceId(),
                ELIGIBLE_PKU_SCHOOL_ID
            )
        );
        universityAdmissionVerifier.createSchool(
            PKU_KEY,
            bytes32("pku-v2"),
            unicode"北京大学第二轮",
            SampleAdmissionFixture.scoreSourceId(),
            80
        );
    }

    function test_createSchool_allowsDifferentUniversitiesToShareSameScoreSource() public view {
        bytes32 mappedSchoolId =
            universityAdmissionVerifier.getSchoolIdByScoreSource(JIATINGDUN_KEY, SampleAdmissionFixture.scoreSourceId());

        assertEqBytes32(mappedSchoolId, SampleAdmissionFixture.jiatingdunSchoolId(), "jiatingdun mapping mismatch");
    }

    function test_createSchool_allowsSameUniversityToUseNewScoreSource() public {
        bytes32 nextScoreSourceId = bytes32("GAOKAO_2027");
        vm.prank(AUTHORITY);
        scoreRootRegistry.createScoreSource(nextScoreSourceId, unicode"2027 全国统一高考", 100, uint256(keccak256("next-root")));

        bytes32 nextSchoolId = bytes32("pku-v2");
        vm.prank(PKU_ADMIN);
        universityAdmissionVerifier.createSchool(PKU_KEY, nextSchoolId, SampleAdmissionFixture.pkuSchoolName(), nextScoreSourceId, 90);

        bytes32 mappedSchoolId = universityAdmissionVerifier.getSchoolIdByScoreSource(PKU_KEY, nextScoreSourceId);
        assertEqBytes32(mappedSchoolId, nextSchoolId, "new score source mapping mismatch");
    }

    function test_updateSchoolCutoff_revertsWhenRuleAlreadyCreated() public {
        bytes32 draftSchoolId = bytes32("draft-school");
        vm.prank(AUTHORITY);
        scoreRootRegistry.createScoreSource(bytes32("draft-source"), unicode"草稿成绩源", 100, uint256(keccak256("draft-root")));

        vm.prank(PKU_ADMIN);
        universityAdmissionVerifier.createSchool(
            PKU_KEY,
            draftSchoolId,
            unicode"草稿大学",
            bytes32("draft-source"),
            10
        );

        vm.prank(PKU_ADMIN);
        vm.expectRevert(
            abi.encodeWithSelector(
                UniversityAdmissionVerifier.SchoolCutoffLocked.selector, draftSchoolId
            )
        );
        universityAdmissionVerifier.updateSchoolCutoff(draftSchoolId, 20);
    }

    function test_updateSchoolCutoff_revertsWhenRuleAlreadyOpened() public {
        vm.prank(JIATINGDUN_ADMIN);
        vm.expectRevert(
            abi.encodeWithSelector(
                UniversityAdmissionVerifier.SchoolCutoffLocked.selector, SampleAdmissionFixture.jiatingdunSchoolId()
            )
        );
        universityAdmissionVerifier.updateSchoolCutoff(SampleAdmissionFixture.jiatingdunSchoolId(), 40);
    }

    function test_createSchool_revertsForNonRegisteredUniversityAdmin() public {
        vm.prank(OTHER);
        vm.expectRevert(abi.encodeWithSelector(UniversityAdmissionVerifier.Unauthorized.selector, OTHER));
        universityAdmissionVerifier.createSchool(
            PKU_KEY,
            bytes32("rogue-school"),
            unicode"伪造大学",
            SampleAdmissionFixture.scoreSourceId(),
            10
        );
    }

    function _submitAs(address applicant, bytes32 schoolId, uint256 nullifierHash) private {
        vm.prank(applicant);
        universityAdmissionVerifier.submitApplication(
            schoolId, nullifierHash, SampleAdmissionFixture.proofA(), SampleAdmissionFixture.proofB(), SampleAdmissionFixture.proofC()
        );
    }

    function _deployRealVerifierAdmission() private returns (UniversityAdmissionVerifier realVerifierAdmission) {
        UniversityCutoffProofVerifier realVerifier = new UniversityCutoffProofVerifier();
        realVerifierAdmission =
            new UniversityAdmissionVerifier(address(scoreRootRegistry), address(realVerifier), address(roleRegistry));

        vm.prank(JIATINGDUN_ADMIN);
        realVerifierAdmission.createSchool(
            JIATINGDUN_KEY,
            SampleAdmissionFixture.jiatingdunSchoolId(),
            SampleAdmissionFixture.jiatingdunSchoolName(),
            SampleAdmissionFixture.scoreSourceId(),
            SampleAdmissionFixture.jiatingdunCutoff()
        );

        vm.prank(JIATINGDUN_ADMIN);
        realVerifierAdmission.setSchoolStatus(SampleAdmissionFixture.jiatingdunSchoolId(), true);
    }
}
