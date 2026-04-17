"use client";

import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain, useWalletClient } from "wagmi";

/**
 * 统一读取钱包连接状态，并包装连接、切链、断开等基础动作。
 *
 * 这个 Hook 只负责钱包层面的事实状态，不负责把错误翻译成用户文案。
 */
export function useWalletStatus(expectedChainId: number) {
  const { address, connector, isConnected } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const activeConnector = connector ?? connectors[0];
  const stableAddress = address;
  const stableChainId = chainId || expectedChainId;
  const stableIsConnected = isConnected;
  const wrongChain = stableIsConnected && stableChainId !== expectedChainId;

  return {
    address: stableAddress,
    chainId: stableChainId,
    connectorName: connector?.name ?? null,
    isConnected: stableIsConnected,
    hasWalletClient: Boolean(walletClient),
    wrongChain,
    isConnecting,
    isSwitching,
    connectError,
    /** 连接钱包；如果没有可用 connector，会直接抛出错误。 */
    async connectWallet() {
      if (!activeConnector) {
        throw new Error("未检测到可用的账户连接方式。");
      }

      await connectAsync({ connector: activeConnector });
    },
    /** 切换到项目要求的链；当前链已正确时直接返回。 */
    async switchToExpectedChain() {
      if (!wrongChain) return;
      await switchChainAsync({ chainId: expectedChainId });
    },
    /** 主动断开当前钱包连接。 */
    disconnectWallet() {
      disconnect();
    }
  };
}

export type WalletStatus = ReturnType<typeof useWalletStatus>;
