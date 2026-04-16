"use client";

import { useSyncExternalStore } from "react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain, useWalletClient } from "wagmi";

const subscribeHydration = () => () => {};

export function useWalletStatus(expectedChainId: number) {
  const { address, connector, isConnected } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const isHydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);

  const activeConnector = connector ?? connectors[0];
  const stableAddress = address;
  const stableChainId = chainId || expectedChainId;
  const stableIsConnected = isConnected;
  const wrongChain = stableIsConnected && stableChainId !== expectedChainId;

  return {
    isHydrated,
    address: stableAddress,
    chainId: stableChainId,
    connectorName: connector?.name ?? null,
    isConnected: stableIsConnected,
    hasWalletClient: Boolean(walletClient),
    wrongChain,
    isConnecting,
    isSwitching,
    connectError,
    async connectWallet() {
      if (!activeConnector) {
        throw new Error("未发现可用的钱包连接器。");
      }

      await connectAsync({ connector: activeConnector });
    },
    async switchToExpectedChain() {
      if (!wrongChain) return;
      await switchChainAsync({ chainId: expectedChainId });
    },
    disconnectWallet() {
      disconnect();
    }
  };
}
