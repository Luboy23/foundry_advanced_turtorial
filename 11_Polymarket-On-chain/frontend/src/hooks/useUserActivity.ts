import { useQuery } from "@tanstack/react-query";
import { parseAbiItem } from "viem";
import { usePublicClient } from "wagmi";

import { ACTIVITY_INDEXER_URL, EVENT_FACTORY_ADDRESS, IS_CONTRACT_CONFIGURED } from "@/lib/config";
import { Outcome, PositionSide } from "@/lib/event-types";

/** 活动类型枚举（前端统一事件语义）。 */
export type ActivityKind =
  | "event_created"
  | "position_bought"
  | "resolution_proposed"
  | "resolution_finalized"
  | "redeemed";

/** 单条活动流记录。 */
export type UserActivityItem = {
  kind: ActivityKind;
  eventId: bigint | null;
  account: `0x${string}` | null;
  amount: bigint | null;
  tokenAmount: bigint | null;
  side: PositionSide | null;
  eventYesPool: bigint | null;
  eventNoPool: bigint | null;
  outcome: Outcome | null;
  txHash: `0x${string}`;
  blockNumber: bigint;
  logIndex: number;
};

/** 活动列表分页结果。 */
export type UserActivityPage = {
  items: UserActivityItem[];
  total: number;
  cursor: number;
  limit: number;
  nextCursor: number | null;
  prevCursor: number | null;
  source: "chain" | "indexer";
  scannedToBlock: bigint | null;
};

const eventCreatedEvent = parseAbiItem(
  "event EventCreated(uint256 indexed eventId,address indexed creator,string question,uint64 closeTime,string resolutionSourceURI,string metadataURI)"
);
const boughtEvent = parseAbiItem(
  "event PositionBought(uint256 indexed eventId,address indexed user,uint8 side,uint256 collateralIn,uint256 tokenAmount,uint256 yesPool,uint256 noPool)"
);
const proposedEvent = parseAbiItem(
  "event ResolutionProposed(uint256 indexed eventId,address indexed proposer,uint8 outcome,uint64 proposedAt,uint64 canFinalizeAt)"
);
const finalizedEvent = parseAbiItem("event ResolutionFinalized(uint256 indexed eventId,uint8 outcome,uint64 finalizedAt)");
const redeemedEvent = parseAbiItem(
  "event Redeemed(uint256 indexed eventId,address indexed user,uint256 yesAmount,uint256 noAmount,uint256 payout,uint8 outcome)"
);

type UseUserActivityOptions = {
  eventId?: bigint | null;
  limit?: number;
  cursor?: number;
};

type PublicClientLike = NonNullable<ReturnType<typeof usePublicClient>>;

/** 归一化分页游标，非法值回退到 0。 */
function toSafeCursor(cursor: number | undefined) {
  if (!Number.isFinite(cursor) || !cursor || cursor < 0) {
    return 0;
  }
  return Math.floor(cursor);
}

/** 归一化分页大小，默认 30，最大 100。 */
function toSafeLimit(limit: number | undefined) {
  if (!Number.isFinite(limit) || !limit || limit <= 0) {
    return 30;
  }
  return Math.min(100, Math.floor(limit));
}

/** 对链上活动数组做本地分页。 */
function paginateActivities(items: UserActivityItem[], cursor: number, limit: number): UserActivityPage {
  const paged = items.slice(cursor, cursor + limit);
  const nextCursor = cursor + limit < items.length ? cursor + limit : null;
  const prevCursor = cursor - limit >= 0 ? cursor - limit : cursor > 0 ? 0 : null;
  return {
    items: paged,
    total: items.length,
    cursor,
    limit,
    nextCursor,
    prevCursor,
    source: "chain",
    scannedToBlock: null
  };
}

/** 按区块号与日志序号倒序，保证“最新事件优先”。 */
function sortActivitiesDesc(items: UserActivityItem[]) {
  return [...items].sort((a, b) => {
    if (a.blockNumber === b.blockNumber) {
      return b.logIndex - a.logIndex;
    }
    return a.blockNumber > b.blockNumber ? -1 : 1;
  });
}

/** 将原始 side 数值解析为 PositionSide，非法值返回 `null`。 */
function parsePositionSide(side: number | null | undefined): PositionSide | null {
  if (side === PositionSide.Yes || side === PositionSide.No) {
    return side;
  }
  return null;
}

