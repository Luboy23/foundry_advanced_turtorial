import { resolveBatchLabel } from "@/lib/batch-labels";
import { formatAssetAmount } from "@/lib/format";
import { readCurrentBillInput, buildCurrentBillView } from "@/lib/server/bills";
import { buildPageInfo } from "@/lib/server/pagination";
import {
  resolvePlatformHistoryParticipantMeta,
  sortPlatformHistoryParticipants,
  sortPlatformHistoryRecords
} from "@/lib/server/platform-history";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";
import type {
  BatchPublishContext,
  ClaimRecord,
  CollaboratorReceiptRecord,
  CollaboratorReceiptSummary,
  CreatorHistorySummary,
  PageInfo,
  PlatformHistoryMonthRecord,
  SplitPaymentRecord
} from "@/types/domain";

/**
 * 这一层是 19 项目的默认读路径：
 * - 链上负责产生真值；
 * - indexer 把真值整理成“记录 + 汇总 + 分页”的页面读模型；
 * - fresh=1 或 indexer 故障时，调用方再回退到 chain.ts。
 */
const INDEXER_TIMEOUT_MS = 2_500;
const INDEXER_QUERY_LIMIT_MAX = 1_000;
const SUMMARY_QUERY_LIMIT = 500;
const PLATFORM_HISTORY_CLAIM_QUERY_LIMIT = Math.floor(INDEXER_QUERY_LIMIT_MAX / 4);
const PLATFORM_HISTORY_SPLIT_QUERY_LIMIT = PLATFORM_HISTORY_CLAIM_QUERY_LIMIT * 4;

type PaginationInput = {
  limit: number;
  offset: number;
  cursor: string | null;
};

type GraphqlEnvelope<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

type GraphqlPage<T> = {
  items?: T[];
  totalCount?: number;
};

type ClaimRecordNode = {
  batchId?: string;
  monthLabel?: string;
  claimId?: string;
  creator?: string;
  grossAmount?: string | number | bigint;
  grossAmountDisplay?: string;
  txHash?: string;
  blockNumber?: string | number | bigint;
};

type SplitPaymentRecordNode = {
  batchId?: string;
  claimId?: string;
  recipient?: string;
  amount?: string | number | bigint;
  amountDisplay?: string;
  bps?: string | number;
  isCreator?: boolean;
  txHash?: string;
  blockNumber?: string | number | bigint;
};

type CreatorMonthSummaryNode = {
  monthLabel?: string;
  totalGrossAmount?: string | number | bigint;
  claimCount?: string | number;
  updatedAt?: string | number | bigint;
};

type CollaboratorReceiptSummaryNode = {
  totalReceivedAmount?: string | number | bigint;
  totalReceivedDisplay?: string;
  totalReceiptCount?: string | number;
  latestBatchLabel?: string | null;
};

type BatchPublishContextNode = {
  batchId?: string;
  claimId?: string;
  monthLabel?: string;
  billId?: string;
  grossAmount?: string | number | bigint;
  grossAmountDisplay?: string;
  creator?: string;
  txHash?: string;
  blockNumber?: string | number | bigint;
  committedAt?: string | number | bigint;
};

type ClaimRecordsPayload = {
  claimRecordss?: GraphqlPage<ClaimRecordNode>;
};

type SplitPaymentRecordsPayload = {
  splitPaymentRecordss?: GraphqlPage<SplitPaymentRecordNode>;
};

type CreatorMonthSummariesPayload = {
  creatorMonthSummariess?: GraphqlPage<CreatorMonthSummaryNode>;
};

type CollaboratorReceiptSummariesPayload = {
  collaboratorReceiptSummariess?: GraphqlPage<CollaboratorReceiptSummaryNode>;
};

type BatchPublishContextsPayload = {
  batchPublishContextss?: GraphqlPage<BatchPublishContextNode>;
};

/**
 * indexer / GraphQL / 链上返回的地址与哈希大小写可能不一致。
 * 统一压成 lower-hex 后，前端缓存 key、地址比较和分页结果才不会出现“同值不同形”的问题。
 */
function normalizeLowerHex(value: string) {
  return value.toLowerCase() as `0x${string}`;
}

/**
 * GraphQL 节点里的金额和区块号可能是 string / number / bigint 混合形态，
 * 这里统一收敛成字符串，保持 domain 层金额字段的单一表示。
 */
function normalizeBigIntString(value: string | number | bigint | undefined) {
  return value === undefined ? "0" : String(value);
}

/**
 * 对 count、bps 这类本就该是普通 number 的字段做容错收敛，
 * 避免 indexer 节点缺值或脏值时把页面直接带崩。
 */
