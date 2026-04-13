"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createRuntimeReadClient } from "@/lib/blockchain/read-client";
import type { ContractConfig } from "@/types/contract-config";

// 检查前端当前连接的链是否存在项目所需的三份核心合约代码。
// 这一步只负责“部署是否存在”，不负责判断钱包角色或业务状态。
export function useChainConsistency(args: {
  config: ContractConfig;
  enabled?: boolean;
}) {
  const { config, enabled = true } = args;
  const runtimeReadClient = useMemo(() => createRuntimeReadClient(config), [config]);

  const query = useQuery({
    queryKey: [
      "chain-consistency",
      config.chainId,
      config.admissionRoleRegistryAddress,
      config.scoreRootRegistryAddress,
      config.universityAdmissionVerifierAddress,
      config.rpcUrl
    ],
    enabled: Boolean(enabled),
    queryFn: async () => {
      // 三份合约同时存在时，页面才认为当前链和本项目运行时配置是一致的。
      const [roleRegistryCode, scoreRegistryCode, verifierCode] = await Promise.all([
        runtimeReadClient.getBytecode({
          address: config.admissionRoleRegistryAddress
        }),
        runtimeReadClient.getBytecode({
          address: config.scoreRootRegistryAddress
        }),
        runtimeReadClient.getBytecode({
          address: config.universityAdmissionVerifierAddress
        })
      ]);

      return Boolean(roleRegistryCode && scoreRegistryCode && verifierCode);
    }
  });

  const missingDeployment = query.isSuccess && query.data === false;
  const isChecking = Boolean(enabled && (query.isLoading || query.fetchStatus === "fetching"));

  return {
    isChecking,
    isConsistent: query.isError ? true : !missingDeployment,
    isError: false,
    error: null,
    message: missingDeployment
      ? "当前项目运行链上未检测到已部署合约。请重新执行 make dev，等待部署完成后再刷新页面。"
      : null
  };
}
