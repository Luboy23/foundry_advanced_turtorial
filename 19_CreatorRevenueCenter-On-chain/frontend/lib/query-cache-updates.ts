"use client";

import type { QueryClient } from "@tanstack/react-query";
import { scopedQueryKey } from "@/lib/query-keys";
import type { Address, RuntimeConfig } from "@/types/contract-config";
import type {
  ClaimRecord,
  CollaboratorReceiptRecord,
  CollaboratorReceiptsResponse,
  CreatorHistoryResponse,
  CreatorLedgerResponse,
  CreatorSettlementBill,
  CreatorSettlementBillResponse,
  RevenueBatchSummary,
  RevenueBatchSummaryResponse,
  SplitPaymentRecord
} from "@/types/domain";

/**
 * 这份文件负责“交易刚确认时，如何先把用户眼前的读模型修正到接近最终状态”。
 * 它不替代后续 refetch，但可以减少 claim / 批次操作完成后的闪烁和等待感。
 */
/**
 * 乐观插入的新记录应该总是顶到列表最前面，
 * 因此这里统一按 blockNumber 倒序重排，保证 history / ledger / receipts 的视觉顺序一致。
 */
function sortByBlockNumberDesc<T extends { blockNumber: string }>(records: T[]) {
  return [...records].sort((left, right) => Number(BigInt(right.blockNumber) - BigInt(left.blockNumber)));
}

/**
 * optimistic update 和后续真实回刷有机会在短时间内写入同一条 claim。
 * 这里用 claimId + txHash 去重，避免列表里出现重复的领取主记录。
 */
