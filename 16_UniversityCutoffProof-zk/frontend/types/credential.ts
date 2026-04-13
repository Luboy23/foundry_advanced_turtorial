// 学生成绩凭证的前端标准结构。
// 这份对象既要能被页面消费，也要能直接拿去构造 ZK fullProve 输入，因此字段比较完整。
export type AdmissionCredential = {
  version: number;
  scoreSourceId: string;
  scoreSourceIdBytes32: `0x${string}`;
  scoreSourceTitle: string;
  boundStudentAddress: `0x${string}`;
  boundStudentField: string;
  candidateLabel: string;
  candidateIdHash: string;
  score: number;
  maxScore: number;
  secretSalt: string;
  leaf: string;
  merkleRoot: string;
  pathElements: string[];
  pathIndices: number[];
  issuedAt: number;
};

// 统一封装成绩凭证解析结果，让调用方显式处理成功/失败分支。
export type CredentialParserResult =
  | { ok: true; credential: AdmissionCredential }
  | { ok: false; error: string };
