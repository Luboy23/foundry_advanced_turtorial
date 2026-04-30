import { parseAbiItem } from "viem";
import { resolveBatchLabel } from "@/lib/batch-labels";
import { createServerPublicClient } from "@/lib/server/public-client";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";
import { creatorRevenueDistributorAbi, revenueBatchRegistryAbi } from "@/lib/contracts";
import { formatAssetAmount } from "@/lib/format";
import { buildCurrentBillView, readCurrentBillInput } from "@/lib/server/bills";
import { paginateRecords } from "@/lib/server/pagination";
import {
  resolvePlatformHistoryParticipantMeta,
  sortPlatformHistoryParticipants,
  sortPlatformHistoryRecords
} from "@/lib/server/platform-history";
import { readThroughTtlCache } from "@/lib/server/ttl-cache";
import type {
  ClaimRecord,
  CollaboratorReceiptRecord,
  CollaboratorReceiptSummary,
  CreatorHistorySummary,
  CreatorSettlementBill,
  PlatformHistoryMonthRecord,
  RevenueBatchSummary,
  SplitPaymentRecord
} from "@/types/domain";

/**
 * 这一层负责“直接读链”的回退路径：
 * - 首页 / 工作台需要把 server-data 与链上状态拼起来；
 * - 历史 / 流水 / 协作者到账在 fresh=1 或 indexer 不可用时仍可回退到链上；
 * - TTL cache 不是单纯为了省几次 RPC，而是为了避免轮询页面把同一批链读取放大。
 */
const batchStatusMap = ["unknown", "draft", "published", "paused", "closed"] as const;
const SHORT_TTL_MS = 2_000;
const LONG_TTL_MS = 5_000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type ReadOptions = {
  fresh?: boolean;
  pagination?: {
    limit: number;
    offset: number;
    cursor: string | null;
  };
};

/**
 * 合约里批次状态是 enum 数字，页面里需要的是可读字符串。
 * 这个适配层把链上最小真值翻译成前端统一状态枚举，避免 UI 到处自己猜数字含义。
 */
function normalizeBatchStatus(value: unknown): RevenueBatchSummary["status"] {
  const numericValue = Number(value);
  return batchStatusMap[numericValue] ?? "unknown";
}

/**
 * 创作者账单状态是“批次状态”在单张账单上的产品化投影。
 * 只有批次仍是 published 时，claimed / claimable 才有意义；否则页面优先展示平台状态。
 */
