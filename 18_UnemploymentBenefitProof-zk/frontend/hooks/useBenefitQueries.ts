"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { fetchGovernmentCredentialSetState } from "@/lib/government-credential-sets.client";
import { fetchClaimHistory, fetchCredentialSetPublishHistory } from "@/lib/history.client";
import {
  readCurrentCredentialSetOrNull,
  readHasClaimed,
  readProgram
} from "@/lib/contracts/query";
import { CHAIN_STATE_STALE_TIME, EVENT_HISTORY_STALE_TIME } from "@/lib/query-defaults";
import { queryKeys } from "@/lib/query-keys";
import { hasConfiguredContracts } from "@/lib/runtime-config";
import type { Address, RuntimeConfig } from "@/types/contract-config";
import type { PublicClient } from "viem";

/** 统一复用上一轮成功数据，避免 refetch 时页面闪回空白态。 */
function keepPreviousData<T>(previousData: T | undefined) {
  return previousData;
}

/** 判断当前查询是否具备链上读取所需的最小前提。 */
function isConfiguredQueryEnabled(
  publicClient: PublicClient | undefined,
  config: RuntimeConfig,
  enabled: boolean
) {
  return Boolean(publicClient && enabled && hasConfiguredContracts(config));
}

/** 读取当前链上资格名单；若尚未发布则返回空态，不把业务空状态伪装成异常。 */
export function useCurrentCredentialSetQuery({
  config,
  enabled = true
}: {
  config: RuntimeConfig;
  enabled?: boolean;
}) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: queryKeys.currentCredentialSet(config),
    enabled: isConfiguredQueryEnabled(publicClient, config, enabled),
    staleTime: CHAIN_STATE_STALE_TIME,
    placeholderData: keepPreviousData,
    queryFn: () => readCurrentCredentialSetOrNull(publicClient!, config)
  });
}

/** 读取当前补助项目配置与资金池余额。 */
export function useProgramQuery({
  config,
  enabled = true
}: {
  config: RuntimeConfig;
  enabled?: boolean;
}) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: queryKeys.program(config),
    enabled: isConfiguredQueryEnabled(publicClient, config, enabled),
    staleTime: CHAIN_STATE_STALE_TIME,
    placeholderData: keepPreviousData,
    queryFn: () => readProgram(publicClient!, config)
  });
}

/** 读取指定账户是否已领取过补助。 */
export function useHasClaimedQuery({
  config,
  walletAddress,
  enabled = true
}: {
  config: RuntimeConfig;
  walletAddress?: Address;
  enabled?: boolean;
}) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: queryKeys.hasClaimed(config, walletAddress),
    enabled: Boolean(walletAddress) && isConfiguredQueryEnabled(publicClient, config, enabled),
    staleTime: CHAIN_STATE_STALE_TIME,
    queryFn: () => readHasClaimed(publicClient!, config, walletAddress!)
  });
}

/** 读取当前部署的补助领取历史；可按领取地址筛选。 */
export function useClaimHistoryQuery({
  config,
  walletAddress,
  enabled = true
}: {
  config: RuntimeConfig;
  walletAddress?: Address;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.claimHistory(config, walletAddress),
    enabled: Boolean(enabled && hasConfiguredContracts(config)),
    staleTime: EVENT_HISTORY_STALE_TIME,
    placeholderData: keepPreviousData,
    queryFn: () => fetchClaimHistory(walletAddress)
  });
}

/** 读取资格名单发布历史。 */
export function useCredentialSetPublishHistoryQuery({
  config,
  enabled = true
}: {
  config: RuntimeConfig;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.credentialSetPublishHistory(config),
    enabled: Boolean(enabled && hasConfiguredContracts(config)),
    staleTime: EVENT_HISTORY_STALE_TIME,
    placeholderData: keepPreviousData,
    queryFn: () => fetchCredentialSetPublishHistory()
  });
}

/** 读取政府工作台需要的服务端聚合状态。 */
export function useGovernmentCredentialSetStateQuery({
  config,
  walletAddress,
  enabled = true
}: {
  config: RuntimeConfig;
  walletAddress?: Address;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.governmentCredentialSetState(config, walletAddress),
    enabled,
    staleTime: 0,
    queryFn: () => fetchGovernmentCredentialSetState()
  });
}

/**
 * 提前预取申请人核验页马上会用到的链上状态。
 *
 * 申请人一旦具备可用凭证，就把资格名单、项目状态和本人领取状态提前拉进缓存，切页时只
 * 需要命中缓存或做轻量校验，减少“进入核验页后才开始等 RPC”的体感。
 */
export async function prefetchApplicantVerificationQueries(args: {
  queryClient: QueryClient;
  publicClient: PublicClient;
  config: RuntimeConfig;
  walletAddress: Address;
}) {
  const { queryClient, publicClient, config, walletAddress } = args;

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.currentCredentialSet(config),
      staleTime: CHAIN_STATE_STALE_TIME,
      queryFn: () => readCurrentCredentialSetOrNull(publicClient, config)
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.program(config),
      staleTime: CHAIN_STATE_STALE_TIME,
      queryFn: () => readProgram(publicClient, config)
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.hasClaimed(config, walletAddress),
      staleTime: CHAIN_STATE_STALE_TIME,
      queryFn: () => readHasClaimed(publicClient, config, walletAddress)
    })
  ]);
}
