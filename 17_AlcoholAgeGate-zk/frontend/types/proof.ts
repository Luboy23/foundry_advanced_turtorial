import type { AgeCredentialSet, LocalAgeCredential } from "@/types/domain";
import type { Address } from "@/types/contract-config";

export type ProofStatus =
  | "idle"
  | "loading-artifacts"
  | "generating-proof"
  | "proof-ready"
  | "submitting"
  | "confirming"
  | "success"
  | "error";

export type ProofCalldata = {
  a: [bigint, bigint];
  b: [[bigint, bigint], [bigint, bigint]];
  c: [bigint, bigint];
  publicSignals: bigint[];
};

export type ProofPackage = {
  setId: `0x${string}`;
  credential: LocalAgeCredential;
  credentialSet: AgeCredentialSet;
  recipientAddress: Address;
  verificationDateYmd: number;
  calldata: ProofCalldata;
  generatedAt: number;
};

export type ProofWorkerProgress = {
  progress: number;
  label: string;
};
