"use client";

import { useMemo } from "react";
import { usePublicClient } from "wagmi";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useRoleStatus } from "@/hooks/useRoleStatus";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { resolveRoleAccess, roleKeys, type RoleAccessState, type RoleKey } from "@/lib/role-access";
import { hasConfiguredContracts } from "@/lib/runtime-config";

/**
 * 聚合钱包状态、链状态和角色状态的顶层 Hook。
 *
 * 页面和导航基本都只依赖这个 Hook，而不需要分别处理钱包连接、链切换和链上角色查询。
 */
export function useRoleAccess() {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const publicClient = usePublicClient();
  const isConfigured = hasConfiguredContracts(config);

  const roleStatusQuery = useRoleStatus({
    config,
    walletAddress: wallet.address,
    enabled: wallet.isConnected && !wallet.wrongChain && isConfigured
  });

  const roleStatusLoading = Boolean(
    wallet.isConnected &&
      !wallet.wrongChain &&
      isConfigured &&
      !roleStatusQuery.isError &&
      (!publicClient || roleStatusQuery.isPending || (roleStatusQuery.isFetching && !roleStatusQuery.data))
  );
  const roleStatusError = Boolean(
    wallet.isConnected && !wallet.wrongChain && isConfigured && roleStatusQuery.isError && !roleStatusQuery.data
  );

  // accessByRole 把底层状态统一转换成 UI 可直接消费的阻塞原因和提示文案。
  const accessByRole = useMemo(
    () =>
      roleKeys.reduce<Record<RoleKey, RoleAccessState>>((result, role) => {
        result[role] = resolveRoleAccess({
          role,
          walletConnected: wallet.isConnected,
          wrongChain: wallet.wrongChain,
          roleStatus: roleStatusQuery.data,
          roleStatusLoading,
          roleStatusError,
          demoAddresses: config.demoAddresses
        });
        return result;
      }, {} as Record<RoleKey, RoleAccessState>),
    [config.demoAddresses, roleStatusError, roleStatusLoading, roleStatusQuery.data, wallet.isConnected, wallet.wrongChain]
  );

  return {
    config,
    wallet,
    publicClient,
    isConfigured,
    roleStatusQuery,
    accessByRole
  };
}
