// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { TestBase } from "./helpers/TestBase.sol";
import { AdmissionRoleRegistry } from "../src/AdmissionRoleRegistry.sol";
import { ScoreRootRegistry } from "../src/ScoreRootRegistry.sol";
import { SampleAdmissionFixture } from "./generated/SampleAdmissionFixture.sol";

/// @notice 保护成绩源登记合约的核心行为：
/// 1. 只有考试院能创建和维护成绩源；
/// 2. 成绩源重复创建会失败；
/// 3. 成绩根更新和启停能正确生效。
contract ScoreRootRegistryTest is TestBase {
    address internal constant AUTHORITY = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    ScoreRootRegistry internal registry;
    AdmissionRoleRegistry internal roleRegistry;

    address internal constant OTHER = address(0xBEEF);

    /// @dev 每个测试用例都先搭建一套最小角色表和成绩源合约。
    function setUp() public {
        roleRegistry = new AdmissionRoleRegistry(AUTHORITY);
        registry = new ScoreRootRegistry(address(roleRegistry));
    }

    /// @notice 场景意图：考试院能够成功创建一份完整成绩源。
    function test_createScoreSource_succeeds() public {
        vm.prank(AUTHORITY);
        registry.createScoreSource(
            SampleAdmissionFixture.scoreSourceId(),
            SampleAdmissionFixture.scoreSourceTitle(),
            SampleAdmissionFixture.maxScore(),
            SampleAdmissionFixture.merkleRoot()
        );

        ScoreRootRegistry.ScoreSource memory scoreSource = registry.getScoreSource(SampleAdmissionFixture.scoreSourceId());
        assertEqBytes32(
            scoreSource.scoreSourceId, SampleAdmissionFixture.scoreSourceId(), "score source id mismatch"
        );
        assertEqString(scoreSource.sourceTitle, SampleAdmissionFixture.scoreSourceTitle(), "source title mismatch");
        assertEqUint256(scoreSource.merkleRoot, SampleAdmissionFixture.merkleRoot(), "merkle root mismatch");
        assertEqUint32(uint32(scoreSource.maxScore), uint32(SampleAdmissionFixture.maxScore()), "max score mismatch");
        assertEqAddress(scoreSource.issuer, AUTHORITY, "issuer mismatch");
        assertEqBool(scoreSource.active, true, "active mismatch");
    }

    /// @notice 边界保护：同一 scoreSourceId 不能重复创建。
    function test_createScoreSource_revertsOnDuplicateSourceId() public {
        vm.prank(AUTHORITY);
        registry.createScoreSource(
            SampleAdmissionFixture.scoreSourceId(),
            SampleAdmissionFixture.scoreSourceTitle(),
            SampleAdmissionFixture.maxScore(),
            SampleAdmissionFixture.merkleRoot()
        );

        vm.prank(AUTHORITY);
        vm.expectRevert(
            abi.encodeWithSelector(
                ScoreRootRegistry.ScoreSourceAlreadyExists.selector, SampleAdmissionFixture.scoreSourceId()
            )
        );
        registry.createScoreSource(
            SampleAdmissionFixture.scoreSourceId(),
            SampleAdmissionFixture.scoreSourceTitle(),
            SampleAdmissionFixture.maxScore(),
            SampleAdmissionFixture.merkleRoot()
        );
    }

    /// @notice 边界保护：非考试院地址不能更新成绩树根。
    function test_updateMerkleRoot_revertsForNonIssuer() public {
        vm.prank(AUTHORITY);
        registry.createScoreSource(
            SampleAdmissionFixture.scoreSourceId(),
            SampleAdmissionFixture.scoreSourceTitle(),
            SampleAdmissionFixture.maxScore(),
            SampleAdmissionFixture.merkleRoot()
        );

        vm.prank(OTHER);
        vm.expectRevert(abi.encodeWithSelector(ScoreRootRegistry.Unauthorized.selector, OTHER));
        registry.updateMerkleRoot(SampleAdmissionFixture.scoreSourceId(), SampleAdmissionFixture.merkleRoot() + 1);
    }

    /// @notice 场景意图：考试院可以更新既有成绩源的树根。
    function test_updateMerkleRoot_succeedsForIssuer() public {
        vm.prank(AUTHORITY);
        registry.createScoreSource(
            SampleAdmissionFixture.scoreSourceId(),
            SampleAdmissionFixture.scoreSourceTitle(),
            SampleAdmissionFixture.maxScore(),
            SampleAdmissionFixture.merkleRoot()
        );

        uint256 nextRoot = SampleAdmissionFixture.merkleRoot() + 123;
        vm.prank(AUTHORITY);
        registry.updateMerkleRoot(SampleAdmissionFixture.scoreSourceId(), nextRoot);

        ScoreRootRegistry.ScoreSource memory scoreSource = registry.getScoreSource(SampleAdmissionFixture.scoreSourceId());
        assertEqUint256(scoreSource.merkleRoot, nextRoot, "root update mismatch");
    }

    /// @notice 场景意图：考试院可以停用成绩源。
    function test_setSourceStatus_succeeds() public {
        vm.prank(AUTHORITY);
        registry.createScoreSource(
            SampleAdmissionFixture.scoreSourceId(),
            SampleAdmissionFixture.scoreSourceTitle(),
            SampleAdmissionFixture.maxScore(),
            SampleAdmissionFixture.merkleRoot()
        );

        vm.prank(AUTHORITY);
        registry.setSourceStatus(SampleAdmissionFixture.scoreSourceId(), false);
        ScoreRootRegistry.ScoreSource memory scoreSource = registry.getScoreSource(SampleAdmissionFixture.scoreSourceId());
        assertEqBool(scoreSource.active, false, "status not updated");
    }
}
