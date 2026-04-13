import {
  createPublicClient,
  defineChain,
  http,
  publicActions,
  type PublicClient,
  type WalletClient
} from "viem";
import type { ContractConfig } from "@/types/contract-config";

export type ReadClient = Pick<
  PublicClient,
  "getBlock" | "getBytecode" | "getLogs" | "readContract" | "waitForTransactionReceipt"
>;

export type ReadClientMode = "wallet" | "runtime" | "pending-wallet";

export type ReadClientState = {
  client: ReadClient | null;
  sourceKey: string;
  mode: ReadClientMode;
  isReady: boolean;
  isUsingFallback: boolean;
  isWrongChain: boolean;
};

function createRuntimeChain(config: ContractConfig) {
  const rpcUrl = config.rpcUrl ?? "http://127.0.0.1:8545";

  return defineChain({
    id: config.chainId,
    name: `Runtime Chain ${config.chainId}`,
    nativeCurrency: {
      decimals: 18,
      name: "Ether",
      symbol: "ETH"
    },
    rpcUrls: {
      default: {
        http: [rpcUrl]
      }
    }
  });
}

export function createRuntimeReadClient(config: ContractConfig): ReadClient {
  const rpcUrl = config.rpcUrl ?? "http://127.0.0.1:8545";

  return createPublicClient({
    chain: createRuntimeChain(config),
    transport: http(rpcUrl)
  });
}

export function toWalletReadClient(
  walletClient: WalletClient | null | undefined,
  expectedChainId: number
): ReadClient | null {
  if (!walletClient || walletClient.chain?.id !== expectedChainId) {
    return null;
  }

  return walletClient.extend(publicActions) as unknown as ReadClient;
}

export function resolveReadClientState(args: {
  config: ContractConfig;
  fallbackReadClient: ReadClient;
  walletConnected: boolean;
  walletAddress?: `0x${string}`;
  walletChainId?: number;
  walletReadClient: ReadClient | null | undefined;
}): ReadClientState {
  const { config, fallbackReadClient, walletConnected, walletAddress, walletChainId, walletReadClient } = args;
  const runtimeSourceKey = `rpc:${config.rpcUrl ?? "http://127.0.0.1:8545"}`;
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? "unknown";

  if (!walletConnected) {
    return {
      client: fallbackReadClient,
      sourceKey: runtimeSourceKey,
      mode: "runtime",
      isReady: true,
      isUsingFallback: true,
      isWrongChain: false
    };
  }

  if (walletChainId !== undefined && walletChainId !== config.chainId) {
    return {
      client: null,
      sourceKey: `wrong-chain:${normalizedWalletAddress}:${walletChainId}:${config.chainId}`,
      mode: "pending-wallet",
      isReady: false,
      isUsingFallback: false,
      isWrongChain: true
    };
  }

  if (!walletReadClient) {
    return {
      client: null,
      sourceKey: `pending-wallet:${normalizedWalletAddress}:${config.chainId}`,
      mode: "pending-wallet",
      isReady: false,
      isUsingFallback: false,
      isWrongChain: false
    };
  }

  return {
    client: walletReadClient,
    sourceKey: `wallet:${normalizedWalletAddress}:${config.chainId}`,
    mode: "wallet",
    isReady: true,
    isUsingFallback: false,
    isWrongChain: false
  };
}
