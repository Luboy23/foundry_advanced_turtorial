"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { parseAbiItem, zeroAddress } from "viem";

import { CONTRACTS_READY, NFT_ADDRESS, nftAbi } from "@/lib/contracts";
import { useMarketStore } from "@/store/marketStore";

// 教学主方案为 HTTP；这里保留 ipfs:// 兼容读取，避免历史数据无法展示
const LEGACY_IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://ipfs.io/ipfs/";
const LEGACY_IPFS_GATEWAY_FALLBACK =
  process.env.NEXT_PUBLIC_IPFS_FALLBACK_GATEWAY ??
  "https://cloudflare-ipfs.com/ipfs/";
const ZERO_BIGINT = BigInt(0);

// 内存级缓存，避免重复拉取同一个 tokenURI
const metadataCache = new Map<string, NftMetadata>();

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);

export type GalleryMode = "mine" | "community";

export type NftMetadata = {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  collection?: string;
};

export type NftItem = {
  tokenId: bigint;
  owner: string;
  tokenUri: string;
  metadata: NftMetadata;
  mintedOrder: number;
  mintedBlock?: bigint;
  mintedLogIndex?: number;
  mintedTimestamp?: number;
};

// 兼容 data:application/json;base64, 的链上元数据
const decodeBase64Json = (base64: string) => {
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    return JSON.parse(decoded) as NftMetadata;
  } catch (error) {
    return {};
  }
};

export const resolveIpfs = (uri: string, gateway = LEGACY_IPFS_GATEWAY) => {
  if (uri.startsWith("ipfs://")) {
    return `${gateway}${uri.replace("ipfs://", "")}`;
  }
  return uri;
};

export const resolveIpfsFallback = (uri: string) =>
  resolveIpfs(uri, LEGACY_IPFS_GATEWAY_FALLBACK);

// 优先读取 data:/http(s)；仅在遇到 ipfs:// 时走网关兼容
export const resolveMetadata = async (uri: string) => {
  if (!uri) return {};

  if (metadataCache.has(uri)) {
    return metadataCache.get(uri) ?? {};
  }

  if (uri.startsWith("data:application/json;base64,")) {
    const base64 = uri.split(",")[1] ?? "";
    return decodeBase64Json(base64);
  }

  if (uri.startsWith("data:application/json,")) {
    try {
      const json = decodeURIComponent(uri.split(",")[1] ?? "");
      return JSON.parse(json) as NftMetadata;
    } catch (error) {
      return {};
    }
  }

  const resolved = resolveIpfs(uri);
  if (resolved.startsWith("http")) {
    try {
      const response = await fetch(resolved);
      if (response.ok) {
        const data = (await response.json()) as NftMetadata;
        metadataCache.set(uri, data);
        return data;
      }
    } catch (error) {
      // fallthrough to fallback
    }
  }

  const fallback = resolveIpfsFallback(uri);
  if (fallback.startsWith("http")) {
    try {
      const response = await fetch(fallback);
      if (!response.ok) return {};
      const data = (await response.json()) as NftMetadata;
      metadataCache.set(uri, data);
      return data;
    } catch (error) {
      return {};
    }
  }

  return {};
};

export const resolveImage = (image?: string) => {
  if (!image) return "";
  if (image.startsWith("data:image")) return image;
  // image 字段可能仍是 ipfs://，这里统一转成可加载 URL
  return resolveIpfs(image);
};

