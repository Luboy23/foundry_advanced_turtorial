import { describe, expect, it } from "vitest";
import {
  getApplicationGuardReason,
  getHistoryReadGuardReason,
  getRuleReadGuardReason
} from "@/lib/admission/eligibility";
import type { SchoolRuleVersion } from "@/types/admission";
import type { StudentApplicationSummary } from "@/types/history";

const version: SchoolRuleVersion = {
  schoolId: "0x706b750000000000000000000000000000000000000000000000000000000000",
  universityKey: "0x706b750000000000000000000000000000000000000000000000000000000000",
  schoolIdLabel: "pku",
  familyKey: "pku",
  schoolName: "北京大学",
  versionId: "pku-v1",
  versionNumber: 1,
  scoreSourceId: "0x47414f4b414f5f32303236000000000000000000000000000000000000000000",
  cutoffScore: 60,
  updatedAt: 1,
  admin: "0x0000000000000000000000000000000000000001",
  active: true,
  cutoffFrozen: true,
  status: "frozen"
};

describe("getApplicationGuardReason", () => {
  // 保护目标：链上申请状态未读完前，申请页必须 fail-closed，不能放开重复申请入口。
  it("blocks actions while the onchain application state is still loading", () => {
    expect(
      getHistoryReadGuardReason({
        configured: true,
        connected: true,
        wrongChain: false,
        isLoading: true,
        isError: false
      })
    ).toContain("正在读取当前账户申请状态");
  });

  it("blocks actions when the onchain application state fails to load", () => {
    expect(
      getHistoryReadGuardReason({
        configured: true,
        connected: true,
        wrongChain: false,
        isLoading: false,
        isError: true
      })
    ).toContain("已阻止重复申请");
  });

  it("blocks actions while the onchain rule state is still loading", () => {
    expect(
      getRuleReadGuardReason({
        configured: true,
        connected: true,
        wrongChain: false,
        isLoading: true,
        isError: false
      })
    ).toContain("正在读取当前申请规则");
  });

  // 保护目标：规则读取失败时，学生端要优先暴露系统读取问题，而不是继续走样例或旧缓存。
  it("blocks actions when the onchain rule state fails to load", () => {
    expect(
      getRuleReadGuardReason({
        configured: true,
        connected: true,
        wrongChain: false,
        isLoading: false,
        isError: true
      })
    ).toContain("申请规则读取失败");
  });

  // 保护目标：大学一旦批准，学生就要被视为已录取，其他学校入口必须一并锁死。
  it("blocks new applications after the student has already been admitted", () => {
    const currentApplication: StudentApplicationSummary = {
      schoolId: "0x6a696174696e6764756e00000000000000000000000000000000000000000000",
      schoolName: "家里蹲大学",
      versionId: "jiatingdun-v1",
      versionNumber: 1,
      status: "APPROVED",
      submittedAt: 1000,
      decidedAt: 1234,
      decisionTxHash: "0x1111111111111111111111111111111111111111111111111111111111111111"
    };

    const reason = getApplicationGuardReason({
      configured: true,
      connected: true,
      wrongChain: false,
      credential: {
        version: 2,
        scoreSourceId: "GAOKAO_2026",
        scoreSourceIdBytes32: version.scoreSourceId,
        scoreSourceTitle: "2026 全国统一高考",
        boundStudentAddress: "0x0000000000000000000000000000000000000002",
        boundStudentField: "2",
        candidateLabel: "demo-student",
        candidateIdHash: "100001",
        score: 80,
        maxScore: 100,
        secretSalt: "910001",
        leaf: "1",
        merkleRoot: "1",
        pathElements: [],
        pathIndices: [],
        issuedAt: 1
      },
      version,
      merkleRootMatches: true,
      currentApplication
    });

    expect(reason).toContain("已被 家里蹲大学 录取");
  });

  // 保护目标：同校待审批记录存在时，申请页应明确提示“已向该校提交申请”，而不是允许再次提交。
  it("blocks repeat submissions when an application already exists for the same school", () => {
    const currentApplication: StudentApplicationSummary = {
      schoolId: version.schoolId,
      schoolName: "北京大学",
      versionId: "pku-v1",
      versionNumber: 1,
      status: "PENDING",
      submittedAt: 2000,
      submittedTxHash: "0x2222222222222222222222222222222222222222222222222222222222222222"
    };

    const reason = getApplicationGuardReason({
      configured: true,
      connected: true,
      wrongChain: false,
      credential: {
        version: 2,
        scoreSourceId: "GAOKAO_2026",
        scoreSourceIdBytes32: version.scoreSourceId,
        scoreSourceTitle: "2026 全国统一高考",
        boundStudentAddress: "0x0000000000000000000000000000000000000002",
        boundStudentField: "2",
        candidateLabel: "demo-student",
        candidateIdHash: "100001",
        score: 80,
        maxScore: 100,
        secretSalt: "910001",
        leaf: "1",
        merkleRoot: "1",
        pathElements: [],
        pathIndices: [],
        issuedAt: 1
      },
      version,
      merkleRootMatches: true,
      currentApplication
    });

    expect(reason).toContain("已向该校提交申请");
  });

  // 保护目标：当前版本采用提交即永久锁定，因此拒绝后也不能再次申请其他学校。
  it("blocks all future applications after a rejection because the lock is permanent", () => {
    const currentApplication: StudentApplicationSummary = {
      schoolId: "0x6a696174696e6764756e00000000000000000000000000000000000000000000",
      schoolName: "家里蹲大学",
      versionId: "jiatingdun-v1",
      versionNumber: 1,
      status: "REJECTED",
      submittedAt: 1000,
      decidedAt: 3000
    };

    const reason = getApplicationGuardReason({
      configured: true,
      connected: true,
      wrongChain: false,
      credential: {
        version: 2,
        scoreSourceId: "GAOKAO_2026",
        scoreSourceIdBytes32: version.scoreSourceId,
        scoreSourceTitle: "2026 全国统一高考",
        boundStudentAddress: "0x0000000000000000000000000000000000000002",
        boundStudentField: "2",
        candidateLabel: "demo-student",
        candidateIdHash: "100001",
        score: 80,
        maxScore: 100,
        secretSalt: "910001",
        leaf: "1",
        merkleRoot: "1",
        pathElements: [],
        pathIndices: [],
        issuedAt: 1
      },
      version,
      merkleRootMatches: true,
      currentApplication
    });

    expect(reason).toContain("已被拒绝");
    expect(reason).toContain("永久锁定");
  });
});
