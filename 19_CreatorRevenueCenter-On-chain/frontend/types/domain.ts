import type { Address } from "@/types/contract-config";

export type FrontendRole = "guest" | "platform" | "creator" | "collaborator";
export type ReadModelSource = "server-data" | "server-data+chain" | "chain" | "indexer";

export type ReadModelMeta = {
  source: ReadModelSource;
  degraded: boolean;
  reason: string | null;
  syncedAt: string;
  deploymentId: string;
};

export type ReadModelPayload = {
  meta: ReadModelMeta;
};

export type PageInfo = {
  limit: number;
  cursor: string | null;
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
};

export type WorkspaceAccessState = {
  role: FrontendRole;
  expectedRole: Exclude<FrontendRole, "guest">;
  allowed: boolean;
  reason: string | null;
};

export type WorkflowStepState = "idle" | "blocked" | "ready" | "active" | "complete" | "warning";

export type SettlementBreakdownLine = {
  label: string;
  amount: string;
  amountDisplay: string;
  description: string;
};

export type SplitEntry = {
  role: "creator" | "collaborator";
  label: string;
  recipient: Address;
  bps: number;
  amount: string;
  amountDisplay: string;
};

export type CreatorSettlementBill = {
  monthLabel: string;
  batchId: string;
  batchIdHex: `0x${string}`;
  billId: string;
  claimIdHex: `0x${string}`;
  creatorAddress: Address;
  assetSymbol: string;
  grossAmount: string;
  creatorNetAmount: string;
  grossAmountDisplay: string;
  creatorNetAmountDisplay: string;
  status: "draft" | "claimable" | "claimed" | "paused" | "closed";
  breakdown: SettlementBreakdownLine[];
  splitRuleSnapshot: SplitEntry[];
};

export type CreatorClaimPackage = {
  batchIdHex: `0x${string}`;
  claimIdHex: `0x${string}`;
  creator: Address;
  grossAmount: string;
  recipients: Address[];
  bps: number[];
  merkleProof: `0x${string}`[];
};

export type RevenueBatchSummary = {
  batchId: string;
  batchIdHex: `0x${string}`;
  monthLabel: string;
  status: "unknown" | "draft" | "published" | "paused" | "closed";
  assetSymbol: string;
  grossAmount: string;
  grossAmountDisplay: string;
  creatorCount: number;
  collaboratorCount: number;
  activeCreator: Address;
  lastSyncedAt: string;
};

export type ClaimRecord = {
  batchIdHex: `0x${string}`;
  batchLabel: string;
  claimIdHex: `0x${string}`;
  creator: Address;
  grossAmount: string;
  grossAmountDisplay: string;
  txHash: `0x${string}`;
  blockNumber: string;
};

export type SplitPaymentRecord = {
  batchIdHex: `0x${string}`;
  claimIdHex: `0x${string}`;
  batchLabel?: string;
  recipient: Address;
  amount: string;
  amountDisplay: string;
  bps: number;
  isCreator: boolean;
  txHash: `0x${string}`;
  blockNumber: string;
};

export type CreatorHistorySummary = {
  totalClaimedDisplay: string;
  totalClaimCount: number;
  latestBatchLabel: string | null;
};

export type CollaboratorReceiptRecord = {
  batchIdHex: `0x${string}`;
  claimIdHex: `0x${string}`;
  batchLabel: string;
  recipient: Address;
  amount: string;
  amountDisplay: string;
  bps: number;
  txHash: `0x${string}`;
  blockNumber: string;
};

export type CollaboratorReceiptSummary = {
  currentExpectedAmount: string;
  currentExpectedAmountDisplay: string;
  totalReceivedAmount: string;
  totalReceivedDisplay: string;
  totalReceiptCount: number;
  latestBatchLabel: string | null;
};

export type CreatorSettlementBillResponse = CreatorSettlementBill & ReadModelPayload;
export type CreatorClaimPackageResponse = CreatorClaimPackage & { billId: string } & ReadModelPayload;
export type RevenueBatchSummaryResponse = RevenueBatchSummary & ReadModelPayload;
export type CreatorHistoryResponse = {
  records: ClaimRecord[];
  summary: CreatorHistorySummary;
  pageInfo: PageInfo;
} & ReadModelPayload;
export type CreatorLedgerResponse = {
  claimRecords: ClaimRecord[];
  splitRecords: SplitPaymentRecord[];
  summary: CreatorHistorySummary;
  totals: {
    claimRecordCount: number;
    splitRecordCount: number;
  };
  pageInfo: PageInfo;
} & ReadModelPayload;
export type CollaboratorReceiptsResponse = {
  records: CollaboratorReceiptRecord[];
  summary: CollaboratorReceiptSummary;
  pageInfo: PageInfo;
} & ReadModelPayload;

export type PlatformMonthlyConfig = {
  monthLabel: string;
  grossAmount: string;
  grossAmountDisplay: string;
  creatorNetAmount: string;
  creatorNetAmountDisplay: string;
  isActive: boolean;
  updatedAt: string;
  isLocked: boolean;
  lockedAt: string | null;
};

export type PlatformMonthlyConfigsResponse = {
  configs: PlatformMonthlyConfig[];
  activeMonth: string | null;
  minAllowedMonth: string;
} & ReadModelPayload;

export type PlatformActivationPreviewResponse = {
  batchIdHex: `0x${string}`;
  claimIdHex: `0x${string}`;
  monthLabel: string;
  billId: string;
  grossAmount: string;
  grossAmountDisplay: string;
  creator: Address;
  merkleRoot: `0x${string}`;
  metadataHash: `0x${string}`;
  grossAmountWei: string;
  minAllowedMonth: string;
};

export type BatchPublishContext = {
  batchIdHex: `0x${string}`;
  claimIdHex: `0x${string}`;
  monthLabel: string;
  billId: string;
  grossAmount: string;
  grossAmountDisplay: string;
  creator: Address;
  txHash: `0x${string}`;
  blockNumber: string;
  committedAt: string;
};

export type PlatformActivityResponse = {
  latestPublishContext: BatchPublishContext | null;
} & ReadModelPayload;

export type PlatformHistoryParticipant = {
  role: "creator" | "collaborator";
  label: string;
  recipient: Address;
  amount: string;
  amountDisplay: string;
  status: CreatorSettlementBill["status"];
};

export type PlatformHistoryMonthRecord = {
  monthLabel: string;
  batchIdHex: `0x${string}`;
  claimIdHex: `0x${string}`;
  grossAmount: string;
  grossAmountDisplay: string;
  status: CreatorSettlementBill["status"];
  participants: PlatformHistoryParticipant[];
};

export type PlatformHistoryResponse = {
  records: PlatformHistoryMonthRecord[];
  pageInfo: PageInfo;
} & ReadModelPayload;