export const useGalleryData = ({
  mode,
  onRequireConnect
}: {
  mode: GalleryMode;
  onRequireConnect?: () => void;
}) => {
  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();
  const refreshNonce = useMarketStore((state) => state.refreshNonce);
  const [items, setItems] = useState<NftItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingTokenId, setPendingTokenId] = useState<bigint | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const pageSize = mode === "community" ? 12 : 9;
  const [visibleCount, setVisibleCount] = useState(pageSize);
  // 首次加载失败后仅重试一次，避免进入无限重试
  const retryRef = useRef(0);
  const { writeContractAsync } = useWriteContract();

  const updateItemMetadata = useCallback(
    (tokenId: bigint, metadata: NftMetadata) => {
      setItems((prev) =>
        prev.map((item) =>
          item.tokenId === tokenId ? { ...item, metadata } : item
        )
      );
    },
    []
  );

  const ensureMetadata = useCallback(
    async (tokenId: bigint, tokenUri: string) => {
      if (!tokenUri) return;
      // 元数据采用懒加载，首屏先渲染骨架，进入视口后再补齐
      const data = await resolveMetadata(tokenUri);
      updateItemMetadata(tokenId, data);
    },
    [updateItemMetadata]
  );

  const loadItems = useCallback(async () => {
    if (!publicClient || !CONTRACTS_READY) return;
    setLoading(true);
    setError(null);
    try {
      // 通过 Transfer(0x0 -> owner) 事件回溯所有铸造记录
      const logs = await publicClient.getLogs({
        address: NFT_ADDRESS as `0x${string}`,
        event: transferEvent,
        args: { from: zeroAddress },
        fromBlock: ZERO_BIGINT,
        toBlock: "latest"
      });

      // 保持按区块/日志顺序稳定排序，保证展示顺序可预测
      const sortedLogs = [...logs].sort((a, b) => {
        const aBlock = a.blockNumber ?? ZERO_BIGINT;
        const bBlock = b.blockNumber ?? ZERO_BIGINT;
        if (aBlock === bBlock) {
          return (a.logIndex ?? 0) - (b.logIndex ?? 0);
        }
        return aBlock < bBlock ? -1 : 1;
      });

      const tokenIds: bigint[] = [];
      const seen = new Set<string>();
      const mintMeta = new Map<
        string,
        { order: number; blockNumber?: bigint; logIndex?: number }
      >();

      // 去重 tokenId，并记录铸造顺序与所在区块
      for (const log of sortedLogs) {
        const tokenId = log.args.tokenId as bigint | undefined;
        // tokenId=0 是合法值，不能用 falsy 判断过滤
        if (tokenId === undefined) continue;
        const key = tokenId.toString();
        if (seen.has(key)) continue;
        seen.add(key);
        tokenIds.push(tokenId);
        mintMeta.set(key, {
          order: tokenIds.length - 1,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex
        });
      }

      // 批量读取区块时间戳（减少 RPC 次数）
      const blockNumbers = Array.from(
        new Set(
          Array.from(mintMeta.values())
            .map((meta) => meta.blockNumber)
            .filter(
              (blockNumber): blockNumber is bigint =>
                blockNumber !== undefined
            )
            .map((blockNumber) => blockNumber.toString())
        )
      );

      const blockTimestampMap = new Map<string, number>();
      await Promise.all(
        blockNumbers.map(async (blockNumber) => {
          const block = await publicClient.getBlock({
            blockNumber: BigInt(blockNumber)
          });
          blockTimestampMap.set(
            blockNumber,
            Number(block.timestamp) * 1000
          );
        })
      );

      const entries = await Promise.all(
        tokenIds.map(async (tokenId) => {
          const [owner, tokenUri] = await Promise.all([
            publicClient.readContract({
              address: NFT_ADDRESS as `0x${string}`,
              abi: nftAbi,
              functionName: "ownerOf",
              args: [tokenId]
            }) as Promise<string>,
            publicClient.readContract({
              address: NFT_ADDRESS as `0x${string}`,
              abi: nftAbi,
              functionName: "tokenURI",
              args: [tokenId]
            }) as Promise<string>
          ]);

          const meta = mintMeta.get(tokenId.toString());
          const mintedTimestamp = meta?.blockNumber
            ? blockTimestampMap.get(meta.blockNumber.toString())
            : undefined;

          return {
            tokenId,
            owner,
            tokenUri,
            metadata: {},
            mintedOrder: meta?.order ?? 0,
            mintedBlock: meta?.blockNumber,
            mintedLogIndex: meta?.logIndex,
            mintedTimestamp
          } as NftItem;
        })
      );

      // 先写基础链上数据，再由 ensureMetadata 异步填充 metadata
      setItems(entries);
      setLastUpdated(Date.now());
      retryRef.current = 0;
    } catch (loadError) {
      setError("加载失败");
      if (retryRef.current < 1) {
        retryRef.current += 1;
        setTimeout(() => {
          loadItems();
        }, 1200);
      }
    } finally {
      setLoading(false);
    }
  }, [publicClient]);

  const handleBurn = useCallback(
    async (tokenId: bigint) => {
      if (!isConnected) {
        onRequireConnect?.();
        return;
      }
      setActionError(null);
      setPendingTokenId(tokenId);
      try {
        if (publicClient && address) {
          // 先 simulate，提前暴露权限/网络/参数错误
          await publicClient.simulateContract({
            address: NFT_ADDRESS as `0x${string}`,
            abi: nftAbi,
            functionName: "burn",
            args: [tokenId],
            account: address
          });
        }
        await writeContractAsync({
          address: NFT_ADDRESS as `0x${string}`,
          abi: nftAbi,
          functionName: "burn",
          args: [tokenId]
        });
        // 成功后重新拉链上数据，确保 owner 变化立即反映到 UI
        await loadItems();
      } catch (burnError) {
        setActionError(
          burnError instanceof Error ? burnError.message : "销毁失败"
        );
      } finally {
        setPendingTokenId(null);
      }
    },
    [
      address,
      isConnected,
      loadItems,
      onRequireConnect,
      publicClient,
      writeContractAsync
    ]
  );

  useEffect(() => {
    // 社区页不依赖钱包，直接加载；我的藏品页要求已连接
    if (mode === "community") {
      loadItems();
      return;
    }
    if (isConnected) {
      loadItems();
    }
  }, [loadItems, isConnected, mode]);

  useEffect(() => {
    // 市场/铸造动作触发 refreshNonce 后，图库跟随刷新
    if (mode === "community" && refreshNonce > 0) {
      loadItems();
      return;
    }
    if (isConnected && refreshNonce > 0) {
      loadItems();
    }
  }, [refreshNonce, isConnected, loadItems, mode]);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [pageSize, items.length, mode]);

  const filtered = useMemo(() => {
    const lower = address?.toLowerCase();
    // 社区页：时间正序；我的藏品：时间倒序（最近铸造优先）
    const sorted = [...items].sort((a, b) => {
      if (mode === "community") {
        return a.mintedOrder - b.mintedOrder;
      }
      return b.mintedOrder - a.mintedOrder;
    });

    if (mode === "mine") {
      if (!lower) return [];
      return sorted.filter(
        (item) => item.owner.toLowerCase() === lower
      );
    }

    return sorted;
  }, [items, address, mode]);

  const visibleItems = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const hasMore = filtered.length > visibleCount;

  return {
    items,
    filtered,
    visibleItems,
    hasMore,
    pageSize,
    visibleCount,
    setVisibleCount,
    loading,
    error,
    actionError,
    pendingTokenId,
    lastUpdated,
    isConnected,
    address,
    loadItems,
    ensureMetadata,
    handleBurn
  };
};