function normalizeNumber(value: string | number | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * indexer GraphQL 返回的只是 totalCount，本项目前端统一消费 PageInfo，
 * 所以这里把 offset/limit 语义整理成页面组件直接可用的分页对象。
 */
function toPageInfo(
  pagination: PaginationInput,
  totalCount: number,
  returnedCount: number
): PageInfo {
  return buildPageInfo({
    limit: pagination.limit,
    offset: pagination.offset,
    returnedCount,
    totalCount
  });
}

/**
 * 当前实现采用“取前 N 条后在服务端切片”的简单策略，
 * 让 GraphQL 查询层维持稳定，而把页面分页细节留在 domain 适配层。
 */
function slicePage<T>(items: T[], pagination: PaginationInput) {
  return items.slice(pagination.offset, pagination.offset + pagination.limit);
}

/**
 * GraphQL 层只负责拿到原始读模型表数据；
 * 真正给前端消费的 domain shape 还要经过 normalize / map / pageInfo 适配，
 * 这样页面就不需要理解 Ponder 的节点字段或分页细节。
 */
async function fetchIndexerGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const config = readRuntimeConfigForScript();
  const endpoint = `${config.indexerBaseUrl.replace(/\/+$/, "")}/graphql`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(INDEXER_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`INDEXER_HTTP_${response.status}`);
  }

  const payload = (await response.json()) as GraphqlEnvelope<T>;
  if (payload.errors?.length) {
    throw new Error(`INDEXER_GRAPHQL_ERROR: ${payload.errors[0]?.message ?? "unknown"}`);
  }

  if (!payload.data) {
    throw new Error("INDEXER_EMPTY_DATA");
  }

  return payload.data;
}

/**
 * 把 claim_records 表节点翻译成前端真正消费的 ClaimRecord。
 * 这里除了类型收敛，还会补 monthLabel / amountDisplay 等页面友好字段。
 */
function mapClaimRecords(items: ClaimRecordNode[], creatorAddress: `0x${string}`): ClaimRecord[] {
  const config = readRuntimeConfigForScript();
  return items.map((item) => ({
    batchIdHex: normalizeLowerHex(item.batchId ?? "0x0"),
    batchLabel: item.monthLabel ?? resolveBatchLabel(item.batchId, config.batchLabelMap),
    claimIdHex: normalizeLowerHex(item.claimId ?? "0x0"),
    creator: normalizeLowerHex(item.creator ?? creatorAddress),
    grossAmount: normalizeBigIntString(item.grossAmount),
    grossAmountDisplay:
      typeof item.grossAmountDisplay === "string"
        ? item.grossAmountDisplay
        : formatAssetAmount(normalizeBigIntString(item.grossAmount), "detail"),
    txHash: normalizeLowerHex(item.txHash ?? "0x0"),
    blockNumber: normalizeBigIntString(item.blockNumber)
  }));
}

/**
 * SplitPaid 明细既会服务 creator ledger，也会服务 collaborator receipts。
 * 这个 mapper 负责把底层 split_payment_records 统一翻译成可复用的流水记录结构。
 */
function mapSplitPaymentRecords(items: SplitPaymentRecordNode[], fallbackRecipient: `0x${string}`): SplitPaymentRecord[] {
  const config = readRuntimeConfigForScript();
  return items.map((item) => ({
    batchIdHex: normalizeLowerHex(item.batchId ?? "0x0"),
    claimIdHex: normalizeLowerHex(item.claimId ?? "0x0"),
    batchLabel: resolveBatchLabel(item.batchId, config.batchLabelMap),
    recipient: normalizeLowerHex(item.recipient ?? fallbackRecipient),
    amount: normalizeBigIntString(item.amount),
    amountDisplay:
      typeof item.amountDisplay === "string"
        ? item.amountDisplay
        : formatAssetAmount(normalizeBigIntString(item.amount), "detail"),
    bps: normalizeNumber(item.bps),
    isCreator: Boolean(item.isCreator),
    txHash: normalizeLowerHex(item.txHash ?? "0x0"),
    blockNumber: normalizeBigIntString(item.blockNumber)
  }));
}

function toIsoDate(value: string | number | bigint | undefined) {
  if (value === undefined) return new Date(0).toISOString();
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber) || asNumber <= 0) return new Date(0).toISOString();
  return new Date(asNumber * 1_000).toISOString();
}

