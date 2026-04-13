import type { Address } from "@/types/contract-config";

export type OnchainApplicationStatus = "PENDING" | "REJECTED" | "APPROVED";

// 链上申请事件在前端中的聚合结构：提交记录是基础，再叠加大学的审批结果。
export type OnchainApplicationRecord = {
  schoolId: `0x${string}`;
  applicant: Address;
  nullifierHash: bigint;
  submittedAt: number;
  submittedTxHash?: `0x${string}`;
  submittedBlockNumber?: bigint;
  status: OnchainApplicationStatus;
  decidedAt?: number;
  decisionTxHash?: `0x${string}`;
  decisionBlockNumber?: bigint;
};

// 当前钱包地址在链上的全局录取状态。
export type OnchainAdmissionRecord = {
  student: Address;
  schoolId: `0x${string}`;
  admitted: boolean;
  admittedAt: number | null;
};

// 学生端顶部状态卡使用的最小展示结构。
export type StudentApplicationSummary = {
  schoolId: `0x${string}`;
  schoolName: string;
  versionId: string;
  versionNumber: number | null;
  status: OnchainApplicationStatus;
  submittedAt: number;
  decidedAt?: number;
  submittedTxHash?: `0x${string}`;
  decisionTxHash?: `0x${string}`;
};

// 后端托管的辅助记录，用来保留“未达到录取线”等未上链申请。
export type AuxiliaryFailureHistoryItem = {
  schoolId: `0x${string}`;
  schoolName: string;
  walletAddress: Address;
  score: number;
  cutoffScore: number;
  createdAt: number;
  message: string;
  versionId?: string;
};

export type LocalFailureHistoryItem = AuxiliaryFailureHistoryItem;

export type ApplicationHistoryStatus = "LOCAL_BLOCKED" | OnchainApplicationStatus;

// 学生工作台最终消费的统一申请记录结构。
export type ApplicationHistoryRecord = {
  id: string;
  schoolId: `0x${string}`;
  schoolName: string;
  versionId: string;
  versionNumber: number | null;
  cutoffScore: number;
  createdAt: number;
  source: "auxiliary" | "onchain";
  status: ApplicationHistoryStatus;
  message: string;
  txHash?: `0x${string}`;
};

export type UniversityApplicationStatus = OnchainApplicationStatus;

// 大学端审批列表使用的记录结构，只保留钱包、时间、规则信息和状态。
export type UniversityApplicationRecord = {
  id: string;
  schoolId: `0x${string}`;
  schoolName: string;
  versionId: string;
  versionNumber: number | null;
  applicant: Address;
  submittedAt: number;
  updatedAt: number;
  status: UniversityApplicationStatus;
  submittedTxHash?: `0x${string}`;
  latestTxHash?: `0x${string}`;
};

// 考试院页面里的“链上发布记录”视图。
// 这里直接来自成绩源发布事件，不再复用本地缓存字段。
export type AuthorityPublishHistoryItem = {
  scoreSourceId: `0x${string}`;
  scoreSourceIdLabel: string;
  sourceTitle: string;
  issuer: Address;
  issuedAt: number;
  txHash?: `0x${string}`;
  blockNumber?: bigint;
};

// 考试院发放成绩凭证后的本地记录。
export type AuthorityIssuanceRecord = {
  id: string;
  scoreSourceIdLabel: string;
  candidateLabel: string;
  score: number;
  fileName: string;
  createdAt: number;
};
