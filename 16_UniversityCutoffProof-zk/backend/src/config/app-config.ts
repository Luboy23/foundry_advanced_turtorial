import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// 后端运行时配置。
// 这一层把环境变量、SQLite 路径和前端同步出来的合约配置统一解析成服务可直接使用的结构。
export type BackendContractConfig = {
  admissionRoleRegistryAddress: `0x${string}`;
  scoreRootRegistryAddress: `0x${string}`;
  universityAdmissionVerifierAddress: `0x${string}`;
  chainId: number;
  rpcUrl?: string;
  deploymentBlockNumber?: number;
  deploymentBlockHash?: `0x${string}`;
};

export type AppConfig = {
  backendRoot: string;
  host: string;
  port: number;
  databaseUrl: string;
  storageDir: string;
  chainRpcUrl: string;
  chainId: number;
  contractConfigPath: string;
  sessionTtlMinutes: number;
  authDevSignatureBypass: boolean;
  indexerEnabled: boolean;
  indexerPollIntervalMs: number;
  swaggerEnabled: boolean;
};

function resolveBackendRoot(env: NodeJS.ProcessEnv) {
  return env.BACKEND_ROOT_DIR?.trim()
    ? path.resolve(env.BACKEND_ROOT_DIR.trim())
    : process.cwd();
}

function resolveBackendPath(backendRoot: string, relativeOrAbsolutePath: string) {
  return path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(backendRoot, relativeOrAbsolutePath);
}

function normalizeDatabaseUrl(backendRoot: string, databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  const rawPath = databaseUrl.slice("file:".length);
  if (!rawPath) {
    throw new Error("BACKEND_DATABASE_URL 必须包含 SQLite 文件路径。");
  }

  if (rawPath.startsWith("/")) {
    return `file:${path.normalize(rawPath)}`;
  }

  return `file:${resolveBackendPath(backendRoot, rawPath)}`;
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const backendRoot = resolveBackendRoot(env);
  const databaseUrl = normalizeDatabaseUrl(backendRoot, env.BACKEND_DATABASE_URL?.trim() || "file:./dev.db");
  const storageDir = resolveBackendPath(backendRoot, env.BACKEND_STORAGE_DIR?.trim() || "./storage");
  const contractConfigPath = resolveBackendPath(
    backendRoot,
    env.BACKEND_CONTRACT_CONFIG_PATH?.trim() || "../frontend/public/contract-config.json"
  );

  return {
    backendRoot,
    host: env.BACKEND_HOST?.trim() || "127.0.0.1",
    port: Number(env.BACKEND_PORT || 8787),
    databaseUrl,
    storageDir,
    chainRpcUrl: env.BACKEND_CHAIN_RPC_URL?.trim() || "http://127.0.0.1:8545",
    chainId: Number(env.BACKEND_CHAIN_ID || 31337),
    contractConfigPath,
    sessionTtlMinutes: Number(env.BACKEND_SESSION_TTL_MINUTES || 60),
    authDevSignatureBypass: env.BACKEND_AUTH_DEV_SIGNATURE_BYPASS !== "false",
    indexerEnabled: env.BACKEND_INDEXER_ENABLED !== "false",
    indexerPollIntervalMs: Number(env.BACKEND_INDEXER_POLL_INTERVAL_SECS || 5) * 1000,
    swaggerEnabled: env.BACKEND_SWAGGER_ENABLED === "true"
  };
}

export function resolveContractConfig(appConfig: AppConfig): BackendContractConfig {
  const configPath = appConfig.contractConfigPath;
  if (!existsSync(configPath)) {
    throw new Error(`未找到合约运行时配置文件：${configPath}`);
  }

  // 后端总是以运行时 contract-config 为准，这样部署脚本、前端和索引器会读到同一组合约地址。
  const parsed = JSON.parse(readFileSync(configPath, "utf8")) as BackendContractConfig;
  return {
    ...parsed,
    rpcUrl: parsed.rpcUrl || appConfig.chainRpcUrl,
    chainId: Number(parsed.chainId || appConfig.chainId)
  };
}
