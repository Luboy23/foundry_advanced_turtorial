const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = 31337;

export type RuntimeConfig = {
  lightsOutAddress: `0x${string}`;
  rpcUrl: string;
  chainId: number;
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
  lightsOutAddress: isAddress(process.env.NEXT_PUBLIC_LIGHTS_OUT_ADDRESS)
    ? process.env.NEXT_PUBLIC_LIGHTS_OUT_ADDRESS
    : ZERO_ADDRESS,
  rpcUrl: normalizeRpcUrl(process.env.NEXT_PUBLIC_RPC_URL),
  chainId: normalizeChainId(process.env.NEXT_PUBLIC_CHAIN_ID),
};

export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") {
    return envConfig;
  }

  const runtime = window.__APP_RUNTIME_CONFIG__ ?? {};
  return {
    lightsOutAddress: isAddress(runtime.lightsOutAddress)
      ? runtime.lightsOutAddress
      : envConfig.lightsOutAddress,
    rpcUrl: normalizeRpcUrl(runtime.rpcUrl ?? envConfig.rpcUrl),
    chainId: normalizeChainId(runtime.chainId ?? envConfig.chainId),
  };
}
