"use client";

import { useSyncExternalStore } from "react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";

// 通过 useSyncExternalStore 明确区分服务端首屏和客户端 hydration 之后的钱包状态。
// 在 wagmi 启用 ssr 之后，这个快照切换会发生在 mount effect 之后，不会再撞上 render-phase update。
const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

// 统一收敛钱包连接、切链和 hydration 稳定值。
export function useWalletStatus(expectedChainId: number) {
  const { address, connector, isConnected } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const chainId = useChainId();
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  );

  const activeConnector = connectors[0];
  const stableAddress = isHydrated ? address : undefined;
  const stableChainId = isHydrated ? chainId : expectedChainId;
  const stableIsConnected = isHydrated ? isConnected : false;
  const wrongChain = stableIsConnected && stableChainId !== expectedChainId;

  return {
    isHydrated,
    address: stableAddress,
    chainId: stableChainId,
    connectorName: isHydrated ? connector?.name ?? null : null,
    isConnected: stableIsConnected,
    wrongChain,
    isConnecting,
    isSwitching,
    connectError: isHydrated ? connectError : null,
    async connectWallet() {
      // 当前项目默认只走第一个可用连接器，减少教学场景下的钱包选择复杂度。
      if (!activeConnector) {
        throw new Error("未发现可用的钱包连接器。");
      }
      await connectAsync({ connector: activeConnector });
    },
    async switchToExpectedChain() {
      // 链错误不属于角色错误，因此允许页面继续存在，只要求用户切到项目链。
      if (!wrongChain) return;
      await switchChainAsync({ chainId: expectedChainId });
    },
    disconnectWallet() {
      disconnect();
    }
  };
}