function mapBatchPublishContext(item: BatchPublishContextNode): BatchPublishContext {
  return {
    batchIdHex: normalizeLowerHex(item.batchId ?? "0x0"),
    claimIdHex: normalizeLowerHex(item.claimId ?? "0x0"),
    monthLabel: item.monthLabel ?? "--",
    billId: item.billId ?? "--",
    grossAmount: normalizeBigIntString(item.grossAmount),
    grossAmountDisplay:
      typeof item.grossAmountDisplay === "string"
        ? item.grossAmountDisplay
        : formatAssetAmount(normalizeBigIntString(item.grossAmount), "summary"),
    creator: normalizeLowerHex(item.creator ?? "0x0000000000000000000000000000000000000000"),
    txHash: normalizeLowerHex(item.txHash ?? "0x0"),
    blockNumber: normalizeBigIntString(item.blockNumber),
    committedAt: toIsoDate(item.committedAt)
  };
}

/**
 * 创作者历史页顶部摘要不依赖单页列表现算，而是直接消费 creator_month_summaries。
 * 这样记录再多，统计卡也不会因为“先取很多条再前端汇总”而变慢。
 */
async function readCreatorSummaryFromIndexer(creatorAddress: `0x${string}`): Promise<CreatorHistorySummary> {
  const data = await fetchIndexerGraphql<CreatorMonthSummariesPayload>(
    `
      query CreatorHistorySummary($creator: String!, $limit: Int!) {
        creatorMonthSummariess(
          where: { creator: $creator }
          orderBy: "updatedAt"
          orderDirection: "desc"
          limit: $limit
        ) {
          items {
            monthLabel
            totalGrossAmount
            claimCount
            updatedAt
          }
        }
      }
    `,
    {
      creator: creatorAddress.toLowerCase(),
      limit: SUMMARY_QUERY_LIMIT
    }
  );

  const items = data.creatorMonthSummariess?.items ?? [];
  const totalClaimed = items.reduce((sum, item) => sum + BigInt(normalizeBigIntString(item.totalGrossAmount)), 0n);
  const totalClaimCount = items.reduce((sum, item) => sum + normalizeNumber(item.claimCount), 0);

  return {
    totalClaimedDisplay: formatAssetAmount(totalClaimed, "summary"),
    totalClaimCount,
    latestBatchLabel: items[0]?.monthLabel ?? null
  };
}

/**
 * creator history 面向“我领过哪些批次”这个页面，
 * 所以它返回的是 claim 主记录 + 月度汇总，而不是完整分账流水。
 */
export async function readCreatorHistoryFromIndexer(
  creatorAddress: `0x${string}`,
  pagination: PaginationInput
): Promise<{
  records: ClaimRecord[];
  summary: CreatorHistorySummary;
  pageInfo: PageInfo;
}> {
  const requestLimit = pagination.offset + pagination.limit;
  const [claimData, summary] = await Promise.all([
    fetchIndexerGraphql<ClaimRecordsPayload>(
      `
        query CreatorHistory($creator: String!, $limit: Int!) {
          claimRecordss(
            where: { creator: $creator }
            orderBy: "blockNumber"
            orderDirection: "desc"
            limit: $limit
          ) {
            items {
              batchId
              monthLabel
              claimId
              creator
              grossAmount
              grossAmountDisplay
              txHash
              blockNumber
            }
            totalCount
          }
        }
      `,
      {
        creator: creatorAddress.toLowerCase(),
        limit: requestLimit
      }
    ),
    readCreatorSummaryFromIndexer(creatorAddress)
  ]);

  const nodes = claimData.claimRecordss?.items ?? [];
  const totalCount = claimData.claimRecordss?.totalCount ?? nodes.length;
  const records = mapClaimRecords(slicePage(nodes, pagination), creatorAddress);

  return {
    records,
    summary: {
      ...summary,
      totalClaimCount: totalCount,
      latestBatchLabel: records[0]?.batchLabel ?? summary.latestBatchLabel
    },
    pageInfo: toPageInfo(pagination, totalCount, records.length)
  };
}

/**
 * ledger 是 creator history 的延伸页：
 * 前者看“领过哪些批次”，后者还要把 SplitPaid 这条分账流水拼进来，
 * 让创作者既能看到 gross claim，也能看到具体到账记录。
 * 它一次并行拉两类数据，再把两套 totalCount 合成一个页面可消费的分页视图。
 */
