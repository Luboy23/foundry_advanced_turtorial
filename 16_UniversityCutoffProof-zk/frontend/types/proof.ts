import type { Address } from "@/types/contract-config";

// 主线程与 Worker 之间约定的消息类型。
export type WorkerMessageType =
  | "LOAD_ARTIFACTS"
  | "START_PROVE"
  | "ARTIFACTS_READY"
  | "PROVE_PROGRESS"
  | "PROVE_SUCCESS"
  | "PROVE_ERROR";

// 申请凭证生成与提交过程的统一状态机。
export type ProofStatus =
  | "idle"
  | "loading-artifacts"
  | "artifacts-ready"
  | "generating-proof"
  | "proof-ready"
  | "submit-pending"
  | "submit-success"
  | "error";

// 合约 submitApplication 需要的 Groth16 calldata 结构。
export type ContractGroth16Proof = {
  a: readonly [bigint, bigint];
  b: readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
  c: readonly [bigint, bigint];
  publicSignals: readonly [bigint, bigint, bigint, bigint, bigint, bigint];
};

// Worker 消息边界只传字符串，避免开发环境把 bigint 做 JSON 序列化时报错。
export type SerializedContractGroth16Proof = {
  a: readonly [string, string];
  b: readonly [readonly [string, string], readonly [string, string]];
  c: readonly [string, string];
  publicSignals: readonly [string, string, string, string, string, string];
};

// 一次申请凭证生成完成后，前端后续提交申请所需的完整包。
export type ProofPackage = {
  calldata: ContractGroth16Proof;
  nullifierHash: bigint;
  recipient: Address;
  cutoffScore: number;
  scoreSourceIdBytes32: `0x${string}`;
  schoolIdBytes32: `0x${string}`;
  schoolName: string;
  merkleRoot: bigint;
  generatedAt: number;
};

export type SerializedProofPackage = {
  calldata: SerializedContractGroth16Proof;
  nullifierHash: string;
  recipient: Address;
  cutoffScore: number;
  scoreSourceIdBytes32: `0x${string}`;
  schoolIdBytes32: `0x${string}`;
  schoolName: string;
  merkleRoot: string;
  generatedAt: number;
};

// Worker 进度更新载荷。
export type ProofWorkerProgress = {
  progress: number;
  label: string;
};

// Worker 预热完成后，单独告诉主线程材料已经可用。
export type ProofWorkerArtifactsReady = {
  progress: number;
  label: string;
};

// Worker 成功返回的载荷。
export type ProofWorkerSuccess = {
  proofPackage: SerializedProofPackage;
};

// Worker 失败返回的载荷。
export type ProofWorkerError = {
  message: string;
};
