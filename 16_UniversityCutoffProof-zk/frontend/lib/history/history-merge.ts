import type {
  ApplicationHistoryRecord,
  LocalFailureHistoryItem,
  OnchainApplicationRecord
} from "@/types/history";
import type { SchoolRuleVersion } from "@/types/admission";

function toLatestTimestamp(application: OnchainApplicationRecord) {
  if (application.status === "APPROVED" || application.status === "REJECTED") {
    return application.decidedAt ?? application.submittedAt;
  }
  return application.submittedAt;
}

function toHistoryStatus(application: OnchainApplicationRecord) {
  return application.status;
}

function toHistoryMessage(schoolName: string, application: OnchainApplicationRecord) {
  const status = toHistoryStatus(application);
  if (status === "APPROVED") {
    return `${schoolName} 已批准你的申请，你已被录取。`;
  }
  if (status === "REJECTED") {
    return `${schoolName} 已拒绝你的申请，当前账户申请资格已永久锁定。`;
  }
  return `已向 ${schoolName} 提交申请，等待大学审批。`;
}

// 把链上申请记录和后端托管的辅助记录合并成学生工作台的一条统一时间线。
export function mergeApplicationHistory(args: {
  applications: OnchainApplicationRecord[];
  localFailures: LocalFailureHistoryItem[];
  versionsBySchoolId: Map<string, SchoolRuleVersion>;
}) {
  const { applications, localFailures, versionsBySchoolId } = args;

  const onchainRecords: ApplicationHistoryRecord[] = applications.map((item) => {
    const version = versionsBySchoolId.get(item.schoolId.toLowerCase());
    const schoolName = version?.schoolName ?? item.schoolId;

    return {
      id: `${item.schoolId}-${item.applicant}-${item.submittedTxHash}`,
      schoolId: item.schoolId,
      schoolName,
      versionId: version?.versionId ?? "unknown",
      versionNumber: version?.versionNumber ?? null,
      cutoffScore: version?.cutoffScore ?? 0,
      createdAt: toLatestTimestamp(item),
      source: "onchain",
      status: toHistoryStatus(item),
      message: toHistoryMessage(schoolName, item),
      txHash: item.decisionTxHash ?? item.submittedTxHash
    };
  });

  const failureRecords: ApplicationHistoryRecord[] = localFailures.map((item, index) => {
    const version = versionsBySchoolId.get(item.schoolId.toLowerCase());
    return {
      id: `${item.schoolId}-${item.createdAt}-${index}`,
      schoolId: item.schoolId,
      schoolName: item.schoolName,
      versionId: item.versionId ?? version?.versionId ?? "unknown",
      versionNumber: version?.versionNumber ?? null,
      cutoffScore: item.cutoffScore,
      createdAt: item.createdAt,
      source: "auxiliary",
      status: "LOCAL_BLOCKED",
      message: item.message
    };
  });

  return [...onchainRecords, ...failureRecords].sort((left, right) => right.createdAt - left.createdAt);
}