function dedupeClaimRecords(records: ClaimRecord[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record.claimIdHex}:${record.txHash}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * SplitPaid 明细需要按“同一 claim、同一收款人、同一交易”去重，
 * 否则乐观插入和真实回刷叠在一起时会把到账流水重复展示。
 */
function dedupeSplitRecords(records: SplitPaymentRecord[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record.claimIdHex}:${record.recipient}:${record.txHash}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * 协作者到账页和 creator ledger 一样，也会经历“先乐观插入、后真实回刷”的双阶段。
 * 这个去重函数保证协作者不会看到重复到账记录。
 */
function dedupeCollaboratorRecords(records: CollaboratorReceiptRecord[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record.claimIdHex}:${record.recipient}:${record.txHash}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * 所有乐观更新都会顺手刷新 syncedAt，
 * 让页面知道这份数据刚刚被本地修补过，避免误以为还是旧快照。
 */
function touchMeta<Payload extends { meta: { syncedAt: string } }>(payload: Payload): Payload {
  return {
    ...payload,
    meta: {
      ...payload.meta,
      syncedAt: new Date().toISOString()
    }
  };
}

/**
 * 批次状态变化后，账单状态也必须跟着重算。
 * 这层映射确保平台页、首页和 creator 页对 claimable / paused / closed 的理解保持一致。
 */
function deriveBillStatusFromBatchStatus(
  currentStatus: CreatorSettlementBill["status"],
  batchStatus: RevenueBatchSummary["status"]
): CreatorSettlementBill["status"] {
  if (batchStatus === "published") {
    return currentStatus === "claimed" ? "claimed" : "claimable";
  }

  if (batchStatus === "paused") {
    return "paused";
  }

  if (batchStatus === "closed") {
    return "closed";
  }

  return "draft";
}

/**
 * 当前账单会被首页、creator 页和 claim 对话流同时消费，
 * 因此一次写入要同步打到这三组 query key，避免局部页面先更新、其余页面仍停留旧状态。
 */
export function setCurrentBillQueries(
  queryClient: QueryClient,
  config: Pick<RuntimeConfig, "chainId" | "deploymentId">,
  bill: CreatorSettlementBillResponse
) {
  queryClient.setQueryData(scopedQueryKey(config, "home-current-bill"), bill);
  queryClient.setQueryData(scopedQueryKey(config, "creator-current-bill"), bill);
  queryClient.setQueryData(scopedQueryKey(config, "claim-current-bill"), bill);
}

/**
 * 当前批次也存在首页卡片和平台工作台两份消费入口，
 * 这里统一扇出写入，保证批次状态切换后的 UI 观感一致。
 */
export function setCurrentBatchQueries(
  queryClient: QueryClient,
  config: Pick<RuntimeConfig, "chainId" | "deploymentId">,
  batch: RevenueBatchSummaryResponse
) {
  queryClient.setQueryData(scopedQueryKey(config, "home-current-batch"), batch);
  queryClient.setQueryData(scopedQueryKey(config, "platform-current-batch"), batch);
}

/**
 * creator history 既有默认查询 key，也有分页查询 key。
 * 统一封装 setter 可以避免上层在多个 key 间重复写同一份 payload。
 */
export function setCreatorHistoryQueries(
  queryClient: QueryClient,
  config: Pick<RuntimeConfig, "chainId" | "deploymentId">,
  creator: Address,
  payload: CreatorHistoryResponse
) {
  queryClient.setQueryData(scopedQueryKey(config, "creator-history", creator), payload);
  queryClient.setQueryData(scopedQueryKey(config, "creator-history-page", creator), payload);
}

/**
 * creator ledger 合并了 claim 主记录和 split 流水，是 claim 成功后最容易感知“新增一条记录”的页面。
 */
export function setCreatorLedgerQuery(
  queryClient: QueryClient,
  config: Pick<RuntimeConfig, "chainId" | "deploymentId">,
  creator: Address,
  payload: CreatorLedgerResponse
) {
  queryClient.setQueryData(scopedQueryKey(config, "creator-ledger", creator), payload);
}

/**
 * 协作者到账页按 recipient 维度缓存，因此这里把“单个协作者的一份到账视图”封成独立 setter。
 */
export function setCollaboratorReceiptsQuery(
  queryClient: QueryClient,
  config: Pick<RuntimeConfig, "chainId" | "deploymentId">,
  recipient: Address,
  payload: CollaboratorReceiptsResponse
) {
  queryClient.setQueryData(scopedQueryKey(config, "collaborator-receipts", recipient), payload);
}

/**
 * claim 成功后的乐观更新遵循“先当前账单、再创作者记录、最后协作者记录”的顺序：
 * - 当前创作者会立即看到账单变成 claimed；
 * - creator history / ledger 会马上出现新领取记录；
 * - 同一笔分账涉及的协作者到账列表和统计也会同步抬升。
 * 这样用户在等待真实 refetch 期间，页面已经足够接近最终状态。
 */
export function applyOptimisticClaimUpdates(
  queryClient: QueryClient,
  args: {
    config: Pick<RuntimeConfig, "chainId" | "deploymentId">;
    creator: Address;
    bill: CreatorSettlementBillResponse;
    txHash: `0x${string}`;
    blockNumber: bigint;
  }
) {
  const { config, creator, bill, txHash, blockNumber } = args;

  // 用户刚领取成功时，最先感知到的应该是“当前账单已领取”，
  // 然后再把这次 claim 对 history / ledger / collaborator receipts 的影响补齐。
  const nextBill: CreatorSettlementBillResponse = touchMeta({ ...bill, status: "claimed" });
  setCurrentBillQueries(queryClient, config, nextBill);

  const claimRecord: ClaimRecord = {
    batchIdHex: bill.batchIdHex,
    batchLabel: bill.monthLabel,
    claimIdHex: bill.claimIdHex,
    creator: bill.creatorAddress,
    grossAmount: bill.grossAmount,
    grossAmountDisplay: bill.grossAmountDisplay,
    txHash,
    blockNumber: blockNumber.toString()
  };

  const creatorSplit = bill.splitRuleSnapshot.find((entry) => entry.role === "creator");
  if (creatorSplit) {
    const splitRecord: SplitPaymentRecord = {
      batchIdHex: bill.batchIdHex,
      claimIdHex: bill.claimIdHex,
      batchLabel: bill.monthLabel,
      recipient: creatorSplit.recipient,
      amount: creatorSplit.amount,
      amountDisplay: creatorSplit.amountDisplay,
      bps: creatorSplit.bps,
      isCreator: true,
      txHash,
      blockNumber: blockNumber.toString()
    };

    const existingLedger = queryClient.getQueryData<CreatorLedgerResponse>(scopedQueryKey(config, "creator-ledger", creator));
    if (existingLedger) {
      const nextClaimRecords = sortByBlockNumberDesc(dedupeClaimRecords([claimRecord, ...existingLedger.claimRecords]));
      const nextSplitRecords = sortByBlockNumberDesc(dedupeSplitRecords([splitRecord, ...existingLedger.splitRecords]));

      setCreatorLedgerQuery(queryClient, config, creator, {
        ...existingLedger,
        claimRecords: nextClaimRecords,
        splitRecords: nextSplitRecords,
        totals: {
          claimRecordCount: Math.max(existingLedger.totals.claimRecordCount + 1, nextClaimRecords.length),
          splitRecordCount: Math.max(existingLedger.totals.splitRecordCount + 1, nextSplitRecords.length)
        },
        pageInfo: {
          ...existingLedger.pageInfo,
          totalCount: Math.max(existingLedger.pageInfo.totalCount + 1, nextClaimRecords.length, nextSplitRecords.length)
        },
        summary: {
          ...existingLedger.summary,
          totalClaimCount: existingLedger.summary.totalClaimCount + 1,
          latestBatchLabel: bill.monthLabel
        },
        meta: {
          ...existingLedger.meta,
          syncedAt: new Date().toISOString()
        }
      });
    }
  }

  const historyKeys = [
    scopedQueryKey(config, "creator-history", creator),
    scopedQueryKey(config, "creator-history-page", creator)
  ] as const;

  for (const key of historyKeys) {
    const existing = queryClient.getQueryData<CreatorHistoryResponse>(key);
    if (!existing) continue;
    const nextRecords = sortByBlockNumberDesc(dedupeClaimRecords([claimRecord, ...existing.records]));
    queryClient.setQueryData(
      key,
      {
        ...existing,
        records: nextRecords,
        summary: {
          ...existing.summary,
          totalClaimCount: existing.summary.totalClaimCount + 1,
          latestBatchLabel: bill.monthLabel
        },
        pageInfo: {
          ...existing.pageInfo,
          totalCount: Math.max(existing.pageInfo.totalCount + 1, nextRecords.length)
        },
        meta: {
          ...existing.meta,
          syncedAt: new Date().toISOString()
        }
      } satisfies CreatorHistoryResponse
    );
  }

  // 协作者页虽然是独立角色页面，但同一笔 claim 成功后，
  // 它的到账记录与顶部累计统计也应该同步被乐观修正。
  for (const entry of bill.splitRuleSnapshot) {
    if (entry.role !== "collaborator") continue;

    const existingReceipts = queryClient.getQueryData<CollaboratorReceiptsResponse>(
      scopedQueryKey(config, "collaborator-receipts", entry.recipient)
    );
    if (!existingReceipts) continue;

    const nextRecord: CollaboratorReceiptRecord = {
      batchIdHex: bill.batchIdHex,
      claimIdHex: bill.claimIdHex,
      batchLabel: bill.monthLabel,
      recipient: entry.recipient,
      amount: entry.amount,
      amountDisplay: entry.amountDisplay,
      bps: entry.bps,
      txHash,
      blockNumber: blockNumber.toString()
    };
    const nextRecords = sortByBlockNumberDesc(dedupeCollaboratorRecords([nextRecord, ...existingReceipts.records]));

    setCollaboratorReceiptsQuery(queryClient, config, entry.recipient, {
      ...existingReceipts,
      records: nextRecords,
      summary: {
        ...existingReceipts.summary,
        totalReceiptCount: existingReceipts.summary.totalReceiptCount + 1,
        latestBatchLabel: bill.monthLabel
      },
      pageInfo: {
        ...existingReceipts.pageInfo,
        totalCount: Math.max(existingReceipts.pageInfo.totalCount + 1, nextRecords.length)
      },
      meta: {
        ...existingReceipts.meta,
        syncedAt: new Date().toISOString()
      }
    });
  }
}

/**
 * 平台 publish / pause / close 成功后，最先变化的是“当前批次状态”，
 * 但账单状态本质上是它的派生物，所以这里会连首页、平台页和账单查询一起更新。
 */
export function applyOptimisticBatchStatusUpdate(
  queryClient: QueryClient,
  config: Pick<RuntimeConfig, "chainId" | "deploymentId">,
  nextStatus: RevenueBatchSummaryResponse["status"]
) {
  const timestamp = new Date().toISOString();

  // 批次状态变更不只影响平台页，也会联动首页和创作者账单状态，
  // 因为 claimable / paused / closed 本质上是批次状态在账单上的投影。
  const currentBatchKeys = [
    scopedQueryKey(config, "home-current-batch"),
    scopedQueryKey(config, "platform-current-batch")
  ] as const;

  for (const key of currentBatchKeys) {
    const existingBatch = queryClient.getQueryData<RevenueBatchSummaryResponse>(key);
    if (!existingBatch) continue;
    queryClient.setQueryData(
      key,
      {
        ...existingBatch,
        status: nextStatus,
        lastSyncedAt: timestamp,
        meta: {
          ...existingBatch.meta,
          syncedAt: timestamp
        }
      } satisfies RevenueBatchSummaryResponse
    );
  }

  const currentBillKeys = [
    scopedQueryKey(config, "home-current-bill"),
    scopedQueryKey(config, "creator-current-bill"),
    scopedQueryKey(config, "claim-current-bill")
  ] as const;

  for (const key of currentBillKeys) {
    const existingBill = queryClient.getQueryData<CreatorSettlementBillResponse>(key);
    if (!existingBill) continue;
    queryClient.setQueryData(
      key,
      {
        ...existingBill,
        status: deriveBillStatusFromBatchStatus(existingBill.status, nextStatus),
        meta: {
          ...existingBill.meta,
          syncedAt: timestamp
        }
      } satisfies CreatorSettlementBillResponse
    );
  }
}
