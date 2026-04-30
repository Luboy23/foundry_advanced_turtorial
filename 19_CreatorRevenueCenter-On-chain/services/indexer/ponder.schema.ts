import { onchainTable } from "ponder";

export const revenueBatches = onchainTable("revenue_batches", (p) => ({
  batchId: p.hex().primaryKey(),
  monthLabel: p.text().notNull(),
  tokenAddress: p.hex().notNull(),
  status: p.text().notNull(),
  merkleRoot: p.hex().notNull(),
  metadataHash: p.hex().notNull(),
  publishedAt: p.bigint().notNull(),
  updatedAt: p.bigint().notNull()
}));

export const claimRecords = onchainTable("claim_records", (p) => ({
  id: p.text().primaryKey(),
  batchId: p.hex().notNull(),
  monthLabel: p.text().notNull(),
  claimId: p.hex().notNull(),
  creator: p.hex().notNull(),
  tokenAddress: p.hex().notNull(),
  grossAmount: p.bigint().notNull(),
  grossAmountDisplay: p.text().notNull(),
  txHash: p.hex().notNull(),
  blockNumber: p.bigint().notNull(),
  blockTimestamp: p.bigint().notNull()
}));

export const splitPaymentRecords = onchainTable("split_payment_records", (p) => ({
  id: p.text().primaryKey(),
  batchId: p.hex().notNull(),
  monthLabel: p.text().notNull(),
  claimId: p.hex().notNull(),
  recipient: p.hex().notNull(),
  amount: p.bigint().notNull(),
  amountDisplay: p.text().notNull(),
  bps: p.integer().notNull(),
  isCreator: p.boolean().notNull(),
  txHash: p.hex().notNull(),
  blockNumber: p.bigint().notNull(),
  blockTimestamp: p.bigint().notNull()
}));

export const creatorMonthSummaries = onchainTable("creator_month_summaries", (p) => ({
  id: p.text().primaryKey(),
  batchId: p.hex().notNull(),
  monthLabel: p.text().notNull(),
  creator: p.hex().notNull(),
  totalGrossAmount: p.bigint().notNull(),
  totalGrossAmountDisplay: p.text().notNull(),
  creatorNetAmount: p.bigint().notNull(),
  creatorNetAmountDisplay: p.text().notNull(),
  claimCount: p.integer().notNull(),
  lastClaimTxHash: p.hex().notNull(),
  updatedAt: p.bigint().notNull()
}));

export const collaboratorReceiptSummaries = onchainTable("collaborator_receipt_summaries", (p) => ({
  recipient: p.hex().primaryKey(),
  totalReceivedAmount: p.bigint().notNull(),
  totalReceivedDisplay: p.text().notNull(),
  totalReceiptCount: p.integer().notNull(),
  latestBatchLabel: p.text(),
  updatedAt: p.bigint().notNull()
}));

export const batchPublishContexts = onchainTable("batch_publish_contexts", (p) => ({
  id: p.text().primaryKey(),
  batchId: p.hex().notNull(),
  claimId: p.hex().notNull(),
  monthLabel: p.text().notNull(),
  billId: p.text().notNull(),
  grossAmount: p.bigint().notNull(),
  grossAmountDisplay: p.text().notNull(),
  creator: p.hex().notNull(),
  txHash: p.hex().notNull(),
  blockNumber: p.bigint().notNull(),
  committedAt: p.bigint().notNull()
}));
