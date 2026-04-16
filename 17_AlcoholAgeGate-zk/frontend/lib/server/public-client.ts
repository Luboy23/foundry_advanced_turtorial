import "server-only";

import { createPublicClient, http } from "viem";
import { foundry } from "viem/chains";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";
import { unixTimestampToUtcYmd } from "@/lib/domain/age-eligibility";

type LatestBlockCache = {
  rpcUrl: string;
  expiresAt: number;
  blockNumber: bigint;
  timestamp: number;
};

let publicClientCache: ReturnType<typeof createPublicClient> | null = null;
let publicClientCacheKey: string | null = null;
let latestBlockCache: LatestBlockCache | null = null;

export function getServerRuntimeConfig() {
  return readRuntimeConfigForScript();
}

export function getServerPublicClient() {
  const config = getServerRuntimeConfig();
  if (publicClientCache && publicClientCacheKey === config.rpcUrl) {
    return publicClientCache;
  }

  publicClientCache = createPublicClient({
    chain: foundry,
    transport: http(config.rpcUrl)
  });
  publicClientCacheKey = config.rpcUrl;
  return publicClientCache;
}

export async function getCachedLatestBlock() {
  const config = getServerRuntimeConfig();
  const now = Date.now();

  if (latestBlockCache && latestBlockCache.rpcUrl === config.rpcUrl && latestBlockCache.expiresAt > now) {
    return latestBlockCache;
  }

  const publicClient = getServerPublicClient();
  const block = await publicClient.getBlock({ blockTag: "latest" });
  latestBlockCache = {
    rpcUrl: config.rpcUrl,
    expiresAt: now + 5_000,
    blockNumber: block.number ?? 0n,
    timestamp: Number(block.timestamp)
  };

  return latestBlockCache;
}

export async function getCachedCurrentUtcDateYmd() {
  const latestBlock = await getCachedLatestBlock();
  return unixTimestampToUtcYmd(latestBlock.timestamp);
}
