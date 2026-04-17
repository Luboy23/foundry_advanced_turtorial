import "server-only";

import type { Address } from "@/types/contract-config";
import type { LocalUnemploymentCredential } from "@/types/domain";
import { ensureSeededCredentialSetStore, loadPrivateCredentialByVersionAndAddress } from "@/lib/server/credential-set-store";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";
import { createPublicClient, http } from "viem";
import { unemploymentCredentialRootRegistryAbi } from "@/lib/contracts/abis";

/**
 * 私有凭证样例读取服务。
 *
 * 当前教学项目的私有凭证由服务端按版本和地址落在文件系统中；这里负责把“链上当前版本”
 * 和“对应版本的本地凭证样例”关联起来。
 */
function readStructValue<T>(value: unknown, key: string, index: number): T {
  const record = value as Record<string, T> & T[];
  return record?.[key] ?? record?.[index];
}

/** 读取链上当前资格名单版本号。 */
async function readCurrentSetVersion() {
  const config = readRuntimeConfigForScript();
  const publicClient = createPublicClient({
    transport: http(config.rpcUrl)
  });

  const value = await publicClient.readContract({
    abi: unemploymentCredentialRootRegistryAbi,
    address: config.rootRegistryAddress,
    functionName: "getCurrentCredentialSet"
  });

  return Number(readStructValue<number | bigint>(value, "version", 2));
}

/** 判断当前地址在“链上当前版本”下是否存在可领取的私有凭证。 */
export async function hasCurrentPrivateCredential(address: Address) {
  const credential = await loadPrivateCredentialByAddress(address);
  return Boolean(credential);
}

/** 按当前链上版本读取某地址对应的私有凭证样例。 */
export async function loadPrivateCredentialByAddress(address: Address): Promise<LocalUnemploymentCredential | null> {
  await ensureSeededCredentialSetStore();

  let currentVersion = 0;
  try {
    currentVersion = await readCurrentSetVersion();
  } catch {
    return null;
  }

  if (!currentVersion) {
    return null;
  }

  return loadPrivateCredentialByVersionAndAddress(currentVersion, address);
}
