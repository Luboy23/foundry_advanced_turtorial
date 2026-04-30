import { createPublicClient, http } from "viem";
import { creatorRevenueChain } from "@/lib/wagmi";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";

const clientCache = new Map<string, ReturnType<typeof createPublicClient>>();

export function createServerPublicClient() {
  const config = readRuntimeConfigForScript();
  const cacheKey = `${config.chainId}:${config.rpcUrl}`;
  const cached = clientCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const client = createPublicClient({
    chain: {
      ...creatorRevenueChain,
      id: config.chainId,
      rpcUrls: { default: { http: [config.rpcUrl] } }
    },
    transport: http(config.rpcUrl)
  });
  clientCache.set(cacheKey, client);
  return client;
}