/** 为缺失账户地址的 `resolution_finalized` 活动回填交易发送者地址。 */
async function backfillFinalizedAccounts(
  publicClient: PublicClientLike,
  items: UserActivityItem[]
): Promise<UserActivityItem[]> {
  const missingHashes = Array.from(
    new Set(items.filter((item) => item.kind === "resolution_finalized" && item.account === null).map((item) => item.txHash))
  );

  if (missingHashes.length === 0) {
    return items;
  }

  const accountByHash = new Map<`0x${string}`, `0x${string}`>();
  await Promise.all(
    missingHashes.map(async (hash) => {
      try {
        const tx = await publicClient.getTransaction({ hash });
        if (tx.from) {
          accountByHash.set(hash, tx.from as `0x${string}`);
        }
      } catch {
        // 交易详情读取失败时保持空值，不影响其他活动渲染。
      }
    })
  );

  if (accountByHash.size === 0) {
    return items;
  }

  return items.map((item) => {
    if (item.kind !== "resolution_finalized" || item.account !== null) {
      return item;
    }
    return {
      ...item,
      account: accountByHash.get(item.txHash) ?? null
    };
  });
}

/** 优先从索引器拉取活动流，失败时返回 `null` 交由链上回读兜底。 */
async function fetchFromIndexer(eventId: bigint | null, cursor: number, limit: number): Promise<UserActivityPage | null> {
  if (!ACTIVITY_INDEXER_URL) {
    return null;
  }

  try {
    const eventParam = eventId ? `&eventId=${eventId.toString()}` : "";
    const response = await fetch(`${ACTIVITY_INDEXER_URL}/activities?cursor=${cursor}&limit=${limit}${eventParam}`);
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      items: Array<{
        kind: ActivityKind;
        eventId: string | null;
        account: `0x${string}` | null;
        amount: string | null;
        tokenAmount?: string | null;
        side?: number | null;
        yesPool?: string | null;
        noPool?: string | null;
        eventYesPool?: string | null;
        eventNoPool?: string | null;
        outcome: number | null;
        txHash: `0x${string}`;
        blockNumber: string;
        logIndex: number;
      }>;
      total: number;
      cursor: number;
      limit: number;
      nextCursor: number | null;
      prevCursor: number | null;
      scannedToBlock?: string | null;
    };

    return {
      items: payload.items.map((item) => ({
        kind: item.kind,
        eventId: item.eventId ? BigInt(item.eventId) : null,
        account: item.account,
        amount: item.amount ? BigInt(item.amount) : null,
        tokenAmount: item.tokenAmount ? BigInt(item.tokenAmount) : null,
        side: parsePositionSide(item.side ?? null),
        eventYesPool: item.eventYesPool ? BigInt(item.eventYesPool) : item.yesPool ? BigInt(item.yesPool) : null,
        eventNoPool: item.eventNoPool ? BigInt(item.eventNoPool) : item.noPool ? BigInt(item.noPool) : null,
        outcome: item.outcome === null ? null : (item.outcome as Outcome),
        txHash: item.txHash,
        blockNumber: BigInt(item.blockNumber),
        logIndex: item.logIndex
      })),
      total: payload.total,
      cursor: payload.cursor,
      limit: payload.limit,
      nextCursor: payload.nextCursor,
      prevCursor: payload.prevCursor,
      source: "indexer",
      scannedToBlock: payload.scannedToBlock ? BigInt(payload.scannedToBlock) : null
    };
  } catch {
    return null;
  }
}