export async function readCreatorLedgerFromIndexer(
  creatorAddress: `0x${string}`,
  pagination: PaginationInput
): Promise<{
  claimRecords: ClaimRecord[];
  splitRecords: SplitPaymentRecord[];
  summary: CreatorHistorySummary;
  totals: {
    claimRecordCount: number;
    splitRecordCount: number;
  };
  pageInfo: PageInfo;
}> {
  const requestLimit = pagination.offset + pagination.limit;
  const [history, splitData] = await Promise.all([
    readCreatorHistoryFromIndexer(creatorAddress, pagination),
    fetchIndexerGraphql<SplitPaymentRecordsPayload>(
      `
        query CreatorLedger($recipient: String!, $limit: Int!) {
          splitPaymentRecordss(
            where: { recipient: $recipient }
            orderBy: "blockNumber"
            orderDirection: "desc"
            limit: $limit
          ) {
            items {
              batchId
              claimId
              recipient
              amount
              amountDisplay
              bps
              isCreator
              txHash
              blockNumber
            }
            totalCount
          }
        }
      `,
      {
        recipient: creatorAddress.toLowerCase(),
        limit: requestLimit
      }
    )
  ]);

  const splitNodes = splitData.splitPaymentRecordss?.items ?? [];
  const splitRecordCount = splitData.splitPaymentRecordss?.totalCount ?? splitNodes.length;
  const splitRecords = mapSplitPaymentRecords(slicePage(splitNodes, pagination), creatorAddress);
  const combinedTotalCount = Math.max(history.pageInfo.totalCount, splitRecordCount);
  const combinedReturnedCount = Math.max(history.records.length, splitRecords.length);

  return {
    claimRecords: history.records,
    splitRecords,
    summary: history.summary,
    totals: {
      claimRecordCount: history.pageInfo.totalCount,
      splitRecordCount
    },
    pageInfo: toPageInfo(pagination, combinedTotalCount, combinedReturnedCount)
  };
}

/**
 * 协作者页不是只看历史累计，还要告诉协作者“当前批次按账单快照预计能拿多少”。
 * 这个值不来自历史事件，而是当前账单 splitRuleSnapshot，因此这里会显式把
 * server-data 当前快照和 indexer 汇总结果合并成一份更完整的协作者视图。
 * 换句话说：summary 的一部分来自 indexer，一部分来自当前账单输入，两边缺一不可。
 */
export async function readCollaboratorReceiptsFromIndexer(
  recipientAddress: `0x${string}`,
  pagination: PaginationInput
): Promise<{
  records: CollaboratorReceiptRecord[];
  summary: CollaboratorReceiptSummary;
  pageInfo: PageInfo;
}> {
  const requestLimit = pagination.offset + pagination.limit;
  const [recordsData, summaryData] = await Promise.all([
    fetchIndexerGraphql<SplitPaymentRecordsPayload>(
      `
        query CollaboratorReceipts($recipient: String!, $limit: Int!) {
          splitPaymentRecordss(
            where: { recipient: $recipient, isCreator: false }
            orderBy: "blockNumber"
            orderDirection: "desc"
            limit: $limit
          ) {
            items {
              batchId
              claimId
              recipient
              amount
              amountDisplay
              bps
              isCreator
              txHash
              blockNumber
            }
            totalCount
          }
        }
      `,
      {
        recipient: recipientAddress.toLowerCase(),
        limit: requestLimit
      }
    ),
    fetchIndexerGraphql<CollaboratorReceiptSummariesPayload>(
      `
        query CollaboratorReceiptSummary($recipient: String!) {
          collaboratorReceiptSummariess(where: { recipient: $recipient }, limit: 1) {
            items {
              totalReceivedAmount
              totalReceivedDisplay
              totalReceiptCount
              latestBatchLabel
            }
          }
        }
      `,
      {
        recipient: recipientAddress.toLowerCase()
      }
    )
  ]);

  const receiptNodes = recordsData.splitPaymentRecordss?.items ?? [];
  const totalCount = recordsData.splitPaymentRecordss?.totalCount ?? receiptNodes.length;
  const splitRecords = mapSplitPaymentRecords(slicePage(receiptNodes, pagination), recipientAddress);
  const records: CollaboratorReceiptRecord[] = splitRecords.map((record) => ({
    batchIdHex: record.batchIdHex,
    claimIdHex: record.claimIdHex,
    batchLabel: record.batchLabel ?? "--",
    recipient: record.recipient,
    amount: record.amount,
    amountDisplay: record.amountDisplay,
    bps: record.bps,
    txHash: record.txHash,
    blockNumber: record.blockNumber
  }));
  const currentBill = buildCurrentBillView(readCurrentBillInput());
  const currentSplit = currentBill.splitRuleSnapshot.find(
    (entry) => entry.role === "collaborator" && entry.recipient.toLowerCase() === recipientAddress.toLowerCase()
  );
  const summaryItem = summaryData.collaboratorReceiptSummariess?.items?.[0];

  return {
    records,
    summary: {
      currentExpectedAmount: currentSplit?.amount ?? "0",
      currentExpectedAmountDisplay: currentSplit?.amountDisplay ?? "0.00",
      totalReceivedAmount: normalizeBigIntString(summaryItem?.totalReceivedAmount),
      totalReceivedDisplay:
        typeof summaryItem?.totalReceivedDisplay === "string"
          ? summaryItem.totalReceivedDisplay
          : formatAssetAmount(normalizeBigIntString(summaryItem?.totalReceivedAmount), "summary"),
      totalReceiptCount: normalizeNumber(summaryItem?.totalReceiptCount),
      latestBatchLabel: summaryItem?.latestBatchLabel ?? records[0]?.batchLabel ?? null
    },
    pageInfo: toPageInfo(pagination, totalCount, records.length)
  };
}

