import type { Address } from "@/types/contract-config";

export type RoleStatus = {
  isIssuer: boolean;
  isBuyer: boolean;
  isSeller: boolean;
};

export type EligibilityStatus = {
  verifiedRootVersion: number;
  verifiedAt: number;
  active: boolean;
  isCurrent: boolean;
};

export type AgeCredentialSet = {
  setId: `0x${string}`;
  merkleRoot: bigint;
  version: number;
  referenceDate: number;
  issuer: Address;
  updatedAt: number;
  active: boolean;
  sourceTitle?: string;
  setIdLabel?: string;
};

export type MarketplaceProduct = {
  productId: `0x${string}`;
  productIdLabel: string;
  priceWei: bigint;
  stock: number;
  active: boolean;
  metadataURI: string;
  displayName: string;
  displayPrice: string;
  imageSrc: string;
  imageAlt: string;
  category: string;
  description: string;
};

export type MarketplaceOrder = {
  orderId: `0x${string}`;
  productId: `0x${string}`;
  buyer: Address;
  seller: Address;
  quantity: number;
  totalPriceWei: bigint;
  purchasedAt: number;
  txHash?: `0x${string}`;
};

export type LocalAgeCredential = {
  credentialId: string;
  setId: string;
  setIdBytes32: `0x${string}`;
  issuer: string;
  issuedAt: number;
  boundBuyerAddress: Address;
  walletBinding: string;
  birthDateMasked?: string;
  eligibleFromYmd: number;
  identityHash: string;
  secretSalt: string;
  merkleRoot: string;
  pathElements: string[];
  pathIndices: number[];
  versionNumber: number;
  proofInputRef?: string;
  sourceTitle?: string;
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
  address: Address;
  nonce: string;
  ciphertext: string;
  issuedAt: number;
  credentialVersion: number;
  setIdBytes32: `0x${string}`;
};

export type SampleProductRecord = {
  productIdLabel: string;
  productIdBytes32: `0x${string}`;
  name: string;
  category: string;
  description: string;
  imageSrc: string;
  metadataURI: string;
  priceWei: string;
  stock: number;
  active: boolean;
};

export type SampleCredentialSetRecord = {
  setIdLabel: string;
  setIdBytes32: `0x${string}`;
  sourceTitle: string;
  version: number;
  referenceDate: number;
  sampleVerificationDateYmd: number;
  merkleRoot: string;
  merkleRootHex: `0x${string}`;
  buyerAddresses: Address[];
};

export type IssuerUploadRecord = {
  walletAddress: Address;
  birthDate: string;
};

export type IssuerUploadInvalidRow = {
  row: number;
  walletAddress: string;
  birthDate: string;
  reason: string;
};

export type IssuerCredentialSetSummary = {
  setId: `0x${string}`;
  sourceTitle: string;
  version: number;
  referenceDate: number;
  merkleRoot: string;
  memberCount: number;
  adultCountNow: number;
  minorCountNow: number;
  updatedAt: number;
  buyerAddresses: Address[];
};

export type IssuerPendingSetSummary = IssuerCredentialSetSummary & {
  invalidRows: IssuerUploadInvalidRow[];
  newBuyerCount: number;
  newBuyerAddresses: Address[];
  baseVersion: number;
};

export type IssuerBuyerStatus = {
  address: Address;
  inActiveSet: boolean;
  hasClaimableCredential: boolean;
  isBuyer: boolean;
  currentlyEligible: boolean;
  eligibleFromYmd: number | null;
  eligibility: EligibilityStatus | null;
};

export type IssuerSetSnapshot = {
  activeSummary: IssuerCredentialSetSummary | null;
  pendingSummary: IssuerPendingSetSummary | null;
};

export type FailureHistoryEntry = {
  id: string;
  kind: "verify" | "purchase";
  title: string;
  message: string;
  timestamp: number;
  txHash?: `0x${string}`;
  productId?: string;
  quantity?: number;
};

export type PendingActionKind = "verify" | "purchase" | "publish" | "withdraw";

export type PendingActionEntry = {
  kind: PendingActionKind;
  txHash: `0x${string}`;
  startedAt: number;
  ownerAddress?: Address;
  stage?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};
