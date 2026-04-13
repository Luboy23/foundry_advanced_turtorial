import { describe, expect, it } from "vitest";
import { mergeApplicationHistory } from "@/lib/history/history-merge";
import type { LocalFailureHistoryItem, OnchainApplicationRecord } from "@/types/history";
import type { SchoolRuleVersion } from "@/types/admission";

const PKU_SCHOOL_ID = "0x706b750000000000000000000000000000000000000000000000000000000000" as const;
const JIATINGDUN_SCHOOL_ID =
  "0x6a696174696e6764756e00000000000000000000000000000000000000000000" as const;

const versionsBySchoolId = new Map<string, SchoolRuleVersion>([
  [
    PKU_SCHOOL_ID,
    {
      schoolId: PKU_SCHOOL_ID,
      universityKey: PKU_SCHOOL_ID,
      schoolIdLabel: "pku",
      familyKey: "pku",
      schoolName: "北京大学",
      versionId: "pku-v1",
      versionNumber: 1,
      scoreSourceId: "0x47414f4b414f5f32303236000000000000000000000000000000000000000000",
      cutoffScore: 100,
      updatedAt: 1,
      admin: "0x0000000000000000000000000000000000000001",
      active: true,
      cutoffFrozen: true,
      status: "frozen"
    }
  ],
  [
    JIATINGDUN_SCHOOL_ID,
    {
      schoolId: JIATINGDUN_SCHOOL_ID,
      universityKey: JIATINGDUN_SCHOOL_ID,
      schoolIdLabel: "jiatingdun",
      familyKey: "jiatingdun",
      schoolName: "家里蹲大学",
      versionId: "jiatingdun-v1",
      versionNumber: 1,
      scoreSourceId: "0x47414f4b414f5f32303236000000000000000000000000000000000000000000",
      cutoffScore: 50,
      updatedAt: 1,
      admin: "0x0000000000000000000000000000000000000002",
      active: true,
      cutoffFrozen: true,
      status: "frozen"
    }
  ]
]);

describe("mergeApplicationHistory", () => {
  // 保护目标：学生工作台看到的时间线必须同时覆盖链上审批结果和后端托管的辅助阻断记录。
  it("merges pending, approved, rejected and auxiliary blocked records into one timeline", () => {
    const applications: OnchainApplicationRecord[] = [
      {
        schoolId: PKU_SCHOOL_ID,
        applicant: "0x0000000000000000000000000000000000000002",
        nullifierHash: 1n,
        submittedTxHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        submittedBlockNumber: 2n,
        submittedAt: 1000,
        status: "REJECTED",
        decidedAt: 3000,
        decisionTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        decisionBlockNumber: 3n
      },
      {
        schoolId: JIATINGDUN_SCHOOL_ID,
        applicant: "0x0000000000000000000000000000000000000002",
        nullifierHash: 2n,
        submittedTxHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        submittedBlockNumber: 4n,
        submittedAt: 4000,
        status: "APPROVED",
        decidedAt: 5000,
        decisionTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        decisionBlockNumber: 5n
      }
    ];

    const localFailures: LocalFailureHistoryItem[] = [
      {
        schoolId: PKU_SCHOOL_ID,
        schoolName: "北京大学",
        walletAddress: "0x0000000000000000000000000000000000000002",
        score: 60,
        cutoffScore: 100,
        createdAt: 500,
        message: "60 分未达到北京大学 100 分录取线。",
        versionId: "pku-v1"
      }
    ];

    const merged = mergeApplicationHistory({
      applications,
      localFailures,
      versionsBySchoolId
    });

    expect(merged).toHaveLength(3);
    expect(merged[0].status).toBe("APPROVED");
    expect(merged[0].source).toBe("onchain");
    expect(merged[1].status).toBe("REJECTED");
    expect(merged[1].source).toBe("onchain");
    expect(merged[2].status).toBe("LOCAL_BLOCKED");
    expect(merged[2].source).toBe("auxiliary");
    expect(merged[0].schoolName).toBe("家里蹲大学");
    expect(merged[1].message).toContain("已拒绝");
  });

  // 保护目标：大学尚未审批前，学生仍然要在自己的工作台看到明确的“待审批”状态。
  it("keeps a pending application visible while waiting for university review", () => {
    const applications: OnchainApplicationRecord[] = [
      {
        schoolId: PKU_SCHOOL_ID,
        applicant: "0x0000000000000000000000000000000000000002",
        nullifierHash: 1n,
        submittedTxHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        submittedBlockNumber: 2n,
        submittedAt: 1000,
        status: "PENDING"
      }
    ];

    const merged = mergeApplicationHistory({
      applications,
      localFailures: [],
      versionsBySchoolId
    });

    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("PENDING");
    expect(merged[0].createdAt).toBe(1000);
    expect(merged[0].message).toContain("等待大学审批");
  });
});
