import "server-only";

import { createPublicClient, http } from "viem";
import type { Address } from "@/types/contract-config";
import type { BenefitClaimRecord, CredentialSetPublishRecord } from "@/types/domain";
import { readClaimHistory, readCredentialSetPublishHistory } from "@/lib/contracts/query";
import { EVENT_HISTORY_STALE_TIME } from "@/lib/query-defaults";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";

type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

type EventHistoryCacheState = {
  claimHistory: Map<string, CacheEntry<BenefitClaimRecord[]>>;
  credentialSetPublishHistory: Map<string, CacheEntry<CredentialSetPublishRecord[]>>;
};

declare global {
  var __EVENT_HISTORY_CACHE__: EventHistoryCacheState | undefined;
}

/** 读取或初始化当前进程内的事件历史缓存。 */
function getEventHistoryCache() {
  if (!globalThis.__EVENT_HISTORY_CACHE__) {
    globalThis.__EVENT_HISTORY_CACHE__ = {
      claimHistory: new Map(),
      credentialSetPublishHistory: new Map()
    };
  }

  return globalThis.__EVENT_HISTORY_CACHE__;
}

/** 创建服务端只读 public client，供 API route 聚合链上历史。 */
function getPublicClient() {
  const config = readRuntimeConfigForScript();
  return createPublicClient({
    transport: http(config.rpcUrl)
  });
}

/** 统一复用短 TTL 的 Promise 缓存，避免多个请求同时回扫同一段事件历史。 */
async function readCached<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  loader: () => Promise<T>,
  ttl = EVENT_HISTORY_STALE_TIME
) {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = loader().catch((error) => {
    const latest = cache.get(key);
    if (latest?.promise === promise) {
      cache.delete(key);
    }
    throw error;
  });

  cache.set(key, {
    expiresAt: now + ttl,
    promise
  });

  return promise;
}

/** 从服务端聚合当前部署的领取历史；可按申请人地址筛选。 */
export async function readAggregatedClaimHistory(recipient?: Address) {
  const config = readRuntimeConfigForScript();
  const publicClient = getPublicClient();
  const cache = getEventHistoryCache();
  const key = `${config.chainId}:${config.deploymentId}:claims:${recipient?.toLowerCase() ?? "all"}`;

  return readCached(cache.claimHistory, key, () => readClaimHistory(publicClient, config, recipient));
}

/** 从服务端聚合资格名单发布历史。 */
export async function readAggregatedCredentialSetPublishHistory() {
  const config = readRuntimeConfigForScript();
  const publicClient = getPublicClient();
  const cache = getEventHistoryCache();
  const key = `${config.chainId}:${config.deploymentId}:credential-set-publish-history`;

  return readCached(cache.credentialSetPublishHistory, key, () => readCredentialSetPublishHistory(publicClient, config));
}
