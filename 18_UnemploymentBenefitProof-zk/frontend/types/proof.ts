import type { Address } from "@/types/contract-config";
import type { BenefitProgram, LocalUnemploymentCredential, UnemploymentCredentialSet } from "@/types/domain";

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
  publicSignals: [bigint, bigint, bigint, bigint];
};

export type ProofPackage = {
  credential: LocalUnemploymentCredential;
  credentialSet: UnemploymentCredentialSet;
  program: BenefitProgram;
  recipientAddress: Address;
  calldata: ProofCalldata;
  generatedAt: number;
};

export type ProofWorkerProgress = {
  progress: number;
  label: string;
};
