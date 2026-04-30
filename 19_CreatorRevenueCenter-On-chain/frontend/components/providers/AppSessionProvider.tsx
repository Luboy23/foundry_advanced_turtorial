"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain, useWalletClient } from "wagmi";
import { resolveRoleIdentity, type RoleIdentity } from "@/lib/roles";
import type { DemoAddresses } from "@/types/contract-config";

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

export type AppWalletStatus = {
  isHydrated: boolean;
  address?: `0x${string}`;
  chainId: number;
  connectorId: string | null;
  connectorName: string | null;
  isConnected: boolean;
  wrongChain: boolean;
  hasWalletClient: boolean;
  isWriteReady: boolean;
  writeDisabledReason: string | null;
  availableConnectors: Array<{ id: string; name: string }>;
  isConnecting: boolean;
  isSwitching: boolean;
  connectError: unknown;
  connectWallet: (targetConnectorId?: string) => Promise<void>;
  switchToExpectedChain: () => Promise<void>;
  disconnectWallet: () => void;
};

type AppSessionValue = {
  wallet: AppWalletStatus;
  roleIdentity: RoleIdentity;
};

const AppSessionContext = createContext<AppSessionValue | null>(null);

function useAppWalletStatus(expectedChainId: number): AppWalletStatus {
  const { address, connector, isConnected } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { data: walletClient } = useWalletClient({ chainId: expectedChainId });
  const chainId = useChainId();
  const [providerChainId, setProviderChainId] = useState<number | null>(null);
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  );

  const activeConnector =
    connectors.find((item) => item.id === connector?.id) ??
    (connectors.length === 1 ? connectors[0] : connectors.find((item) => item.id === "injected")) ??
    null;
  const observedConnector = connector ?? activeConnector;
  const stableAddress = isHydrated ? address : undefined;
  const stableIsConnected = isHydrated ? isConnected : false;
  const stableChainId = isHydrated ? (stableIsConnected ? providerChainId ?? chainId : expectedChainId) : expectedChainId;
  const wrongChain = stableIsConnected && stableChainId !== expectedChainId;
  const hasWalletClient = isHydrated ? Boolean(walletClient) : false;
  const availableConnectors = connectors.map((item) => ({
    id: item.id,
    name: item.name
  }));
  const writeDisabledReason = !isHydrated
    ? "正在读取当前钱包状态。"
    : !stableIsConnected
      ? "请先连接项目钱包。"
      : wrongChain
        ? "当前网络不正确，请先切换到项目网络。"
        : !hasWalletClient
          ? "当前钱包还未准备好可写客户端，请重新连接钱包或在钱包中授权当前站点。"
          : null;
  const isWriteReady = writeDisabledReason == null;

  useEffect(() => {
    if (!isHydrated || !stableIsConnected || !observedConnector?.getProvider) {
      return;
    }

    let isCancelled = false;
    let cleanup = () => {};

    const syncProviderChain = async (provider: Eip1193Provider, nextChainIdHex?: string) => {
      try {
        const value =
          typeof nextChainIdHex === "string" ? nextChainIdHex : await provider.request({ method: "eth_chainId" });

        if (!isCancelled && typeof value === "string") {
          setProviderChainId(Number(value));
        }
      } catch {
        if (!isCancelled) {
          setProviderChainId(null);
        }
      }
    };

    void observedConnector.getProvider().then((provider) => {
      const eip1193Provider = provider as Eip1193Provider | null;
      if (isCancelled || !eip1193Provider?.request) return;

      const handleChainChanged = (nextChainId: unknown) => {
        void syncProviderChain(eip1193Provider, typeof nextChainId === "string" ? nextChainId : undefined);
      };

      void syncProviderChain(eip1193Provider);
      eip1193Provider.on?.("chainChanged", handleChainChanged);
      cleanup = () => {
        eip1193Provider.removeListener?.("chainChanged", handleChainChanged);
      };
    });

    return () => {
      isCancelled = true;
      cleanup();
    };
  }, [connector?.id, isHydrated, observedConnector, stableIsConnected]);

  return {
    isHydrated,
    address: stableAddress,
    chainId: stableChainId,
    connectorId: isHydrated ? connector?.id ?? null : null,
    connectorName: isHydrated ? connector?.name ?? null : null,
    isConnected: stableIsConnected,
    wrongChain,
    hasWalletClient,
    isWriteReady,
    writeDisabledReason,
    availableConnectors,
    isConnecting,
    isSwitching,
    connectError: isHydrated ? connectError : null,
    async connectWallet(targetConnectorId?: string) {
      const targetConnector =
        (targetConnectorId ? connectors.find((item) => item.id === targetConnectorId) : null) ?? activeConnector;

      if (!targetConnector) {
        if (connectors.length > 1) {
          throw new Error("检测到多个钱包连接器，请先选择并连接一个可写钱包。");
        }

        throw new Error("未发现可用的钱包连接器。");
      }

      await connectAsync({ connector: targetConnector });
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

export function AppSessionProvider({
  children,
  demoAddresses,
  expectedChainId
}: {
  children: ReactNode;
  demoAddresses: DemoAddresses;
  expectedChainId: number;
}) {
  const wallet = useAppWalletStatus(expectedChainId);
  const roleIdentity = useMemo(() => resolveRoleIdentity(wallet.address, demoAddresses), [demoAddresses, wallet.address]);
  const value = useMemo(
    () => ({
      wallet,
      roleIdentity
    }),
    [roleIdentity, wallet]
  );

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSessionContext() {
  const value = useContext(AppSessionContext);
  if (!value) {
    throw new Error("AppSessionProvider is missing.");
  }

  return value;
}