/** 活动流 Hook：优先索引器，失败时回退链上日志聚合。 */
export function useUserActivity(options: UseUserActivityOptions = {}) {
  const publicClient = usePublicClient();
  const eventId = options.eventId ?? null;
  const cursor = toSafeCursor(options.cursor);
  const limit = toSafeLimit(options.limit);

  return useQuery<UserActivityPage>({
    queryKey: ["activities", EVENT_FACTORY_ADDRESS ?? "unconfigured", eventId?.toString() ?? "all", String(cursor), String(limit)],
    queryFn: async () => {
      if (!publicClient || !EVENT_FACTORY_ADDRESS || !IS_CONTRACT_CONFIGURED) {
        return {
          items: [],
          total: 0,
          cursor,
          limit,
          nextCursor: null,
          prevCursor: null,
          source: "chain",
          scannedToBlock: null
        };
      }

      const fromIndexer = await fetchFromIndexer(eventId, cursor, limit);
      if (fromIndexer) {
        const hydratedItems = await backfillFinalizedAccounts(publicClient, fromIndexer.items);
        return {
          ...fromIndexer,
          items: hydratedItems
        };
      }

      // 索引器不可用时回退链上日志扫描：按事件类型并发拉取并在前端统一归并。
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = 1n;
      const toBlock = latestBlock;

      const [created, bought, proposed, finalized, redeemed] = await Promise.all([
        publicClient.getLogs({ address: EVENT_FACTORY_ADDRESS, event: eventCreatedEvent, fromBlock, toBlock }),
        publicClient.getLogs({ address: EVENT_FACTORY_ADDRESS, event: boughtEvent, fromBlock, toBlock }),
        publicClient.getLogs({ address: EVENT_FACTORY_ADDRESS, event: proposedEvent, fromBlock, toBlock }),
        publicClient.getLogs({ address: EVENT_FACTORY_ADDRESS, event: finalizedEvent, fromBlock, toBlock }),
        publicClient.getLogs({ address: EVENT_FACTORY_ADDRESS, event: redeemedEvent, fromBlock, toBlock })
      ]);

      let normalized: UserActivityItem[] = [
        ...created.map((log) => ({
          kind: "event_created" as const,
          eventId: (log.args.eventId as bigint) ?? null,
          account: (log.args.creator as `0x${string}`) ?? null,
          amount: null,
          tokenAmount: null,
          side: null,
          eventYesPool: null,
          eventNoPool: null,
          outcome: null,
          txHash: log.transactionHash as `0x${string}`,
          blockNumber: log.blockNumber ?? 0n,
          logIndex: Number(log.logIndex ?? 0)
        })),
        ...bought.map((log) => ({
          kind: "position_bought" as const,
          eventId: (log.args.eventId as bigint) ?? null,
          account: (log.args.user as `0x${string}`) ?? null,
          amount: (log.args.collateralIn as bigint) ?? null,
          tokenAmount: (log.args.tokenAmount as bigint) ?? null,
          side: parsePositionSide(Number(log.args.side ?? -1)),
          eventYesPool: (log.args.yesPool as bigint) ?? null,
          eventNoPool: (log.args.noPool as bigint) ?? null,
          outcome: null,
          txHash: log.transactionHash as `0x${string}`,
          blockNumber: log.blockNumber ?? 0n,
          logIndex: Number(log.logIndex ?? 0)
        })),
        ...proposed.map((log) => ({
          kind: "resolution_proposed" as const,
          eventId: (log.args.eventId as bigint) ?? null,
          account: (log.args.proposer as `0x${string}`) ?? null,
          amount: null,
          tokenAmount: null,
          side: null,
          eventYesPool: null,
          eventNoPool: null,
          outcome: Number(log.args.outcome ?? 0) as Outcome,
          txHash: log.transactionHash as `0x${string}`,
          blockNumber: log.blockNumber ?? 0n,
          logIndex: Number(log.logIndex ?? 0)
        })),
        ...finalized.map((log) => ({
          kind: "resolution_finalized" as const,
          eventId: (log.args.eventId as bigint) ?? null,
          account: null,
          amount: null,
          tokenAmount: null,
          side: null,
          eventYesPool: null,
          eventNoPool: null,
          outcome: Number(log.args.outcome ?? 0) as Outcome,
          txHash: log.transactionHash as `0x${string}`,
          blockNumber: log.blockNumber ?? 0n,
          logIndex: Number(log.logIndex ?? 0)
        })),
        ...redeemed.map((log) => ({
          kind: "redeemed" as const,
          eventId: (log.args.eventId as bigint) ?? null,
          account: (log.args.user as `0x${string}`) ?? null,
          amount: (log.args.payout as bigint) ?? null,
          tokenAmount: null,
          side: null,
          eventYesPool: null,
          eventNoPool: null,
          outcome: Number(log.args.outcome ?? 0) as Outcome,
          txHash: log.transactionHash as `0x${string}`,
          blockNumber: log.blockNumber ?? 0n,
          logIndex: Number(log.logIndex ?? 0)
        }))
      ];

      if (eventId) {
        normalized = normalized.filter((item) => item.eventId === eventId);
      }

      normalized = await backfillFinalizedAccounts(publicClient, normalized);

      const sorted = sortActivitiesDesc(normalized);
      const page = paginateActivities(sorted, cursor, limit);
      return {
        ...page,
        scannedToBlock: latestBlock
      };
    },
    initialData: {
      items: [],
      total: 0,
      cursor,
      limit,
      nextCursor: null,
      prevCursor: null,
      source: "chain",
      scannedToBlock: null
    }
  });
}
