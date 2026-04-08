const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = 31337;
const DEFAULT_PROJECT_GITHUB =
  "https://github.com/lllu23/foundry_advanced_turtorial";

export type RuntimeConfig = {
  rpcUrl: string;
  chainId: number;
  projectGithub: string;
  eventFactoryAddress: `0x${string}`;
  positionTokenAddress: `0x${string}`;
  ethCollateralVaultAddress: `0x${string}`;
  oracleAdapterAddress: `0x${string}`;
};

declare global {
  interface Window {
    __APP_RUNTIME_CONFIG__?: Partial<RuntimeConfig>;
  }
}

const isAddress = (value: unknown): value is `0x${string}` =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

const normalizeRpcUrl = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_RPC_URL;

const normalizeChainId = (value: unknown) => {
  const chainId = Number(value);
  return Number.isFinite(chainId) && chainId > 0 ? chainId : DEFAULT_CHAIN_ID;
};

const envConfig: RuntimeConfig = {
  rpcUrl: normalizeRpcUrl(process.env.NEXT_PUBLIC_RPC_URL),
  chainId: normalizeChainId(process.env.NEXT_PUBLIC_CHAIN_ID),
  projectGithub:
    process.env.NEXT_PUBLIC_PROJECT_GITHUB ?? DEFAULT_PROJECT_GITHUB,
  eventFactoryAddress: isAddress(process.env.NEXT_PUBLIC_EVENT_FACTORY_ADDRESS)
    ? process.env.NEXT_PUBLIC_EVENT_FACTORY_ADDRESS
    : ZERO_ADDRESS,
  positionTokenAddress: isAddress(process.env.NEXT_PUBLIC_POSITION_TOKEN_ADDRESS)
    ? process.env.NEXT_PUBLIC_POSITION_TOKEN_ADDRESS
    : ZERO_ADDRESS,
  ethCollateralVaultAddress: isAddress(
    process.env.NEXT_PUBLIC_ETH_COLLATERAL_VAULT_ADDRESS
  )
    ? process.env.NEXT_PUBLIC_ETH_COLLATERAL_VAULT_ADDRESS
    : ZERO_ADDRESS,
  oracleAdapterAddress: isAddress(process.env.NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS)
    ? process.env.NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS
    : ZERO_ADDRESS,
};

export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") {
    return envConfig;
  }

  const runtime = window.__APP_RUNTIME_CONFIG__ ?? {};
  return {
    rpcUrl: normalizeRpcUrl(runtime.rpcUrl ?? envConfig.rpcUrl),
    chainId: normalizeChainId(runtime.chainId ?? envConfig.chainId),
    projectGithub:
      typeof runtime.projectGithub === "string" &&
      runtime.projectGithub.trim().length > 0
        ? runtime.projectGithub.trim()
        : envConfig.projectGithub,
    eventFactoryAddress: isAddress(runtime.eventFactoryAddress)
      ? runtime.eventFactoryAddress
      : envConfig.eventFactoryAddress,
    positionTokenAddress: isAddress(runtime.positionTokenAddress)
      ? runtime.positionTokenAddress
      : envConfig.positionTokenAddress,
    ethCollateralVaultAddress: isAddress(runtime.ethCollateralVaultAddress)
      ? runtime.ethCollateralVaultAddress
      : envConfig.ethCollateralVaultAddress,
    oracleAdapterAddress: isAddress(runtime.oracleAdapterAddress)
      ? runtime.oracleAdapterAddress
      : envConfig.oracleAdapterAddress,
  };
}