export async function readPlatformActivityFromIndexer(): Promise<{
  latestPublishContext: BatchPublishContext | null;
}> {
  const publishData = await fetchIndexerGraphql<BatchPublishContextsPayload>(
    `
      query PlatformLatestPublishContext {
        batchPublishContextss(orderBy: "committedAt", orderDirection: "desc", limit: 1) {
          items {
            batchId
            claimId
            monthLabel
            billId
            grossAmount
            grossAmountDisplay
            creator
            txHash
            blockNumber
            committedAt
          }
        }
      }
    `,
    {}
  );

  return {
    latestPublishContext: publishData.batchPublishContextss?.items?.[0]
      ? mapBatchPublishContext(publishData.batchPublishContextss.items[0])
      : null
  };
}

export async function readPlatformHistoryFromIndexer(): Promise<PlatformHistoryMonthRecord[]> {
  const config = readRuntimeConfigForScript();
  const [claimData, splitData] = await Promise.all([
    fetchIndexerGraphql<ClaimRecordsPayload>(
      `
        query PlatformHistoryClaims($limit: Int!) {
          claimRecordss(orderBy: "blockNumber", orderDirection: "desc", limit: $limit) {
            items {
              batchId
              monthLabel
              claimId
              creator
              grossAmount
              grossAmountDisplay
              txHash
              blockNumber
            }
          }
        }
      `,
      {
        // 平台历史要把 claim 记录和三方 split 记录一起聚合。
        // 索引器单次查询上限是 1000，所以这里给 claim 留 1/4，
        // 让 split 仍有 4 倍空间覆盖「每个 claim 对应多条分账」的场景。
        limit: PLATFORM_HISTORY_CLAIM_QUERY_LIMIT
      }
    ),
    fetchIndexerGraphql<SplitPaymentRecordsPayload>(
      `
        query PlatformHistorySplits($limit: Int!) {
          splitPaymentRecordss(orderBy: "blockNumber", orderDirection: "desc", limit: $limit) {
            items {
              batchId
              claimId
              recipient
              amount
              amountDisplay
              bps
              isCreator
              txHash
              blockNumber
            }
          }
        }
      `,
      {
        limit: PLATFORM_HISTORY_SPLIT_QUERY_LIMIT
      }
    )
  ]);

  const claims = mapClaimRecords(claimData.claimRecordss?.items ?? [], config.demoAddresses.creator);
  const splits = mapSplitPaymentRecords(splitData.splitPaymentRecordss?.items ?? [], config.demoAddresses.creator);
  const grouped = new Map<
    string,
    PlatformHistoryMonthRecord & {
      creator: `0x${string}`;
    }
  >();

  for (const claim of claims) {
    const key = `${claim.batchIdHex}:${claim.claimIdHex}`;
    grouped.set(key, {
      monthLabel: claim.batchLabel,
      batchIdHex: claim.batchIdHex,
      claimIdHex: claim.claimIdHex,
      grossAmount: claim.grossAmount,
      grossAmountDisplay: claim.grossAmountDisplay,
      status: "claimed",
      participants: [],
      creator: claim.creator
    });
  }

  for (const split of splits) {
    const key = `${split.batchIdHex}:${split.claimIdHex}`;
    const group = grouped.get(key);
    if (!group) continue;

    const participantMeta = resolvePlatformHistoryParticipantMeta({
      recipient: split.recipient,
      creator: group.creator,
      isCreator: split.isCreator
    });

    group.participants.push({
      role: participantMeta.role,
      label: participantMeta.label,
      recipient: split.recipient,
      amount: split.amount,
      amountDisplay: split.amountDisplay,
      status: "claimed"
    });
  }

  return sortPlatformHistoryRecords(
    Array.from(grouped.values()).map(({ creator, participants, ...record }) => ({
      ...record,
      participants: sortPlatformHistoryParticipants(participants)
    }))
  );
}
