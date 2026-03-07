"use client";

import { useCallback, useEffect, useState } from "react";
import { parseAbiItem, zeroAddress, formatEther } from "viem";
import { usePublicClient } from "wagmi";

import {
  CONTRACTS_READY,
  MARKET_ADDRESS,
  MARKET_FEATURE_READY,
  NFT_ADDRESS
} from "@/lib/contracts";
import { shortAddress } from "@/lib/format";
import { useMarketStore } from "@/store/marketStore";

const MAX_ACTIVITY = 40;
const ZERO_ADDR_LOWER = zeroAddress.toLowerCase();

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);
const approvalEvent = parseAbiItem(
  "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)"
);
const approvalForAllEvent = parseAbiItem(
  "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)"
);
const listedEvent = parseAbiItem(
  "event Listed(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId, uint256 price)"
);
const cancelledEvent = parseAbiItem(
  "event Cancelled(uint256 indexed listingId)"
);
const boughtEvent = parseAbiItem(
  "event Bought(uint256 indexed listingId, address indexed buyer)"
);
const invalidatedEvent = parseAbiItem(
  "event Invalidated(uint256 indexed listingId, address indexed caller)"
);

type LogBase<TArgs extends Record<string, unknown>> = {
  args: TArgs;
  blockNumber?: bigint;
  logIndex?: number;
  transactionHash?: `0x${string}`;
};

export type ChainActivityScope = "mint_ops" | "market_trades";
export type ChainTradeSide = "buy" | "sell";
export type ChainActivityTone = "emerald" | "rose" | "amber" | "sky";

export type ChainActivityType =
  | "mint"
  | "burn"
  | "approve"
  | "approve_all"
  | "listed"
  | "cancelled"
  | "bought"
  | "invalidated";

export type ChainActivityItem = {
  id: string;
  type: ChainActivityType;
  kind: ChainActivityType;
  tone: ChainActivityTone;
  label: string;
  detail?: string;
  status: "success";
  txHash?: `0x${string}`;
  timestamp?: number;
  blockNumber?: bigint;
  logIndex?: number;
  tokenId?: bigint;
  price?: bigint;
  buyer?: `0x${string}`;
  seller?: `0x${string}`;
  listingId?: bigint;
  tradeSides?: ChainTradeSide[];
};

// 统一格式化链上 price 字段，避免组件层重复转换
const formatPrice = (price: bigint) => {
  const amount = Number(formatEther(price));
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
};

const chainOrderDesc = (
  a: { blockNumber?: bigint; logIndex?: number },
  b: { blockNumber?: bigint; logIndex?: number }
) => {
  const aBlock = a.blockNumber ?? BigInt(0);
  const bBlock = b.blockNumber ?? BigInt(0);
  if (aBlock === bBlock) {
    return (b.logIndex ?? 0) - (a.logIndex ?? 0);
  }
  return aBlock > bBlock ? -1 : 1;
};

const buildId = (
  type: ChainActivityType,
  txHash?: `0x${string}`,
  blockNumber?: bigint,
  logIndex?: number
) =>
  `${type}-${txHash ?? "nohash"}-${blockNumber?.toString() ?? "0"}-${logIndex ?? 0}`;

