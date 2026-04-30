"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http } from "viem";
import { scopedQueryKey } from "@/lib/query-keys";
import type { RuntimeConfig } from "@/types/contract-config";
import { creatorRevenueChain } from "@/lib/wagmi";
import { hasConfiguredContracts } from "@/lib/runtime-config";

export function useChainConsistency(args: {
  config: RuntimeConfig;
  enabled?: boolean;
}) {
  const { config, enabled = true } = args;
  const configured = hasConfiguredContracts(config);

  const client = useMemo(
    () =>
      createPublicClient({
        chain: {
          ...creatorRevenueChain,
          id: config.chainId,
          rpcUrls: {
            default: {
              http: [config.rpcUrl]
            }
          }
        },
        transport: http(config.rpcUrl)
      }),
    [config.chainId, config.rpcUrl]
  );

  const query = useQuery({
    queryKey: scopedQueryKey(
      config,
      "chain-consistency",
      config.rpcUrl,
      config.batchRegistryAddress,
      config.distributorAddress
    ),
    enabled: Boolean(enabled && configured),
    staleTime: 30_000,
    gcTime: 5 * 60 * 1_000,
    queryFn: async () => {
      const [batchRegistryCode, distributorCode] = await Promise.all([
        client.getBytecode({ address: config.batchRegistryAddress }),
        client.getBytecode({ address: config.distributorAddress })
      ]);

      return Boolean(batchRegistryCode && distributorCode);
    }
  });

  if (!configured) {
    return {
      isChecking: false,
      isConsistent: false,
      isError: false,
      error: null,
      message: "当前前端尚未拿到可用部署配置，请重新执行 make dev 或刷新页面。"
    };
  }

  const isChecking = Boolean(enabled && (query.isLoading || query.fetchStatus === "fetching"));
  const isConsistent = query.isError ? false : Boolean(query.data);

  return {
    isChecking,
    isConsistent,
    isError: query.isError,
    error: query.error,
    message: query.isError
      ? "当前无法读取项目链上状态，请刷新页面或重新执行 make dev。"
      : !isChecking && !isConsistent
        ? "当前项目链上未检测到已部署合约，请重新执行 make dev，等待部署完成后再刷新页面。"
        : null
  };
}
