"use client";

import { useMemo } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  createRuntimeReadClient,
  resolveReadClientState,
  toWalletReadClient
} from "@/lib/blockchain/read-client";
import type { ContractConfig } from "@/types/contract-config";

// 统一组装前端读链客户端。
// 优先复用钱包所在链的读取能力；如果钱包未连接或链不匹配，则回退到运行时配置里的 RPC。
export function useReadClient(config: ContractConfig) {
  const { address, chainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const fallbackReadClient = useMemo(() => createRuntimeReadClient(config), [config]);
  const walletReadClient = useMemo(
    () => toWalletReadClient(walletClient, config.chainId),
    [config.chainId, walletClient]
  );

  return useMemo(
    () =>
      resolveReadClientState({
        config,
        fallbackReadClient,
        walletConnected: isConnected,
        walletAddress: address,
        walletChainId: chainId,
        walletReadClient
      }),
    [address, chainId, config, fallbackReadClient, isConnected, walletReadClient]
  );
}
