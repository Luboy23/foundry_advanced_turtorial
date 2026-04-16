import { isAddress } from "viem";
import type { Address, RuntimeConfig } from "@/types/contract-config";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = 31337;
const DEFAULT_DEMO_ADDRESSES = {
  issuer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  buyer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  seller: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
} as const satisfies Record<string, Address>;

type RuntimeConfigInput = {
  roleRegistryAddress?: string;
  rootRegistryAddress?: string;
  eligibilityVerifierAddress?: string;
  marketplaceAddress?: string;
  verifierAddress?: string;
  chainId?: number | string;
  rpcUrl?: string;
  deploymentId?: string;
  demoAddresses?: Partial<Record<keyof RuntimeConfig["demoAddresses"], string>>;
  zkArtifactPaths?: Partial<RuntimeConfig["zkArtifactPaths"]>;
};

function normalizeAddress(value: unknown): Address {
  return typeof value === "string" && isAddress(value) ? (value as Address) : ZERO_ADDRESS;
}

function normalizeChainId(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIN_ID;
}

function normalizeRpcUrl(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : DEFAULT_RPC_URL;
}

function normalizeDeploymentId(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "static";
}

export function normalizeRuntimeConfig(input: RuntimeConfigInput): RuntimeConfig {
  return {
    roleRegistryAddress: normalizeAddress(input.roleRegistryAddress),
    rootRegistryAddress: normalizeAddress(input.rootRegistryAddress),
    eligibilityVerifierAddress: normalizeAddress(input.eligibilityVerifierAddress),
    marketplaceAddress: normalizeAddress(input.marketplaceAddress),
    verifierAddress: normalizeAddress(input.verifierAddress),
    chainId: normalizeChainId(input.chainId),
    rpcUrl: normalizeRpcUrl(input.rpcUrl),
    deploymentId: normalizeDeploymentId(input.deploymentId),
    demoAddresses: {
      issuer: normalizeAddress(input.demoAddresses?.issuer ?? DEFAULT_DEMO_ADDRESSES.issuer),
      buyer: normalizeAddress(input.demoAddresses?.buyer ?? DEFAULT_DEMO_ADDRESSES.buyer),
      seller: normalizeAddress(input.demoAddresses?.seller ?? DEFAULT_DEMO_ADDRESSES.seller)
    },
    zkArtifactPaths: {
      wasm: input.zkArtifactPaths?.wasm ?? "/zk/alcohol_age_proof.wasm",
      zkey: input.zkArtifactPaths?.zkey ?? "/zk/alcohol_age_proof_final.zkey"
    }
  };
}

const envConfig = normalizeRuntimeConfig({
  roleRegistryAddress: process.env.NEXT_PUBLIC_ROLE_REGISTRY_ADDRESS,
  rootRegistryAddress: process.env.NEXT_PUBLIC_ROOT_REGISTRY_ADDRESS,
  eligibilityVerifierAddress: process.env.NEXT_PUBLIC_ELIGIBILITY_VERIFIER_ADDRESS,
  marketplaceAddress: process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS,
  verifierAddress: process.env.NEXT_PUBLIC_VERIFIER_ADDRESS,
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
  deploymentId: process.env.NEXT_PUBLIC_DEPLOYMENT_ID
});

export function getEnvRuntimeConfig() {
  return envConfig;
}

export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") {
    return envConfig;
  }

  return normalizeRuntimeConfig({
    ...envConfig,
    ...(window.__APP_RUNTIME_CONFIG__ ?? {})
  });
}

export function hasConfiguredContracts(config: RuntimeConfig) {
  return (
    config.roleRegistryAddress !== ZERO_ADDRESS &&
    config.rootRegistryAddress !== ZERO_ADDRESS &&
    config.eligibilityVerifierAddress !== ZERO_ADDRESS &&
    config.marketplaceAddress !== ZERO_ADDRESS
  );
}

export function getZeroAddress() {
  return ZERO_ADDRESS;
}

export function getRuntimeFailureHistoryScope(config: RuntimeConfig) {
  return `${config.chainId}:${config.deploymentId}`;
}
