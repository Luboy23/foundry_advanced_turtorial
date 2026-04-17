"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address, RuntimeConfig } from "@/types/contract-config";
import { readRoleStatus } from "@/lib/contracts/query";
import { CHAIN_STATE_STALE_TIME } from "@/lib/query-defaults";
import { queryKeys } from "@/lib/query-keys";
import { hasConfiguredContracts } from "@/lib/runtime-config";
import { usePublicClient } from "wagmi";

/** `useRoleStatus` 的输入参数。 */
type UseRoleStatusArgs = {
  config: RuntimeConfig;
  walletAddress?: Address;
  enabled?: boolean;
};

/** 查询当前钱包地址在链上的角色状态。 */
export function useRoleStatus({ config, walletAddress, enabled = true }: UseRoleStatusArgs) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: queryKeys.roleStatus(config, walletAddress),
    enabled: Boolean(publicClient && walletAddress && enabled && hasConfiguredContracts(config)),
    staleTime: CHAIN_STATE_STALE_TIME,
    queryFn: () => readRoleStatus(publicClient!, config, walletAddress!)
  });
}
