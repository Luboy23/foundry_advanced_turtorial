import { isAddress } from "viem";
import type { Address, RuntimeConfig } from "@/types/contract-config";

/**
 * 前端运行时配置归一化工具。
 *
 * 配置会同时来自 `.env` 和服务端注入的 `window.__APP_RUNTIME_CONFIG__`。这一层负责把两份
 * 来源收敛成稳定结构，并在缺项时回退到教学链默认值，避免页面每次都写同样的容错逻辑。
 */
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = 31337;
const DEFAULT_DEMO_ADDRESSES = {
  government: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  applicant: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  agency: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  ineligibleApplicant: "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
} as const satisfies Record<string, Address>;

type RuntimeConfigInput = {
  roleRegistryAddress?: string;
  rootRegistryAddress?: string;
  benefitDistributorAddress?: string;
  verifierAddress?: string;
  chainId?: number | string;
  rpcUrl?: string;
  deploymentId?: string;
  deploymentStartBlock?: number | string;
  demoAddresses?: Partial<Record<keyof RuntimeConfig["demoAddresses"], string>>;
  zkArtifactPaths?: Partial<RuntimeConfig["zkArtifactPaths"]>;
};

/** 把任意输入归一化成合法地址；失败时回退到零地址。 */
function normalizeAddress(value: unknown): Address {
  return typeof value === "string" && isAddress(value) ? (value as Address) : ZERO_ADDRESS;
}

/** 把链 ID 解析成正整数；非法值统一回退到本地教学链。 */
function normalizeChainId(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIN_ID;
}

/** 解析 RPC URL；空值时回退到本地 Anvil 地址。 */
function normalizeRpcUrl(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : DEFAULT_RPC_URL;
}

/** 生成部署作用域标识，用于前端缓存和本地存储隔离。 */
function normalizeDeploymentId(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "static";
}

/** 解析部署起始区块，用于缩小事件查询范围。 */
function normalizeDeploymentStartBlock(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed =
    typeof value === "string" && value.startsWith("0x")
      ? Number.parseInt(value, 16)
      : Number(value);

  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

/** 归一化一份原始运行时配置。 */
export function normalizeRuntimeConfig(input: RuntimeConfigInput): RuntimeConfig {
  return {
    roleRegistryAddress: normalizeAddress(input.roleRegistryAddress),
    rootRegistryAddress: normalizeAddress(input.rootRegistryAddress),
    benefitDistributorAddress: normalizeAddress(input.benefitDistributorAddress),
    verifierAddress: normalizeAddress(input.verifierAddress),
    chainId: normalizeChainId(input.chainId),
    rpcUrl: normalizeRpcUrl(input.rpcUrl),
    deploymentId: normalizeDeploymentId(input.deploymentId),
    deploymentStartBlock: normalizeDeploymentStartBlock(input.deploymentStartBlock),
    demoAddresses: {
      government: normalizeAddress(input.demoAddresses?.government ?? DEFAULT_DEMO_ADDRESSES.government),
      applicant: normalizeAddress(input.demoAddresses?.applicant ?? DEFAULT_DEMO_ADDRESSES.applicant),
      agency: normalizeAddress(input.demoAddresses?.agency ?? DEFAULT_DEMO_ADDRESSES.agency),
      ineligibleApplicant: normalizeAddress(
        input.demoAddresses?.ineligibleApplicant ?? DEFAULT_DEMO_ADDRESSES.ineligibleApplicant
      )
    },
    zkArtifactPaths: {
      wasm: input.zkArtifactPaths?.wasm ?? "/zk/unemployment_benefit_proof.wasm",
      zkey: input.zkArtifactPaths?.zkey ?? "/zk/unemployment_benefit_proof_final.zkey"
    }
  };
}

const envConfig = normalizeRuntimeConfig({
  roleRegistryAddress: process.env.NEXT_PUBLIC_ROLE_REGISTRY_ADDRESS,
  rootRegistryAddress: process.env.NEXT_PUBLIC_ROOT_REGISTRY_ADDRESS,
  benefitDistributorAddress: process.env.NEXT_PUBLIC_BENEFIT_DISTRIBUTOR_ADDRESS,
  verifierAddress: process.env.NEXT_PUBLIC_VERIFIER_ADDRESS,
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
  deploymentId: process.env.NEXT_PUBLIC_DEPLOYMENT_ID,
  deploymentStartBlock: process.env.NEXT_PUBLIC_DEPLOYMENT_START_BLOCK
});

/** 返回只基于环境变量生成的静态配置。 */
export function getEnvRuntimeConfig() {
  return envConfig;
}

/** 返回当前真正生效的运行时配置；浏览器端会优先叠加服务端注入值。 */
export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") {
    return envConfig;
  }

  return normalizeRuntimeConfig({
    ...envConfig,
    ...(window.__APP_RUNTIME_CONFIG__ ?? {})
  });
}

/** 判断四个关键合约地址是否都已经配置完成。 */
export function hasConfiguredContracts(config: RuntimeConfig) {
  return (
    config.roleRegistryAddress !== ZERO_ADDRESS &&
    config.rootRegistryAddress !== ZERO_ADDRESS &&
    config.benefitDistributorAddress !== ZERO_ADDRESS &&
    config.verifierAddress !== ZERO_ADDRESS
  );
}

/** 返回零地址常量，供 UI 和校验逻辑复用。 */
export function getZeroAddress() {
  return ZERO_ADDRESS;
}

/** 生成部署 + 地址维度的作用域键，用于隔离本地缓存和本地存储。 */
export function getRuntimeScope(config: RuntimeConfig, address?: Address | null) {
  return `${config.chainId}:${config.deploymentId}:${address?.toLowerCase() ?? "anonymous"}`;
}