export const useChainActivity = (scope: ChainActivityScope = "mint_ops") => {
  const publicClient = usePublicClient();
  const refreshNonce = useMarketStore((state) => state.refreshNonce);
  const [items, setItems] = useState<ChainActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const loadActivity = useCallback(async () => {
    if (!publicClient || !CONTRACTS_READY) {
      setItems([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 统一中间层结构：两类 scope 都先映射成 ChainActivityItem
      const entries: ChainActivityItem[] = [];

      if (scope === "mint_ops") {
        const [transferLogs, approvalLogs, approvalForAllLogs] = await Promise.all([
          publicClient.getLogs({
            address: NFT_ADDRESS as `0x${string}`,
            event: transferEvent,
            fromBlock: BigInt(0),
            toBlock: "latest"
          }) as Promise<
            Array<
              LogBase<{
                from?: `0x${string}`;
                to?: `0x${string}`;
                tokenId?: bigint;
              }>
            >
          >,
          publicClient.getLogs({
            address: NFT_ADDRESS as `0x${string}`,
            event: approvalEvent,
            fromBlock: BigInt(0),
            toBlock: "latest"
          }) as Promise<
            Array<
              LogBase<{
                owner?: `0x${string}`;
                approved?: `0x${string}`;
                tokenId?: bigint;
              }>
            >
          >,
          publicClient.getLogs({
            address: NFT_ADDRESS as `0x${string}`,
            event: approvalForAllEvent,
            fromBlock: BigInt(0),
            toBlock: "latest"
          }) as Promise<
            Array<
              LogBase<{
                owner?: `0x${string}`;
                operator?: `0x${string}`;
                approved?: boolean;
              }>
            >
          >
        ]);

        for (const log of transferLogs) {
          const from = log.args.from;
          const to = log.args.to;
          const tokenId = log.args.tokenId;
          if (!from || !to || tokenId === undefined) continue;

          const fromLower = from.toLowerCase();
          const toLower = to.toLowerCase();
          if (fromLower === ZERO_ADDR_LOWER) {
            // from=0 代表 mint
            entries.push({
              id: buildId("mint", log.transactionHash, log.blockNumber, log.logIndex),
              type: "mint",
              kind: "mint",
              tone: "emerald",
              label: `铸造 NFT #${tokenId.toString()}`,
              detail: `接收者 ${shortAddress(to)}`,
              status: "success",
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              logIndex: log.logIndex,
              tokenId
            });
            continue;
          }

          if (toLower === ZERO_ADDR_LOWER) {
            // to=0 代表 burn
            entries.push({
              id: buildId("burn", log.transactionHash, log.blockNumber, log.logIndex),
              type: "burn",
              kind: "burn",
              tone: "rose",
              label: `销毁 NFT #${tokenId.toString()}`,
              detail: `操作者 ${shortAddress(from)}`,
              status: "success",
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              logIndex: log.logIndex,
              tokenId
            });
          }
        }

        for (const log of approvalLogs) {
          const owner = log.args.owner;
          const approved = log.args.approved;
          const tokenId = log.args.tokenId;
          if (!owner || !approved || tokenId === undefined) continue;
          entries.push({
            id: buildId("approve", log.transactionHash, log.blockNumber, log.logIndex),
            type: "approve",
            kind: "approve",
            tone: "sky",
            label: `授权 NFT #${tokenId.toString()}`,
            detail: `${shortAddress(owner)} -> ${shortAddress(approved)}`,
            status: "success",
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
            tokenId
          });
        }

        for (const log of approvalForAllLogs) {
          const owner = log.args.owner;
          const operator = log.args.operator;
          const approved = log.args.approved;
          if (!owner || !operator || approved === undefined) continue;
          entries.push({
            id: buildId(
              "approve_all",
              log.transactionHash,
              log.blockNumber,
              log.logIndex
            ),
            type: "approve_all",
            kind: "approve_all",
            tone: "sky",
            label: approved ? "开启全局授权" : "取消全局授权",
            detail: `${shortAddress(owner)} -> ${shortAddress(operator)}`,
            status: "success",
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex
          });
        }
      } else {
        if (!MARKET_FEATURE_READY) {
          setItems([]);
          setLastUpdated(Date.now());
          return;
        }

        const [listedLogs, cancelledLogs, boughtLogs, invalidatedLogs] =
          await Promise.all([
            publicClient.getLogs({
              address: MARKET_ADDRESS as `0x${string}`,
              event: listedEvent,
              fromBlock: BigInt(0),
              toBlock: "latest"
            }) as Promise<
              Array<
                LogBase<{
                  listingId?: bigint;
                  seller?: `0x${string}`;
                  tokenId?: bigint;
                  price?: bigint;
                }>
              >
            >,
            publicClient.getLogs({
              address: MARKET_ADDRESS as `0x${string}`,
              event: cancelledEvent,
              fromBlock: BigInt(0),
              toBlock: "latest"
            }) as Promise<Array<LogBase<{ listingId?: bigint }>>>,
            publicClient.getLogs({
              address: MARKET_ADDRESS as `0x${string}`,
              event: boughtEvent,
              fromBlock: BigInt(0),
              toBlock: "latest"
            }) as Promise<
              Array<LogBase<{ listingId?: bigint; buyer?: `0x${string}` }>>
            >,
            publicClient.getLogs({
              address: MARKET_ADDRESS as `0x${string}`,
              event: invalidatedEvent,
              fromBlock: BigInt(0),
              toBlock: "latest"
            }) as Promise<
              Array<LogBase<{ listingId?: bigint; caller?: `0x${string}` }>>
            >
          ]);

        const listedMap = new Map<
          string,
          { tokenId?: bigint; seller?: `0x${string}`; price?: bigint }
        >();
        // 先收集 listed 元数据，供 cancelled/bought/invalidated 做关联展示
        for (const log of listedLogs) {
          const listingId = log.args.listingId;
          if (listingId === undefined) continue;
          listedMap.set(listingId.toString(), {
            tokenId: log.args.tokenId,
            seller: log.args.seller,
            price: log.args.price
          });
        }

        for (const log of listedLogs) {
          const listingId = log.args.listingId;
          const seller = log.args.seller;
          const tokenId = log.args.tokenId;
          const price = log.args.price;
          if (
            listingId === undefined ||
            !seller ||
            tokenId === undefined ||
            price === undefined
          ) {
            continue;
          }
          entries.push({
            id: buildId("listed", log.transactionHash, log.blockNumber, log.logIndex),
            type: "listed",
            kind: "listed",
            tone: "rose",
            label: `上架 NFT #${tokenId.toString()}`,
            detail: `挂单 #${listingId.toString()} · ${formatPrice(price)} ETH`,
            status: "success",
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
            tokenId,
            price,
            seller,
            listingId,
            tradeSides: ["sell"]
          });
        }

        for (const log of cancelledLogs) {
          const listingId = log.args.listingId;
          if (listingId === undefined) continue;
          const meta = listedMap.get(listingId.toString());
          entries.push({
            id: buildId(
              "cancelled",
              log.transactionHash,
              log.blockNumber,
              log.logIndex
            ),
            type: "cancelled",
            kind: "cancelled",
            tone: "amber",
            label:
              meta?.tokenId !== undefined
                ? `取消上架 NFT #${meta.tokenId.toString()}`
                : `取消挂单 #${listingId.toString()}`,
            detail: `挂单 #${listingId.toString()}`,
            status: "success",
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
            tokenId: meta?.tokenId,
            price: meta?.price,
            seller: meta?.seller,
            listingId,
            tradeSides: ["sell"]
          });
        }

        for (const log of boughtLogs) {
          const listingId = log.args.listingId;
          const buyer = log.args.buyer;
          if (listingId === undefined) continue;
          const meta = listedMap.get(listingId.toString());
          entries.push({
            id: buildId("bought", log.transactionHash, log.blockNumber, log.logIndex),
            type: "bought",
            kind: "bought",
            tone: "emerald",
            label:
              meta?.tokenId !== undefined
                ? `成交 NFT #${meta.tokenId.toString()}`
                : `成交挂单 #${listingId.toString()}`,
            detail: buyer
              ? `买家 ${shortAddress(buyer)} · 挂单 #${listingId.toString()}`
              : `挂单 #${listingId.toString()}`,
            status: "success",
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
            tokenId: meta?.tokenId,
            price: meta?.price,
            buyer,
            seller: meta?.seller,
            listingId,
            // 成交在语义上既属于买入，也属于卖出
            tradeSides: ["buy", "sell"]
          });
        }

        for (const log of invalidatedLogs) {
          const listingId = log.args.listingId;
          const caller = log.args.caller;
          if (listingId === undefined) continue;
          const meta = listedMap.get(listingId.toString());
          entries.push({
            id: buildId(
              "invalidated",
              log.transactionHash,
              log.blockNumber,
              log.logIndex
            ),
            type: "invalidated",
            kind: "invalidated",
            tone: "amber",
            label:
              meta?.tokenId !== undefined
                ? `清理失效挂单 NFT #${meta.tokenId.toString()}`
                : `清理失效挂单 #${listingId.toString()}`,
            detail: caller
              ? `操作者 ${shortAddress(caller)} · 挂单 #${listingId.toString()}`
              : `挂单 #${listingId.toString()}`,
            status: "success",
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
            tokenId: meta?.tokenId,
            price: meta?.price,
            seller: meta?.seller,
            listingId,
            tradeSides: ["sell"]
          });
        }
      }

      const sorted = [...entries].sort(chainOrderDesc).slice(0, MAX_ACTIVITY);
      if (sorted.length === 0) {
        setItems([]);
        setLastUpdated(Date.now());
        return;
      }

      const blockNumbers = Array.from(
        new Set(
          sorted
            .map((item) => item.blockNumber)
            .filter((value): value is bigint => value !== undefined)
            .map((value) => value.toString())
        )
      );

      const timestampMap = new Map<string, number>();
      await Promise.all(
        blockNumbers.map(async (blockNumber) => {
          const block = await publicClient.getBlock({
            blockNumber: BigInt(blockNumber)
          });
          timestampMap.set(blockNumber, Number(block.timestamp) * 1000);
        })
      );

      setItems(
        sorted.map((item) => ({
          ...item,
          // 回填 timestamp，保证刷新后仍可回放时间线
          timestamp: item.blockNumber
            ? timestampMap.get(item.blockNumber.toString())
            : undefined
        }))
      );
      setLastUpdated(Date.now());
    } catch {
      setError(scope === "market_trades" ? "链上交易记录加载失败" : "链上操作记录加载失败");
    } finally {
      setLoading(false);
    }
  }, [publicClient, scope]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    if (refreshNonce > 0) {
      loadActivity();
    }
  }, [refreshNonce, loadActivity]);

  return {
    items,
    loading,
    error,
    lastUpdated,
    loadActivity
  };
};
