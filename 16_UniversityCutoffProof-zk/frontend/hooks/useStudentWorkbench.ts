"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStudentWorkbench } from "@/lib/api/student";
import type { SchoolRuleVersion } from "@/types/admission";
import type {
  ApplicationHistoryRecord,
  StudentApplicationSummary
} from "@/types/history";

// 学生 workbench hook。
// 它负责把后端聚合 DTO 转成学生页面真正需要的规则、当前申请、链上记录和辅助记录四类结构。
function toRule(dto: {
  schoolId: string;
  schoolIdLabel: string;
  familyKey: string;
  schoolName: string;
  versionId: string;
  versionNumber: number;
  universityKey: string;
  scoreSourceId: string;
  cutoffScore: number;
  admin: string;
  active: boolean;
  cutoffFrozen: boolean;
  updatedAt: string;
}): SchoolRuleVersion {
  return {
    schoolId: dto.schoolId as `0x${string}`,
    schoolIdLabel: dto.schoolIdLabel,
    familyKey: dto.familyKey as "pku" | "jiatingdun",
    schoolName: dto.schoolName,
    versionId: dto.versionId,
    versionNumber: dto.versionNumber,
    universityKey: dto.universityKey as `0x${string}`,
    scoreSourceId: dto.scoreSourceId as `0x${string}`,
    cutoffScore: dto.cutoffScore,
    admin: dto.admin as `0x${string}`,
    active: dto.active,
    cutoffFrozen: dto.cutoffFrozen,
    updatedAt: Math.floor(new Date(dto.updatedAt).getTime() / 1000),
    status: !dto.cutoffFrozen ? "draft" : dto.active ? "frozen" : "superseded"
  };
}

export function useStudentWorkbench(args: {
  walletAddress?: `0x${string}`;
  enabled?: boolean;
}) {
  const { walletAddress, enabled = true } = args;
  const query = useQuery({
    queryKey: ["student-workbench", walletAddress],
    enabled: Boolean(enabled && walletAddress),
    queryFn: () => getStudentWorkbench(walletAddress!)
  });

  // 后端返回的规则列表保留了链上状态字段，这里再补一层前端 status，
  // 方便学生页统一展示 draft / frozen / superseded 三种规则语义。
  const rules = useMemo(
    () => (query.data?.rules ?? []).map(toRule),
    [query.data?.rules]
  );

  const rulesBySchoolId = useMemo(() => {
    const map = new Map<string, SchoolRuleVersion>();
    for (const rule of rules) {
      map.set(rule.schoolId.toLowerCase(), rule);
    }
    return map;
  }, [rules]);

  // 当前申请只认链上投影，不受辅助记录影响。
  // 这也是学生“申请资格锁”能保持稳定的关键。
  const currentApplication = useMemo<StudentApplicationSummary | null>(() => {
    const application = query.data?.currentApplication;
    if (!application) {
      return null;
    }
    const version = rulesBySchoolId.get(application.schoolId.toLowerCase());
    return {
      schoolId: application.schoolId as `0x${string}`,
      schoolName: application.schoolName,
      versionId: version?.versionId ?? "unknown",
      versionNumber: version?.versionNumber ?? null,
      status: application.status as "PENDING" | "APPROVED" | "REJECTED",
      submittedAt: new Date(application.submittedAt).getTime(),
      decidedAt: application.decidedAt ? new Date(application.decidedAt).getTime() : undefined,
      submittedTxHash: (application.submittedTxHash ?? undefined) as `0x${string}` | undefined,
      decisionTxHash: (application.decisionTxHash ?? undefined) as `0x${string}` | undefined
    };
  }, [query.data?.currentApplication, rulesBySchoolId]);

  // 链上申请记录负责解释真正提交到合约里的状态流转。
  const onchainRecords = useMemo<ApplicationHistoryRecord[]>(() => {
    return (query.data?.applications ?? []).map((application: {
      schoolId: string;
      schoolName: string;
      applicant: string;
      status: string;
      submittedAt: string;
      decidedAt?: string | null;
      submittedTxHash?: string | null;
      decisionTxHash?: string | null;
    }) => {
      const version = rulesBySchoolId.get(application.schoolId.toLowerCase());
      const createdAt = application.decidedAt
        ? new Date(application.decidedAt).getTime()
        : new Date(application.submittedAt).getTime();
      const status = application.status as "PENDING" | "APPROVED" | "REJECTED";
      const message =
        status === "APPROVED"
          ? `${application.schoolName} 已批准你的申请。`
          : status === "REJECTED"
            ? `${application.schoolName} 已拒绝你的申请。`
            : `${application.schoolName} 正在审批你的申请。`;

      return {
        id: `${application.schoolId}-${application.applicant}`,
        schoolId: application.schoolId as `0x${string}`,
        schoolName: application.schoolName,
        versionId: version?.versionId ?? "unknown",
        versionNumber: version?.versionNumber ?? null,
        cutoffScore: version?.cutoffScore ?? 0,
        createdAt,
        source: "onchain",
        status,
        message,
        txHash:
          (application.decisionTxHash ?? application.submittedTxHash ?? undefined) as
            | `0x${string}`
            | undefined
      };
    });
  }, [query.data?.applications, rulesBySchoolId]);

  // 辅助记录来自后端托管的未上链阻断信息，只用于教学提示，不参与资格判断。
  const localBlockedRecords = useMemo<ApplicationHistoryRecord[]>(() => {
    return (query.data?.auxiliaryRecords ?? []).map((record: {
      id: string;
      schoolId: string;
      schoolName: string;
      versionId?: string | null;
      createdAt: string;
      message: string;
    }) => ({
      id: record.id,
      schoolId: record.schoolId as `0x${string}`,
      schoolName: record.schoolName,
      versionId: record.versionId ?? "unknown",
      versionNumber: null,
      cutoffScore: 0,
      createdAt: new Date(record.createdAt).getTime(),
      source: "auxiliary",
      status: "LOCAL_BLOCKED",
      message: record.message
    }));
  }, [query.data?.auxiliaryRecords]);

  const groupedVersions = useMemo(
    () => ({
      pku: rules.filter((rule: SchoolRuleVersion) => rule.familyKey === "pku"),
      jiatingdun: rules.filter((rule: SchoolRuleVersion) => rule.familyKey === "jiatingdun")
    }),
    [rules]
  );

  // 学生可申请学校的候选集只来自当前仍然 active 且 cutoffFrozen 的规则。
  const currentFrozenVersions = useMemo(
    () => ({
      pku:
        groupedVersions.pku.find(
          (rule: SchoolRuleVersion) => rule.active && rule.cutoffFrozen
        ) ?? null,
      jiatingdun:
        groupedVersions.jiatingdun.find(
          (rule: SchoolRuleVersion) => rule.active && rule.cutoffFrozen
        ) ?? null
    }),
    [groupedVersions]
  );

  return {
    ...query,
    latestActiveSource: query.data?.latestActiveSource ?? null,
    rules,
    rulesBySchoolId,
    groupedVersions,
    currentFrozenVersions,
    currentApplication,
    onchainRecords,
    localBlockedRecords,
    note: query.data?.note ?? "",
    syncStatus: query.data?.syncStatus ?? { stale: false, partialErrors: [] }
  };
}
