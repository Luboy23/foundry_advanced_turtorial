"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { parseAbiItem, parseEther } from "viem";

import {
  MARKET_ADDRESS,
  MARKET_FEATURE_READY,
  marketAbi,
  NFT_ADDRESS,
  nftAbi
} from "@/lib/contracts";
import { useMarketStore } from "@/store/marketStore";
import { resolveMetadata, type NftMetadata } from "@/hooks/useGalleryData";

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

type ListingStatus = "active" | "cancelled" | "bought" | "invalidated";

export type MarketListing = {
  listingId: bigint;
  seller: `0x${string}`;
  tokenId: bigint;
  price: bigint;
  active: boolean;
  status: ListingStatus;
  valid: boolean;
  owner?: string;
  tokenUri?: string;
  metadata: NftMetadata;
  blockNumber?: bigint;
  logIndex?: number;
  createdAt?: number;
};

const toErrorMessage = (error: unknown) => {
  if (error && typeof error === "object") {
    const known = error as { shortMessage?: string; message?: string };
    return known.shortMessage ?? known.message ?? "未知错误";
  }
  if (typeof error === "string") return error;
  return "未知错误";
};

const getLogOrder = (blockNumber?: bigint, logIndex?: number) => ({
  block: blockNumber ?? BigInt(0),
  index: logIndex ?? 0
});

const sortByChainOrder = <
  T extends { blockNumber?: bigint; logIndex?: number }
>(
  logs: T[]
) =>
  [...logs].sort((a, b) => {
    const left = getLogOrder(a.blockNumber, a.logIndex);
    const right = getLogOrder(b.blockNumber, b.logIndex);
    if (left.block === right.block) {
      return left.index - right.index;
    }
    return left.block < right.block ? -1 : 1;
  });

