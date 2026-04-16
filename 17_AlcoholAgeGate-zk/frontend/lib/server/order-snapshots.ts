import "server-only";

import type { RuntimeConfig, Address } from "@/types/contract-config";
import type { MarketplaceOrder } from "@/types/domain";
import { alcoholMarketplaceAbi } from "@/lib/contracts/abis";
import type { QueryPublicClient } from "@/lib/contracts/query";
import {
  loadMarketplaceOrdersByParty,
  readSyncState,
  upsertMarketplaceOrders,
  writeSyncState
} from "@/lib/server/runtime-db";

const MARKETPLACE_SYNC_KEY = "marketplace-orders:last-synced-block";

let syncPromise: Promise<void> | null = null;

// 订单快照层的目标很明确：把“每次前端全量扫链”改成“服务端按请求增量同步，然后复用本地快照”。
async function syncMarketplaceOrders(publicClient: QueryPublicClient, config: RuntimeConfig) {
  const latestBlockNumber = await publicClient.getBlockNumber();
  const persisted = readSyncState(MARKETPLACE_SYNC_KEY);
  const lastSyncedBlock = persisted ? BigInt(persisted) : null;

  if (lastSyncedBlock !== null && lastSyncedBlock >= latestBlockNumber) {
    return;
  }

  const fromBlock = lastSyncedBlock === null ? "earliest" : lastSyncedBlock + 1n;
  const logs = (await publicClient.getContractEvents({
    abi: alcoholMarketplaceAbi,
    address: config.marketplaceAddress,
    eventName: "ProductPurchased",
    fromBlock,
    toBlock: latestBlockNumber
  })) as Array<{
    args: {
      orderId?: `0x${string}`;
      productId?: `0x${string}`;
      buyer?: Address;
      seller?: Address;
      quantity?: number | bigint;
      totalPriceWei?: bigint | string;
    };
    transactionHash?: `0x${string}`;
    blockHash?: `0x${string}`;
    blockNumber?: bigint;
  }>;

  if (logs.length === 0) {
    writeSyncState(MARKETPLACE_SYNC_KEY, latestBlockNumber.toString());
    return;
  }

  // 先按 blockHash 批量把时间戳查出来，再映射回订单，
  // 避免每一条购买事件都单独再打一次 getBlock RPC。
  const uniqueBlockHashes = [...new Set(logs.map((log) => log.blockHash).filter(Boolean))] as `0x${string}`[];
  const blocks = await Promise.all(
    uniqueBlockHashes.map(async (blockHash) => {
      const block = await publicClient.getBlock({ blockHash });
      return [blockHash, Number(block.timestamp)] as const;
    })
  );
  const blockTimestampMap = new Map(blocks);

  const orders: Array<
    MarketplaceOrder & {
      blockNumber: bigint;
      blockHash: `0x${string}`;
    }
  > = [];

  for (const log of logs) {
    if (
      !log.blockHash ||
      log.blockNumber === undefined ||
      !log.args.orderId ||
      !log.args.productId ||
      !log.args.buyer ||
      !log.args.seller ||
      log.args.quantity === undefined ||
      log.args.totalPriceWei === undefined
    ) {
      continue;
    }

    const purchasedAt = blockTimestampMap.get(log.blockHash);
    if (!purchasedAt) {
      continue;
    }

    orders.push({
      orderId: log.args.orderId,
      productId: log.args.productId,
      buyer: log.args.buyer,
      seller: log.args.seller,
      quantity: Number(log.args.quantity),
      totalPriceWei: BigInt(log.args.totalPriceWei),
      purchasedAt,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      blockHash: log.blockHash
    });
  }

  upsertMarketplaceOrders(orders);
  writeSyncState(MARKETPLACE_SYNC_KEY, latestBlockNumber.toString());
}

export async function ensureMarketplaceOrdersSynced(publicClient: QueryPublicClient, config: RuntimeConfig) {
  if (!syncPromise) {
    // 并发请求共用同一轮同步 Promise，避免高频重复触发同一批链上读取。
    syncPromise = syncMarketplaceOrders(publicClient, config).finally(() => {
      syncPromise = null;
    });
  }

  return syncPromise;
}

export async function readBuyerOrdersSnapshot(
  publicClient: QueryPublicClient,
  config: RuntimeConfig,
  buyer: Address
) {
  await ensureMarketplaceOrdersSynced(publicClient, config);
  return loadMarketplaceOrdersByParty({
    role: "buyer",
    address: buyer
  });
}

export async function readSellerOrdersSnapshot(
  publicClient: QueryPublicClient,
  config: RuntimeConfig,
  seller: Address
) {
  await ensureMarketplaceOrdersSynced(publicClient, config);
  return loadMarketplaceOrdersByParty({
    role: "seller",
    address: seller
  });
}
