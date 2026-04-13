import type { Address } from "@/types/contract-config";

// 链上成绩源在前端中的标准化读取结果。
export type ScoreSourceConfig = {
  scoreSourceId: `0x${string}`;
  sourceTitle: string;
  merkleRoot: bigint;
  maxScore: number;
  issuedAt: number;
  issuer: Address;
  active: boolean;
};

// 学校申请规则在前端中的原始链上映射。
export type SchoolConfig = {
  schoolId: `0x${string}`;
  universityKey: `0x${string}`;
  schoolName: string;
  scoreSourceId: `0x${string}`;
  cutoffScore: number;
  updatedAt: number;
  admin: Address;
  active: boolean;
  cutoffFrozen: boolean;
};

// 本地样例学校配置，用来在链上数据尚未准备好时做页面回退展示。
export type SampleSchool = {
  universityKey: string;
  universityKeyBytes32: `0x${string}`;
  schoolIdLabel: string;
  schoolIdBytes32: `0x${string}`;
  schoolIdField: string;
  schoolName: string;
  cutoffScore: number;
  active: boolean;
};

// 本地样例成绩源配置，用来支撑学生页与考试院页的默认演示链路。
export type SampleScoreSource = {
  scoreSourceIdLabel: string;
  scoreSourceIdBytes32: `0x${string}`;
  scoreSourceIdField: string;
  sourceTitle: string;
  maxScore: number;
  merkleDepth: number;
  merkleRoot: string;
  merkleRootHex: `0x${string}`;
};

export type SchoolFamilyKey = "pku" | "jiatingdun";

export type RuleLifecycleStatus = "draft" | "frozen" | "superseded";

// 考试院导入成绩时，前端先收敛到这组最小学生记录字段。
export type ScoreRecordInput = {
  candidateLabel: string;
  candidateIdHash: string;
  score: number;
  secretSalt: string;
  boundStudentAddress: Address;
};

// 考试院在浏览器内构建成绩树和批量签发凭证时使用的草稿结构。
export type ScoreSourceDraft = {
  scoreSourceIdLabel: string;
  sourceTitle: string;
  maxScore: number;
  merkleDepth: number;
  records: ScoreRecordInput[];
};

// 导入 JSON 模板的标准形状。
export type AuthorityImportPayload = {
  scoreSource: {
    scoreSourceIdLabel: string;
    sourceTitle: string;
    maxScore: number;
    merkleDepth?: number;
  };
  schools?: Array<{
    schoolIdLabel: string;
    schoolName: string;
    cutoffScore: number;
  }>;
  records: ScoreRecordInput[];
};

// 前端围绕 schoolId 派生出的可展示版本对象。
export type SchoolRuleVersion = {
  schoolId: `0x${string}`;
  universityKey: `0x${string}`;
  schoolIdLabel: string;
  familyKey: SchoolFamilyKey;
  schoolName: string;
  versionId: string;
  versionNumber: number;
  scoreSourceId: `0x${string}`;
  cutoffScore: number;
  updatedAt: number;
  admin: Address;
  active: boolean;
  cutoffFrozen: boolean;
  status: RuleLifecycleStatus;
};
