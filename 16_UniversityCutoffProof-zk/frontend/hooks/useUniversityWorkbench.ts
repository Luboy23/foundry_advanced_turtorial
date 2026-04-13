"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getUniversityWorkbench } from "@/lib/api/university";
import { getCurrentFrozenVersion, getNextVersionNumber } from "@/lib/admission/rule-version";
import type { SchoolRuleVersion } from "@/types/admission";
import type { UniversityApplicationRecord } from "@/types/history";

// 大学 workbench hook。
// 所有页面上的规则、审批和摘要都先经由这里转换，再交给组件消费，避免组件层直接依赖后端 DTO 细节。
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
}) {
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
  } satisfies SchoolRuleVersion;
}

function toApplication(dto: {
  schoolId: string;
  schoolName: string;
  familyKey: string;
  applicant: string;
  status: string;
  submittedAt: string;
  decidedAt?: string | null;
  submittedTxHash?: string | null;
  decisionTxHash?: string | null;
}, rules: SchoolRuleVersion[]): UniversityApplicationRecord {
  const version = rules.find((item) => item.schoolId.toLowerCase() === dto.schoolId.toLowerCase());
  const submittedAt = new Date(dto.submittedAt).getTime();
  const decidedAt = dto.decidedAt ? new Date(dto.decidedAt).getTime() : null;

  return {
    id: `${dto.schoolId}-${dto.applicant}`,
    schoolId: dto.schoolId as `0x${string}`,
    schoolName: dto.schoolName,
    versionId: version?.versionId ?? "unknown",
    versionNumber: version?.versionNumber ?? null,
    applicant: dto.applicant as `0x${string}`,
    submittedAt,
    updatedAt: decidedAt ?? submittedAt,
    status: dto.status as "PENDING" | "APPROVED" | "REJECTED",
    submittedTxHash: (dto.submittedTxHash ?? undefined) as `0x${string}` | undefined,
    latestTxHash: ((dto.decisionTxHash ?? dto.submittedTxHash) ?? undefined) as `0x${string}` | undefined
  };
}

export function useUniversityWorkbench(args: {
  familyKey: "pku" | "jiatingdun";
  enabled?: boolean;
}) {
  const { familyKey, enabled = true } = args;
  const query = useQuery({
    queryKey: ["university-workbench", familyKey],
    enabled,
    queryFn: () => getUniversityWorkbench(familyKey)
  });

  // 规则列表保留链上 active / cutoffFrozen 真相，并额外补出当前页面需要的 status。
  const rules = useMemo(
    () => (query.data?.rules ?? []).map(toRule),
    [query.data?.rules]
  );
  // 审批列表把 submitted / decided 时间统一折成 updatedAt，方便大学页排序和卡片展示。
  const applications = useMemo(
    () =>
      (query.data?.applications ?? []).map((item: {
        schoolId: string;
        schoolName: string;
        familyKey: string;
        applicant: string;
        status: string;
        submittedAt: string;
        decidedAt?: string | null;
        submittedTxHash?: string | null;
        decisionTxHash?: string | null;
      }) => toApplication(item, rules)),
    [query.data?.applications, rules]
  );
  // 当前成绩源对应规则由后端显式返回，不再让前端自己在规则数组里猜哪一条属于当前成绩源。
  const currentSourceRule = useMemo(() => {
    const dto = query.data?.currentSourceRule;
    return dto ? toRule(dto) : null;
  }, [query.data?.currentSourceRule]);

  return {
    ...query,
    latestActiveSource: query.data?.latestActiveSource ?? null,
    summary: query.data?.summary ?? null,
    currentSourceRule,
    canCreateDraft: query.data?.canCreateDraft ?? false,
    createDraftGuardReason: query.data?.createDraftGuardReason ?? null,
    rules,
    applications,
    currentFrozenVersion: getCurrentFrozenVersion(rules),
    nextVersionNumber: getNextVersionNumber(rules),
    syncStatus: query.data?.syncStatus ?? { stale: false, partialErrors: [] }
  };
}
