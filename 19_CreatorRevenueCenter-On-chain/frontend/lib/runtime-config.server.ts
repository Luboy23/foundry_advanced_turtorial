import fs from "node:fs";
import path from "node:path";
import { normalizeRuntimeConfig } from "@/lib/runtime-config";
import { readJsonFile } from "@/lib/server/json";
import type { RuntimeConfig } from "@/types/contract-config";

const runtimeConfigPath = path.join(process.cwd(), "public", "contract-config.json");
let cachedRuntimeConfig: RuntimeConfig | null = null;
let cachedRuntimeConfigStamp = "";

export function readRuntimeConfigForScript(): RuntimeConfig {
  const stats = fs.existsSync(runtimeConfigPath) ? fs.statSync(runtimeConfigPath) : null;
  const stamp = `${stats?.mtimeMs ?? 0}`;

  if (cachedRuntimeConfig && cachedRuntimeConfigStamp === stamp) {
    return cachedRuntimeConfig;
  }

  const fileConfig = readJsonFile<Record<string, unknown>>(runtimeConfigPath, {});

  cachedRuntimeConfig = normalizeRuntimeConfig({
    ...fileConfig,
    batchRegistryAddress:
      ((fileConfig["batchRegistryAddress"] as string | undefined) ??
        process.env.NEXT_PUBLIC_BATCH_REGISTRY_ADDRESS) as `0x${string}` | undefined,
    distributorAddress:
      ((fileConfig["distributorAddress"] as string | undefined) ??
        process.env.NEXT_PUBLIC_DISTRIBUTOR_ADDRESS) as `0x${string}` | undefined,
    chainId: (fileConfig["chainId"] as string | number | undefined) ?? process.env.NEXT_PUBLIC_CHAIN_ID,
    rpcUrl: (fileConfig["rpcUrl"] as string | undefined) ?? process.env.NEXT_PUBLIC_RPC_URL,
    deploymentId: (fileConfig["deploymentId"] as string | undefined) ?? process.env.NEXT_PUBLIC_DEPLOYMENT_ID,
    activeBatchRoot: fileConfig["activeBatchRoot"] as `0x${string}` | undefined,
    activeMetadataHash: fileConfig["activeMetadataHash"] as `0x${string}` | undefined,
    startBlock: (fileConfig["startBlock"] as string | number | undefined) ?? process.env.NEXT_PUBLIC_START_BLOCK,
    indexerBaseUrl: (fileConfig["indexerBaseUrl"] as string | undefined) ?? process.env.NEXT_PUBLIC_INDEXER_BASE_URL,
    batchLabelMap:
      (fileConfig["batchLabelMap"] as string | RuntimeConfig["batchLabelMap"] | undefined) ??
      process.env.NEXT_PUBLIC_BATCH_LABEL_MAP
  });
  cachedRuntimeConfigStamp = stamp;
  return cachedRuntimeConfig;
}
