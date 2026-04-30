import { isAddress } from "viem";
import { normalizeBatchLabelMap } from "@/lib/batch-labels";
import type { Address, BatchLabelMap, DemoAddresses, RuntimeConfig } from "@/types/contract-config";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = 31337;
const DEFAULT_INDEXER_BASE_URL = "http://127.0.0.1:42069";
const DEFAULT_BATCH_ID =
  "0x17c6c9f1db18f6f0c61bb64abd0c4f7766db5f1b3ce71f0f12dbf7595bd53d4f" as const;

type RuntimeConfigInput = Omit<Partial<RuntimeConfig>, "chainId" | "startBlock" | "batchLabelMap"> & {
  chainId?: number | string;
  startBlock?: number | string;
  batchLabelMap?: BatchLabelMap | string;
};

function normalizeAddress(value: unknown): Address {
  return typeof value === "string" && isAddress(value) ? (value as Address) : ZERO_ADDRESS;
}

function normalizeChainId(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIN_ID;
}

function normalizeNonNegativeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeBatchLabelMapInput(value: unknown): BatchLabelMap {
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      return normalizeBatchLabelMap(JSON.parse(value));
    } catch {
      return {};
    }
  }

  return normalizeBatchLabelMap(value);
}

function normalizeDemoAddresses(input: Partial<DemoAddresses> | undefined): DemoAddresses {
  return {
    platform: normalizeAddress(input?.platform),
    creator: normalizeAddress(input?.creator),
    collaboratorA: normalizeAddress(input?.collaboratorA),
    collaboratorB: normalizeAddress(input?.collaboratorB)
  };
}

export function normalizeRuntimeConfig(input: RuntimeConfigInput): RuntimeConfig {
  return {
    batchRegistryAddress: normalizeAddress(input.batchRegistryAddress),
    distributorAddress: normalizeAddress(input.distributorAddress),
    chainId: normalizeChainId(input.chainId),
    rpcUrl: normalizeString(input.rpcUrl, DEFAULT_RPC_URL),
    deploymentId: normalizeString(input.deploymentId, "creator-revenue-center-static"),
    demoAddresses: normalizeDemoAddresses(input.demoAddresses),
    activeBatchId: (normalizeString(input.activeBatchId, DEFAULT_BATCH_ID) as `0x${string}`),
    activeBatchLabel: normalizeString(input.activeBatchLabel, "2026-04"),
    activeBillId: normalizeString(input.activeBillId, "BILL-202604-CREATOR"),
    activeBatchRoot: typeof input.activeBatchRoot === "string" ? (input.activeBatchRoot as `0x${string}`) : undefined,
    activeMetadataHash:
      typeof input.activeMetadataHash === "string" ? (input.activeMetadataHash as `0x${string}`) : undefined,
    startBlock: normalizeNonNegativeNumber(input.startBlock, 0),
    indexerBaseUrl: normalizeString(input.indexerBaseUrl, DEFAULT_INDEXER_BASE_URL),
    batchLabelMap: normalizeBatchLabelMapInput(input.batchLabelMap)
  };
}

const envConfig = normalizeRuntimeConfig({
  batchRegistryAddress: process.env.NEXT_PUBLIC_BATCH_REGISTRY_ADDRESS as Address | undefined,
  distributorAddress: process.env.NEXT_PUBLIC_DISTRIBUTOR_ADDRESS as Address | undefined,
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
  deploymentId: process.env.NEXT_PUBLIC_DEPLOYMENT_ID,
  startBlock: process.env.NEXT_PUBLIC_START_BLOCK,
  indexerBaseUrl: process.env.NEXT_PUBLIC_INDEXER_BASE_URL,
  batchLabelMap: process.env.NEXT_PUBLIC_BATCH_LABEL_MAP
});

export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") {
    return envConfig;
  }

  return normalizeRuntimeConfig({
    ...envConfig,
    ...(window.__APP_RUNTIME_CONFIG__ ?? {})
  });
}

export function getZeroAddress() {
  return ZERO_ADDRESS;
}

export function hasConfiguredContracts(config: RuntimeConfig) {
  return config.batchRegistryAddress !== ZERO_ADDRESS && config.distributorAddress !== ZERO_ADDRESS;
}

export function getRuntimeFailureHistoryScope(config: RuntimeConfig, address?: string | null) {
  return `${config.chainId}:${config.deploymentId}:${address ?? "anonymous"}`;
}