export const useMarketListings = () => {
  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const bumpRefresh = useMarketStore((state) => state.bumpRefresh);
  const refreshNonce = useMarketStore((state) => state.refreshNonce);

  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const loadListings = useCallback(async () => {
    if (!publicClient || !MARKET_FEATURE_READY) return;
    setLoading(true);
    setError(null);
    try {
      const [listedLogs, cancelledLogs, boughtLogs, invalidatedLogs] =
        await Promise.all([
          publicClient.getLogs({
            address: MARKET_ADDRESS as `0x${string}`,
            event: listedEvent,
            fromBlock: BigInt(0),
            toBlock: "latest"
          }),
          publicClient.getLogs({
            address: MARKET_ADDRESS as `0x${string}`,
            event: cancelledEvent,
            fromBlock: BigInt(0),
            toBlock: "latest"
          }),
          publicClient.getLogs({
            address: MARKET_ADDRESS as `0x${string}`,
            event: boughtEvent,
            fromBlock: BigInt(0),
            toBlock: "latest"
          }),
          publicClient.getLogs({
            address: MARKET_ADDRESS as `0x${string}`,
            event: invalidatedEvent,
            fromBlock: BigInt(0),
            toBlock: "latest"
          })
        ]);

      const timeline = [
        ...listedLogs.map((log) => ({ type: "listed" as const, log })),
        ...cancelledLogs.map((log) => ({ type: "cancelled" as const, log })),
        ...boughtLogs.map((log) => ({ type: "bought" as const, log })),
        ...invalidatedLogs.map((log) => ({ type: "invalidated" as const, log }))
      ];

      const sortedTimeline = sortByChainOrder(
        timeline.map((entry) => ({
          ...entry,
          blockNumber: entry.log.blockNumber,
          logIndex: entry.log.logIndex
        }))
      );

      const map = new Map<string, MarketListing>();
      for (const entry of sortedTimeline) {
        const listingId = entry.log.args.listingId as bigint | undefined;
        if (listingId === undefined) continue;
        const key = listingId.toString();

        if (entry.type === "listed") {
          const seller = entry.log.args.seller as `0x${string}` | undefined;
          const tokenId = entry.log.args.tokenId as bigint | undefined;
          const price = entry.log.args.price as bigint | undefined;
          if (!seller || tokenId === undefined || price === undefined) {
            continue;
          }
          map.set(key, {
            listingId,
            seller,
            tokenId,
            price,
            active: true,
            status: "active",
            valid: false,
            metadata: {},
            blockNumber: entry.log.blockNumber,
            logIndex: entry.log.logIndex
          });
          continue;
        }

        // 非 listed 事件用于覆盖同一 listing 的最终状态
        const existing = map.get(key);
        if (!existing) continue;
        existing.active = false;
        existing.valid = false;
        existing.status =
          entry.type === "cancelled"
            ? "cancelled"
            : entry.type === "bought"
              ? "bought"
              : "invalidated";
      }

      const records = Array.from(map.values());
      const createdBlocks = Array.from(
        new Set(
          records
            .map((record) => record.blockNumber)
            .filter((block): block is bigint => block !== undefined)
            .map((block) => block.toString())
        )
      );
      const timestampMap = new Map<string, number>();
      await Promise.all(
        createdBlocks.map(async (blockNumber) => {
          const block = await publicClient.getBlock({
            blockNumber: BigInt(blockNumber)
          });
          timestampMap.set(blockNumber, Number(block.timestamp) * 1000);
        })
      );

      const hydrated = await Promise.all(
        records.map(async (record) => {
          const createdAt = record.blockNumber
            ? timestampMap.get(record.blockNumber.toString())
            : undefined;
          if (!record.active) {
            return { ...record, createdAt };
          }

          // active 挂单额外做链上有效性探测（owner + approval）
          const sellerLower = record.seller.toLowerCase();
          let owner: string | undefined;
          let tokenUri = "";
          let valid = false;
          try {
            owner = (await publicClient.readContract({
              address: NFT_ADDRESS as `0x${string}`,
              abi: nftAbi,
              functionName: "ownerOf",
              args: [record.tokenId]
            })) as string;
          } catch {
            owner = undefined;
          }

          if (owner && owner.toLowerCase() === sellerLower) {
            let approved = false;
            try {
              const approvedAddress = (await publicClient.readContract({
                address: NFT_ADDRESS as `0x${string}`,
                abi: nftAbi,
                functionName: "getApproved",
                args: [record.tokenId]
              })) as string;
              approved =
                approvedAddress.toLowerCase() === MARKET_ADDRESS.toLowerCase();
            } catch {
              approved = false;
            }
            if (!approved) {
              try {
                approved = (await publicClient.readContract({
                  address: NFT_ADDRESS as `0x${string}`,
                  abi: nftAbi,
                  functionName: "isApprovedForAll",
                  args: [record.seller, MARKET_ADDRESS as `0x${string}`]
                })) as boolean;
              } catch {
                approved = false;
              }
            }
            valid = approved;
          }

          try {
            tokenUri = (await publicClient.readContract({
              address: NFT_ADDRESS as `0x${string}`,
              abi: nftAbi,
              functionName: "tokenURI",
              args: [record.tokenId]
            })) as string;
          } catch {
            tokenUri = "";
          }

          const metadata = tokenUri ? await resolveMetadata(tokenUri) : {};
          return {
            ...record,
            owner,
            tokenUri,
            metadata,
            valid,
            createdAt
          };
        })
      );

      hydrated.sort((a, b) => {
        const left = getLogOrder(a.blockNumber, a.logIndex);
        const right = getLogOrder(b.blockNumber, b.logIndex);
        if (left.block === right.block) {
          return right.index - left.index;
        }
        return left.block > right.block ? -1 : 1;
      });

      setListings(hydrated);
      setLastUpdated(Date.now());
    } catch {
      setError("市场数据加载失败");
    } finally {
      setLoading(false);
    }
  }, [publicClient]);

  const runTx = useCallback(
    async ({
      request,
      pendingKey
    }: {
      request: {
        address: `0x${string}`;
        abi: typeof marketAbi | typeof nftAbi;
        functionName: string;
        args?: readonly unknown[];
        value?: bigint;
      };
      pendingKey: string;
    }) => {
      if (!publicClient) {
        throw new Error("RPC 不可用");
      }
      setPendingActionKey(pendingKey);
      try {
        if (address) {
          // 交易前预检，可把 revert 原因提前反馈给用户
          await publicClient.simulateContract({
            address: request.address,
            abi: request.abi,
            functionName: request.functionName as never,
            args: (request.args ?? []) as never,
            value: request.value,
            account: address
          });
        }

        const hash = (await writeContractAsync({
          address: request.address,
          abi: request.abi,
          functionName: request.functionName as never,
          args: (request.args ?? []) as never,
          value: request.value
        })) as `0x${string}`;

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1
        });
        if (receipt.status !== "success") {
          throw new Error("交易执行失败");
        }

        return hash;
      } finally {
        setPendingActionKey(null);
      }
    },
    [publicClient, address, writeContractAsync]
  );

  const ensureUserReady = useCallback(() => {
    if (!MARKET_FEATURE_READY) {
      throw new Error("未配置市场合约地址");
    }
    if (!publicClient) {
      throw new Error("RPC 不可用");
    }
    if (!isConnected || !address) {
      throw new Error("请先连接钱包");
    }
  }, [publicClient, isConnected, address]);

  const approveAndList = useCallback(
    async (tokenId: bigint, priceEth: string) => {
      ensureUserReady();
      const normalized = priceEth.trim();
      if (!normalized) {
        throw new Error("请输入价格");
      }

      let priceWei: bigint;
      try {
        priceWei = parseEther(normalized);
      } catch {
        throw new Error("价格格式错误");
      }
      if (priceWei <= BigInt(0)) {
        throw new Error("价格必须大于 0");
      }

      const activeListing = (await publicClient!.readContract({
        address: MARKET_ADDRESS as `0x${string}`,
        abi: marketAbi,
        functionName: "activeListingByToken",
        args: [tokenId]
      })) as bigint;
      if (activeListing > BigInt(0)) {
        throw new Error("该 NFT 已有挂单，请先取消或清理");
      }

      const owner = (await publicClient!.readContract({
        address: NFT_ADDRESS as `0x${string}`,
        abi: nftAbi,
        functionName: "ownerOf",
        args: [tokenId]
      })) as string;
      if (owner.toLowerCase() !== address!.toLowerCase()) {
        throw new Error("你不是该 NFT 的持有人");
      }

      const approvedAddress = (await publicClient!.readContract({
        address: NFT_ADDRESS as `0x${string}`,
        abi: nftAbi,
        functionName: "getApproved",
        args: [tokenId]
      })) as string;

      let approved = approvedAddress.toLowerCase() === MARKET_ADDRESS.toLowerCase();
      if (!approved) {
        approved = (await publicClient!.readContract({
          address: NFT_ADDRESS as `0x${string}`,
          abi: nftAbi,
          functionName: "isApprovedForAll",
          args: [address!, MARKET_ADDRESS as `0x${string}`]
        })) as boolean;
      }

      if (!approved) {
        // 一键上架体验：未授权时自动补一笔 approve
        await runTx({
          pendingKey: `approve-${tokenId.toString()}`,
          request: {
            address: NFT_ADDRESS as `0x${string}`,
            abi: nftAbi,
            functionName: "approve",
            args: [MARKET_ADDRESS, tokenId]
          }
        });
      }

      await runTx({
        pendingKey: `list-${tokenId.toString()}`,
        request: {
          address: MARKET_ADDRESS as `0x${string}`,
          abi: marketAbi,
          functionName: "list",
          args: [tokenId, priceWei]
        }
      });

      bumpRefresh();
      await loadListings();
    },
    [ensureUserReady, publicClient, address, runTx, bumpRefresh, loadListings]
  );

  const cancelListing = useCallback(
    async (listingId: bigint) => {
      ensureUserReady();
      await runTx({
        pendingKey: `cancel-${listingId.toString()}`,
        request: {
          address: MARKET_ADDRESS as `0x${string}`,
          abi: marketAbi,
          functionName: "cancel",
          args: [listingId]
        }
      });
      bumpRefresh();
      await loadListings();
    },
    [ensureUserReady, runTx, bumpRefresh, loadListings]
  );

  const invalidateListing = useCallback(
    async (listingId: bigint) => {
      ensureUserReady();
      await runTx({
        pendingKey: `invalidate-${listingId.toString()}`,
        request: {
          address: MARKET_ADDRESS as `0x${string}`,
          abi: marketAbi,
          functionName: "invalidate",
          args: [listingId]
        }
      });
      bumpRefresh();
      await loadListings();
    },
    [ensureUserReady, runTx, bumpRefresh, loadListings]
  );

  const buyListing = useCallback(
    async (listing: MarketListing) => {
      ensureUserReady();
      try {
        await runTx({
          pendingKey: `buy-${listing.listingId.toString()}`,
          request: {
            address: MARKET_ADDRESS as `0x${string}`,
            abi: marketAbi,
            functionName: "buy",
            args: [listing.listingId],
            value: listing.price
          }
        });
      } catch (error) {
        const message = toErrorMessage(error);
        // 非托管挂单常见失效场景：owner 改变/授权撤销/已成交
        if (
          message.includes("stale owner") ||
          message.includes("stale approval") ||
          message.includes("inactive")
        ) {
          await loadListings();
          throw new Error("挂单已失效");
        }
        throw new Error(message);
      }
      bumpRefresh();
      await loadListings();
    },
    [ensureUserReady, runTx, bumpRefresh, loadListings]
  );

  useEffect(() => {
    // 首次进入页面自动索引一次市场状态
    if (!MARKET_FEATURE_READY) return;
    loadListings();
  }, [loadListings]);

  useEffect(() => {
    // 监听全局刷新信号（如铸造、上架、购买成功后）
    if (!MARKET_FEATURE_READY) return;
    if (refreshNonce > 0) {
      loadListings();
    }
  }, [refreshNonce, loadListings]);

  const activeTokenListingMap = useMemo(() => {
    // 以 tokenId 建索引，便于“我的藏品”页 O(1) 查询是否已挂单
    const map = new Map<string, MarketListing>();
    for (const listing of listings) {
      if (!listing.active) continue;
      map.set(listing.tokenId.toString(), listing);
    }
    return map;
  }, [listings]);

  return {
    listings,
    loading,
    error,
    pendingActionKey,
    lastUpdated,
    activeTokenListingMap,
    isReady: MARKET_FEATURE_READY,
    loadListings,
    approveAndList,
    cancelListing,
    invalidateListing,
    buyListing
  };
};
