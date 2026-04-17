import type { Address } from "@/types/contract-config";

export type RoleStatus = {
  isGovernment: boolean;
  isApplicant: boolean;
  isAgency: boolean;
};

export type UnemploymentCredentialSet = {
  setId: `0x${string}`;
  merkleRoot: bigint;
  version: number;
  referenceDate: number;
  eligibleCount: number;
  issuer: Address;
  updatedAt: number;
  active: boolean;
  sourceTitle?: string;
  setIdLabel?: string;
};

export type BenefitProgram = {
  programId: `0x${string}`;
  programIdField: bigint;
  amountWei: bigint;
  active: boolean;
  updatedAt: number;
  totalClaims: number;
  totalDisbursedWei: bigint;
  poolBalanceWei: bigint;
};

export type LocalUnemploymentCredential = {
  version: 1;
  setId: string;
  setIdBytes32: `0x${string}`;
  sourceTitle?: string;
  versionNumber: number;
  referenceDate: number;
  boundApplicantAddress: Address;
  walletBinding: string;
  identityHash: string;
  secretSalt: string;
  leaf: string;
  merkleRoot: string;
  pathElements: string[];
  pathIndices: number[];
  issuedAt: number;
  applicantLabel?: string;
};

export type CredentialChallengeResponse = {
  message: string;
  expiresAt: number;
};

export type CredentialClaimRequest = {
  address: Address;
  message: string;
  signature: `0x${string}`;
};

export type EncryptedCredentialEnvelope = {
  version: 1;
  scope: string;
  address: Address;
  nonce: string;
  ciphertext: string;
  issuedAt: number;
  credentialVersion: number;
  setIdBytes32: `0x${string}`;
};

export type BenefitClaimRecord = {
  programId: `0x${string}`;
  recipient: Address;
  nullifierHash: `0x${string}`;
  amountWei: bigint;
  rootVersion: number;
  claimedAt: number;
  txHash?: `0x${string}`;
};

export type CredentialSetPublishRecord = {
  setId: `0x${string}`;
  version: number;
  merkleRoot: bigint;
  referenceDate: number;
  eligibleCount: number;
  issuer: Address;
  timestamp: number;
  txHash?: `0x${string}`;
};

export type FailureHistoryEntry = {
  id: string;
  kind: "credential" | "verify" | "government" | "agency";
  title: string;
  message: string;
  timestamp: number;
  txHash?: `0x${string}`;
};

export type SampleCredentialSetRecord = {
  setIdLabel: string;
  setIdBytes32: `0x${string}`;
  sourceTitle: string;
  version: number;
  referenceDate: number;
  merkleDepth: number;
  merkleRoot: string;
  merkleRootHex: `0x${string}`;
  eligibleCount: number;
};

export type SampleBenefitProgramRecord = {
  programIdLabel: string;
  programIdBytes32: `0x${string}`;
  programIdField: string;
  programTitle: string;
  benefitAmountWei: string;
  benefitAmountEth: string;
  demoNote: string;
};

export type EditableApplicantRecord = {
  applicantAddress: string;
  applicantLabel?: string;
};

export type CredentialSetDraftInput = {
  version: number;
  referenceDate: number;
  records: EditableApplicantRecord[];
};

export type ResolvedApplicantRecord = {
  applicantAddress: string;
  identityHash: string;
  secretSalt: string;
  applicantLabel?: string;
};

export type ResolvedCredentialSetDraftInput = {
  version: number;
  referenceDate: number;
  records: ResolvedApplicantRecord[];
};

export type GeneratedCredentialSetSnapshot = {
  version: number;
  createdAt: number;
  publishedAt?: number;
  publishedTxHash?: `0x${string}`;
  roleSyncTxHash?: `0x${string}`;
  input: ResolvedCredentialSetDraftInput;
  set: SampleCredentialSetRecord;
};

export type GovernmentActionChallenge = {
  message: string;
  expiresAt: number;
};

export type GovernmentSession = {
  token: string;
  expiresAt: number;
  address: Address;
};

export type SignedGovernmentRequest = {
  address: Address;
  message: string;
  signature: `0x${string}`;
};

export type GovernmentCredentialSetState = {
  currentChainSet: UnemploymentCredentialSet | null;
  currentPublishedSnapshot: GeneratedCredentialSetSnapshot | null;
  latestDraftSnapshot: GeneratedCredentialSetSnapshot | null;
  editorDraft: CredentialSetDraftInput;
  draftPendingApplicantAddresses: Address[];
};
