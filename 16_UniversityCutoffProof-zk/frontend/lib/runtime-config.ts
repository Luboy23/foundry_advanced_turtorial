import type { ContractConfig } from "@/types/contract-config";
import { isAddress } from "@/lib/utils";

// 运行时配置优先级：
// 1. 浏览器里注入的 window.__APP_RUNTIME_CONFIG__
// 2. 编译期环境变量
// 3. 本地教学链默认值
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = 31337;

// 对链 ID 做宽容解析，避免配置文件里出现字符串数字时前端直接崩溃。
const normalizeChainId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIN_ID;
};

// 对 RPC 地址做最小规范化；如果配置缺失，则回退到本地教学链默认地址。
const normalizeRpcUrl = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_RPC_URL;

const normalizeBlockNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

const normalizeBlockHash = (value: unknown) =>
  typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value)
    ? (value as `0x${string}`)
    : undefined;

const envConfig: ContractConfig = {
  admissionRoleRegistryAddress: isAddress(process.env.NEXT_PUBLIC_ADMISSION_ROLE_REGISTRY_ADDRESS)
    ? process.env.NEXT_PUBLIC_ADMISSION_ROLE_REGISTRY_ADDRESS
    : ZERO_ADDRESS,
  scoreRootRegistryAddress: isAddress(process.env.NEXT_PUBLIC_SCORE_ROOT_REGISTRY_ADDRESS)
    ? process.env.NEXT_PUBLIC_SCORE_ROOT_REGISTRY_ADDRESS
    : ZERO_ADDRESS,
  universityAdmissionVerifierAddress: isAddress(process.env.NEXT_PUBLIC_UNIVERSITY_ADMISSION_VERIFIER_ADDRESS)
    ? process.env.NEXT_PUBLIC_UNIVERSITY_ADMISSION_VERIFIER_ADDRESS
    : ZERO_ADDRESS,
  chainId: normalizeChainId(process.env.NEXT_PUBLIC_CHAIN_ID),
  rpcUrl: normalizeRpcUrl(process.env.NEXT_PUBLIC_RPC_URL),
  deploymentBlockNumber: normalizeBlockNumber(process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK_NUMBER),
  deploymentBlockHash: normalizeBlockHash(process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK_HASH)
};

export function resolveRuntimeConfig(runtime?: Partial<ContractConfig>): ContractConfig {
  return {
    admissionRoleRegistryAddress: isAddress(runtime?.admissionRoleRegistryAddress)
      ? runtime.admissionRoleRegistryAddress
      : envConfig.admissionRoleRegistryAddress,
    scoreRootRegistryAddress: isAddress(runtime?.scoreRootRegistryAddress)
      ? runtime.scoreRootRegistryAddress
      : envConfig.scoreRootRegistryAddress,
    universityAdmissionVerifierAddress: isAddress(runtime?.universityAdmissionVerifierAddress)
      ? runtime.universityAdmissionVerifierAddress
      : envConfig.universityAdmissionVerifierAddress,
    chainId: normalizeChainId(runtime?.chainId ?? envConfig.chainId),
    rpcUrl: normalizeRpcUrl(runtime?.rpcUrl ?? envConfig.rpcUrl),
    deploymentBlockNumber: normalizeBlockNumber(runtime?.deploymentBlockNumber ?? envConfig.deploymentBlockNumber),
    deploymentBlockHash: normalizeBlockHash(runtime?.deploymentBlockHash ?? envConfig.deploymentBlockHash)
  };
}

export function getInitialRuntimeConfig(): ContractConfig {
  return envConfig;
}

export function getInjectedRuntimeConfig(): ContractConfig {
  if (typeof window === "undefined") {
    return envConfig;
  }

  return resolveRuntimeConfig(window.__APP_RUNTIME_CONFIG__);
}

export function getRuntimeConfig(): ContractConfig {
  // 保留给非 Hook 场景使用；首屏稳定性由 useRuntimeConfig 里的初始快照负责。
  return getInjectedRuntimeConfig();
}

export function hasConfiguredContracts(config: ContractConfig) {
  // 只要三个核心合约地址齐备，前端就认为当前项目已完成最小部署。
  return (
    config.admissionRoleRegistryAddress !== ZERO_ADDRESS &&
    config.scoreRootRegistryAddress !== ZERO_ADDRESS &&
    config.universityAdmissionVerifierAddress !== ZERO_ADDRESS
  );
}