function toBillStatus(batchStatus: RevenueBatchSummary["status"], claimed: boolean): CreatorSettlementBill["status"] {
  if (batchStatus === "published") {
    return claimed ? "claimed" : "claimable";
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
 * 同一套代码可能连到不同链、不同部署或不同起始区块。
 * cache scope 把这些环境因素都编进 key，避免本地 / 测试 / 切链时串读旧缓存。
 */
function buildChainCacheScope() {
  const config = readRuntimeConfigForScript();
  return [
    config.chainId,
    config.rpcUrl,
    config.batchRegistryAddress,
    config.distributorAddress,
    config.startBlock
  ].join(":");
}

/**
 * 链上回退读取的缓存 key 统一按“环境作用域 + 数据类别 + 业务标识”组织，
 * 方便让当前批次、账单状态、history、ledger 等不同读口互不污染。
 */
function buildChainCacheKey(scope: string, label: string, identifier?: string) {
  return [scope, label, identifier].filter(Boolean).join(":");
}

/**
 * 首页和平台页显示的“当前批次”并不只是静态 server-data 草稿，
 * 还要结合链上真实状态判断当前批次是否已发布 / 暂停 / 关闭。
 * 当草稿本身没有总额展示值时，这里还会顺手通过 ClaimProcessed 估算当前已领取规模，
 * 让页面在缺少完整服务端输入时也有一个更接近真实链状态的展示。
 */
export async function readCurrentBatchFromChain(
  draft: RevenueBatchSummary,
  options?: ReadOptions
): Promise<RevenueBatchSummary> {
  const config = readRuntimeConfigForScript();
  if (!config.batchRegistryAddress || config.batchRegistryAddress === ZERO_ADDRESS) {
    return draft;
  }

  return readThroughTtlCache(
    buildChainCacheKey(buildChainCacheScope(), "current-batch", config.activeBatchId),
    SHORT_TTL_MS,
    async () => {
      const client = createServerPublicClient();
      const batch = (await client.readContract({
        address: config.batchRegistryAddress,
        abi: revenueBatchRegistryAbi,
        functionName: "getBatchSnapshot",
        args: [config.activeBatchId]
      })) as readonly [`0x${string}`, `0x${string}`, bigint | number];

      const claimLogs = await client.getLogs({
        address: config.distributorAddress,
        event: parseAbiItem(
          "event ClaimProcessed(bytes32 indexed batchId, bytes32 indexed claimId, address indexed creator, address token, uint256 grossAmount)"
        ),
        args: {
          batchId: config.activeBatchId
        },
        fromBlock: BigInt(config.startBlock)
      });

      const claimedAmount = claimLogs.reduce((sum, log) => sum + (log.args.grossAmount ?? 0n), 0n);

      return {
        ...draft,
        status: normalizeBatchStatus(batch[2] ?? 0),
        grossAmountDisplay:
          draft.grossAmount !== "0" ? draft.grossAmountDisplay : formatAssetAmount(claimedAmount || 0n, "summary"),
        lastSyncedAt: new Date().toISOString()
      };
    },
    options
  );
}

/**
 * 账单状态不是单独存在的链上字段，而是“批次状态 + 该 claim 是否已被消费”的派生结果。
 * 这里把批次状态机翻译成创作者能直接理解的 draft / claimable / claimed / paused / closed。
 */
export async function readCurrentBillStatus(
  bill: CreatorSettlementBill,
  options?: ReadOptions
): Promise<CreatorSettlementBill["status"]> {
  const config = readRuntimeConfigForScript();
  if (
    !config.batchRegistryAddress ||
    config.batchRegistryAddress === ZERO_ADDRESS ||
    !config.distributorAddress ||
    config.distributorAddress === ZERO_ADDRESS
  ) {
    return bill.status;
  }

  return readThroughTtlCache(
    buildChainCacheKey(buildChainCacheScope(), "bill-status", bill.claimIdHex),
    SHORT_TTL_MS,
    async () => {
      const client = createServerPublicClient();
      const batch = (await client.readContract({
        address: config.batchRegistryAddress,
        abi: revenueBatchRegistryAbi,
        functionName: "getBatchSnapshot",
        args: [bill.batchIdHex]
      })) as readonly [`0x${string}`, `0x${string}`, bigint | number];

      const batchStatus = normalizeBatchStatus(batch[2] ?? 0);

      if (batchStatus !== "published") {
        return toBillStatus(batchStatus, false);
      }

      if (!bill.claimIdHex || bill.claimIdHex === "0x0") {
        return "claimable";
      }

      const claimed = (await client.readContract({
        address: config.distributorAddress,
        abi: creatorRevenueDistributorAbi,
        functionName: "isClaimed",
        args: [bill.batchIdHex, bill.claimIdHex]
      })) as boolean;

      return toBillStatus(batchStatus, claimed);
    },
    options
  );
}

/**
 * 这条路径专门服务 creator history 的链上回退读取。
 * 正常情况下页面优先走 indexer-first；只有 fresh=1 或索引器不可用时，
 * 才退回全链事件扫描并在服务端做聚合和分页。
 */
export async function readCreatorClaimHistory(creatorAddress: `0x${string}`, options?: ReadOptions): Promise<{
  records: ClaimRecord[];
  summary: CreatorHistorySummary;
  pageInfo: {
    limit: number;
    cursor: string | null;
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
  };
}> {
  const config = readRuntimeConfigForScript();
  const pagination = options?.pagination ?? { limit: 20, offset: 0, cursor: null };
  const empty = {
    records: [],
    summary: {
      totalClaimedDisplay: "0.00",
      totalClaimCount: 0,
      latestBatchLabel: null
    },
    pageInfo: {
      limit: pagination.limit,
      cursor: pagination.cursor,
      nextCursor: null,
      hasMore: false,
      totalCount: 0
    }
  };

  if (!config.distributorAddress || config.distributorAddress === ZERO_ADDRESS) {
    return empty;
  }

  return readThroughTtlCache(
    buildChainCacheKey(buildChainCacheScope(), "creator-history", creatorAddress.toLowerCase()),
    LONG_TTL_MS,
    async () => {
      const client = createServerPublicClient();
      const logs = await client.getLogs({
        address: config.distributorAddress,
        event: parseAbiItem(
          "event ClaimProcessed(bytes32 indexed batchId, bytes32 indexed claimId, address indexed creator, address token, uint256 grossAmount)"
        ),
        args: {
          creator: creatorAddress
        },
        fromBlock: BigInt(config.startBlock)
      });

      const records = logs
        .map((log) => ({
          batchIdHex: (log.args.batchId ?? "0x0") as `0x${string}`,
          batchLabel: resolveBatchLabel(log.args.batchId as `0x${string}` | undefined, config.batchLabelMap),
          claimIdHex: (log.args.claimId ?? "0x0") as `0x${string}`,
          creator: (log.args.creator ?? creatorAddress) as `0x${string}`,
          grossAmount: String(log.args.grossAmount ?? 0n),
          grossAmountDisplay: formatAssetAmount(log.args.grossAmount ?? 0n, "detail"),
          txHash: log.transactionHash,
          blockNumber: String(log.blockNumber ?? 0n)
        }))
        .sort((left, right) => Number(BigInt(right.blockNumber) - BigInt(left.blockNumber)));

      const totalClaimed = records.reduce((sum, record) => sum + BigInt(record.grossAmount), 0n);

      const page = paginateRecords(records, pagination);

      return {
        records: page.items,
        summary: {
          totalClaimedDisplay: formatAssetAmount(totalClaimed, "summary"),
          totalClaimCount: records.length,
          latestBatchLabel: records[0]?.batchLabel ?? null
        },
        pageInfo: page.pageInfo
      };
    },
    options
  );
}

/**
 * creator ledger 和 history 不同：
 * 它关注的是 SplitPaid 这条分账事件流，尤其是创作者自己作为收款人时的到账记录。
 */
export async function readCreatorLedger(
  creatorAddress: `0x${string}`,
  options?: ReadOptions
): Promise<{
  records: SplitPaymentRecord[];
  pageInfo: {
    limit: number;
    cursor: string | null;
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
  };
}> {
  const config = readRuntimeConfigForScript();
  const pagination = options?.pagination ?? { limit: 20, offset: 0, cursor: null };
  if (!config.distributorAddress || config.distributorAddress === ZERO_ADDRESS) {
    return {
      records: [],
      pageInfo: {
        limit: pagination.limit,
        cursor: pagination.cursor,
        nextCursor: null,
        hasMore: false,
        totalCount: 0
      }
    };
  }

  return readThroughTtlCache(
    buildChainCacheKey(buildChainCacheScope(), "creator-ledger", creatorAddress.toLowerCase()),
    LONG_TTL_MS,
    async () => {
      const client = createServerPublicClient();
      const logs = await client.getLogs({
        address: config.distributorAddress,
        event: parseAbiItem(
          "event SplitPaid(bytes32 indexed batchId, bytes32 indexed claimId, address indexed recipient, uint256 amount, uint16 bps, bool isCreator)"
        ),
        fromBlock: BigInt(config.startBlock)
      });

      const records = logs
        .filter((log) => (log.args.recipient ?? "").toLowerCase() === creatorAddress.toLowerCase())
        .map((log) => ({
          batchIdHex: (log.args.batchId ?? "0x0") as `0x${string}`,
          claimIdHex: (log.args.claimId ?? "0x0") as `0x${string}`,
          batchLabel: resolveBatchLabel(log.args.batchId as `0x${string}` | undefined, config.batchLabelMap),
          recipient: (log.args.recipient ?? creatorAddress) as `0x${string}`,
          amount: String(log.args.amount ?? 0n),
          amountDisplay: formatAssetAmount(log.args.amount ?? 0n, "detail"),
          bps: Number(log.args.bps ?? 0),
          isCreator: Boolean(log.args.isCreator),
          txHash: log.transactionHash,
          blockNumber: String(log.blockNumber ?? 0n)
        }))
        .sort((left, right) => Number(BigInt(right.blockNumber) - BigInt(left.blockNumber)));

      const page = paginateRecords(records, pagination);
      return {
        records: page.items,
        pageInfo: page.pageInfo
      };
    },
    options
  );
}

/**
 * 协作者页顶部的“本月预计到账”不是历史投影能直接推出来的字段，
 * 它依赖当前账单里的 splitRuleSnapshot。
 * 因此即便走链上回退路径，这里仍要把 server-data 当前快照和链上历史结果结合起来。
 */
function buildCollaboratorSummary(
  recipientAddress: `0x${string}`,
  records: CollaboratorReceiptRecord[]
): CollaboratorReceiptSummary {
  /**
   * 协作者页顶部的汇总不是纯历史聚合：
   * - currentExpectedAmount 来自当前账单快照，回答“这个月理论上还能拿多少”；
   * - totalReceivedAmount 来自历史到账记录，回答“过去一共已经拿了多少”。
   * 两者合在一起，页面才同时具备“当前预期”和“历史累计”。
   */
  const currentBill = buildCurrentBillView(readCurrentBillInput());
  const currentSplit = currentBill.splitRuleSnapshot.find(
    (entry) => entry.role === "collaborator" && entry.recipient.toLowerCase() === recipientAddress.toLowerCase()
  );
  const totalReceivedAmount = records.reduce((sum, record) => sum + BigInt(record.amount), 0n);

  return {
    currentExpectedAmount: currentSplit?.amount ?? "0",
    currentExpectedAmountDisplay: currentSplit?.amountDisplay ?? "0.00",
    totalReceivedAmount: totalReceivedAmount.toString(),
    totalReceivedDisplay: formatAssetAmount(totalReceivedAmount, "summary"),
    totalReceiptCount: records.length,
    latestBatchLabel: records[0]?.batchLabel ?? null
  };
}

/**
 * 协作者到账回退路径仍保留的原因是：
 * indexer 负责默认读模型，但页面在 fresh=1 或索引器异常时，
 * 仍然需要一个“直接看链上事实”的兜底答案。
 */
export async function readCollaboratorReceipts(
  recipientAddress: `0x${string}`,
  options?: ReadOptions
): Promise<{
  records: CollaboratorReceiptRecord[];
  summary: CollaboratorReceiptSummary;
  pageInfo: {
    limit: number;
    cursor: string | null;
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
  };
}> {
  const config = readRuntimeConfigForScript();
  const pagination = options?.pagination ?? { limit: 20, offset: 0, cursor: null };
  const emptyRecords: CollaboratorReceiptRecord[] = [];

  if (!config.distributorAddress || config.distributorAddress === ZERO_ADDRESS) {
    return {
      records: emptyRecords,
      summary: buildCollaboratorSummary(recipientAddress, emptyRecords),
      pageInfo: {
        limit: pagination.limit,
        cursor: pagination.cursor,
        nextCursor: null,
        hasMore: false,
        totalCount: 0
      }
    };
  }

  return readThroughTtlCache(
    buildChainCacheKey(buildChainCacheScope(), "collaborator-receipts", recipientAddress.toLowerCase()),
    LONG_TTL_MS,
    async () => {
      const client = createServerPublicClient();
      const logs = await client.getLogs({
        address: config.distributorAddress,
        event: parseAbiItem(
          "event SplitPaid(bytes32 indexed batchId, bytes32 indexed claimId, address indexed recipient, uint256 amount, uint16 bps, bool isCreator)"
        ),
        args: {
          recipient: recipientAddress
        },
        fromBlock: BigInt(config.startBlock)
      });

      const records = logs
        .map((log) => ({
          batchIdHex: (log.args.batchId ?? "0x0") as `0x${string}`,
          claimIdHex: (log.args.claimId ?? "0x0") as `0x${string}`,
          batchLabel: resolveBatchLabel(log.args.batchId as `0x${string}` | undefined, config.batchLabelMap),
          recipient: (log.args.recipient ?? recipientAddress) as `0x${string}`,
          amount: String(log.args.amount ?? 0n),
          amountDisplay: formatAssetAmount(log.args.amount ?? 0n, "detail"),
          bps: Number(log.args.bps ?? 0),
          txHash: log.transactionHash,
          blockNumber: String(log.blockNumber ?? 0n)
        }))
        .sort((left, right) => Number(BigInt(right.blockNumber) - BigInt(left.blockNumber)));

      const page = paginateRecords(records, pagination);

      return {
        records: page.items,
        summary: buildCollaboratorSummary(recipientAddress, records),
        pageInfo: page.pageInfo
      };
    },
    options
  );
}

export async function readPlatformHistoryFromChain(options?: ReadOptions): Promise<PlatformHistoryMonthRecord[]> {
  const config = readRuntimeConfigForScript();

  if (!config.distributorAddress || config.distributorAddress === ZERO_ADDRESS) {
    return [];
  }

  return readThroughTtlCache(
    buildChainCacheKey(buildChainCacheScope(), "platform-history"),
    LONG_TTL_MS,
    async () => {
      const client = createServerPublicClient();
      const [claimLogs, splitLogs] = await Promise.all([
        client.getLogs({
          address: config.distributorAddress,
          event: parseAbiItem(
            "event ClaimProcessed(bytes32 indexed batchId, bytes32 indexed claimId, address indexed creator, address token, uint256 grossAmount)"
          ),
          fromBlock: BigInt(config.startBlock)
        }),
        client.getLogs({
          address: config.distributorAddress,
          event: parseAbiItem(
            "event SplitPaid(bytes32 indexed batchId, bytes32 indexed claimId, address indexed recipient, uint256 amount, uint16 bps, bool isCreator)"
          ),
          fromBlock: BigInt(config.startBlock)
        })
      ]);

      const grouped = new Map<
        string,
        PlatformHistoryMonthRecord & {
          creator: `0x${string}`;
        }
      >();

      for (const log of claimLogs) {
        const batchIdHex = (log.args.batchId ?? "0x0") as `0x${string}`;
        const claimIdHex = (log.args.claimId ?? "0x0") as `0x${string}`;
        const creator = (log.args.creator ?? config.demoAddresses.creator) as `0x${string}`;
        const key = `${batchIdHex}:${claimIdHex}`;

        grouped.set(key, {
          monthLabel: resolveBatchLabel(batchIdHex, config.batchLabelMap),
          batchIdHex,
          claimIdHex,
          grossAmount: String(log.args.grossAmount ?? 0n),
          grossAmountDisplay: formatAssetAmount(log.args.grossAmount ?? 0n, "detail"),
          status: "claimed",
          participants: [],
          creator
        });
      }

      for (const log of splitLogs) {
        const batchIdHex = (log.args.batchId ?? "0x0") as `0x${string}`;
        const claimIdHex = (log.args.claimId ?? "0x0") as `0x${string}`;
        const key = `${batchIdHex}:${claimIdHex}`;
        const group = grouped.get(key);
        if (!group) continue;

        const recipient = (log.args.recipient ?? config.demoAddresses.creator) as `0x${string}`;
        const participantMeta = resolvePlatformHistoryParticipantMeta({
          recipient,
          creator: group.creator,
          isCreator: Boolean(log.args.isCreator)
        });

        group.participants.push({
          role: participantMeta.role,
          label: participantMeta.label,
          recipient,
          amount: String(log.args.amount ?? 0n),
          amountDisplay: formatAssetAmount(log.args.amount ?? 0n, "detail"),
          status: "claimed"
        });
      }

      return sortPlatformHistoryRecords(
        Array.from(grouped.values()).map(({ creator, participants, ...record }) => ({
          ...record,
          participants: sortPlatformHistoryParticipants(participants)
        }))
      );
    },
    options
  );
}
