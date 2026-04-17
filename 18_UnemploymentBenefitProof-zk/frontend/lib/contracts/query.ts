import type { PublicClient } from "viem";
import type { Address, RuntimeConfig } from "@/types/contract-config";
import type {
  BenefitClaimRecord,
  BenefitProgram,
  CredentialSetPublishRecord,
  RoleStatus,
  UnemploymentCredentialSet
} from "@/types/domain";
import {
  benefitRoleRegistryAbi,
  unemploymentBenefitDistributorAbi,
  unemploymentCredentialRootRegistryAbi
} from "@/lib/contracts/abis";

/**
 * 链上只读查询层。
 *
 * 这里统一封装前端需要的角色状态、资格名单、补助项目和事件历史读取逻辑，让页面层只处理
 * 业务状态，不直接接触 ABI 细节或事件拼装过程。
 */
function readStructValue<T>(value: unknown, key: string, index: number): T {
  const record = value as Record<string, T> & T[];
  return record?.[key] ?? record?.[index];
}

/** 根据部署起始区块确定事件扫描范围，避免每次都从链的创世块回放。 */
function resolveEventsFromBlock(config: RuntimeConfig) {
  return config.deploymentStartBlock !== undefined ? BigInt(config.deploymentStartBlock) : "earliest";
}

/** 尽可能从 viem / wagmi / Error 对象中提取稳定的错误文本。 */
function extractErrorMessage(error: unknown): string {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object") {
    const candidate = error as {
      shortMessage?: unknown;
      message?: unknown;
      details?: unknown;
      cause?: unknown;
    };

    if (typeof candidate.shortMessage === "string" && candidate.shortMessage.trim()) {
      return candidate.shortMessage;
    }
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message;
    }
    if (typeof candidate.details === "string" && candidate.details.trim()) {
      return candidate.details;
    }
    if (candidate.cause) {
      return extractErrorMessage(candidate.cause);
    }
  }

  return "";
}

/** 判断错误是否表示“当前链上还没有已发布资格名单”，用于把它视为正常空态而不是异常。 */
export function isCredentialSetNotFoundError(error: unknown) {
  const message = extractErrorMessage(error).toLowerCase();
  return (
    message.includes("credentialsetnotfound") ||
    message.includes("credential set not found") ||
    message.includes("资格名单尚未发布")
  );
}

/** 读取区块时间戳并做 Promise 级缓存，避免同一区块里的多条事件重复查询。 */
async function getBlockTimestamp(
  publicClient: PublicClient,
  blockHash: `0x${string}`,
  cache: Map<`0x${string}`, Promise<number>>
) {
  const cached = cache.get(blockHash);
  if (cached) {
    return cached;
  }

  const timestampPromise = publicClient.getBlock({ blockHash }).then((block) => Number(block.timestamp));
  cache.set(blockHash, timestampPromise);
  return timestampPromise;
}

/** 批量读取地址对应的 government / applicant / agency 角色状态。 */
export async function readRoleStatus(
  publicClient: PublicClient,
  config: RuntimeConfig,
  address: Address
): Promise<RoleStatus> {
  const [isGovernment, isApplicant, isAgency] = await Promise.all([
    publicClient.readContract({
      abi: benefitRoleRegistryAbi,
      address: config.roleRegistryAddress,
      functionName: "isGovernment",
      args: [address]
    }) as Promise<boolean>,
    publicClient.readContract({
      abi: benefitRoleRegistryAbi,
      address: config.roleRegistryAddress,
      functionName: "isApplicant",
      args: [address]
    }) as Promise<boolean>,
    publicClient.readContract({
      abi: benefitRoleRegistryAbi,
      address: config.roleRegistryAddress,
      functionName: "isAgency",
      args: [address]
    }) as Promise<boolean>
  ]);

  return { isGovernment, isApplicant, isAgency };
}

/** 读取当前链上生效的资格名单结构。 */
export async function readCurrentCredentialSet(
  publicClient: PublicClient,
  config: RuntimeConfig
): Promise<UnemploymentCredentialSet> {
  const value = await publicClient.readContract({
    abi: unemploymentCredentialRootRegistryAbi,
    address: config.rootRegistryAddress,
    functionName: "getCurrentCredentialSet"
  });

  return {
    setId: readStructValue<`0x${string}`>(value, "setId", 0),
    merkleRoot: BigInt(readStructValue<bigint | string>(value, "merkleRoot", 1)),
    version: Number(readStructValue<number | bigint>(value, "version", 2)),
    referenceDate: Number(readStructValue<number | bigint>(value, "referenceDate", 3)),
    eligibleCount: Number(readStructValue<number | bigint>(value, "eligibleCount", 4)),
    issuer: readStructValue<Address>(value, "issuer", 5),
    updatedAt: Number(readStructValue<number | bigint>(value, "updatedAt", 6)),
    active: Boolean(readStructValue<boolean>(value, "active", 7))
  };
}

/** 读取当前资格名单；若链上尚未发布名单，则回退为 `null` 供页面按正常空态处理。 */
export async function readCurrentCredentialSetOrNull(publicClient: PublicClient, config: RuntimeConfig) {
  try {
    return await readCurrentCredentialSet(publicClient, config);
  } catch (error) {
    if (isCredentialSetNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

/** 读取当前补助项目配置与资金池余额。 */
export async function readProgram(publicClient: PublicClient, config: RuntimeConfig): Promise<BenefitProgram> {
  const [value, poolBalanceWei] = await Promise.all([
    publicClient.readContract({
      abi: unemploymentBenefitDistributorAbi,
      address: config.benefitDistributorAddress,
      functionName: "getProgram"
    }),
    publicClient.readContract({
      abi: unemploymentBenefitDistributorAbi,
      address: config.benefitDistributorAddress,
      functionName: "getProgramBalance"
    }) as Promise<bigint | string>
  ]);

  return {
    programId: readStructValue<`0x${string}`>(value, "programId", 0),
    programIdField: BigInt(readStructValue<bigint | string>(value, "programIdField", 1)),
    amountWei: BigInt(readStructValue<bigint | string>(value, "amountWei", 2)),
    active: Boolean(readStructValue<boolean>(value, "active", 3)),
    updatedAt: Number(readStructValue<number | bigint>(value, "updatedAt", 4)),
    totalClaims: Number(readStructValue<number | bigint>(value, "totalClaims", 5)),
    totalDisbursedWei: BigInt(readStructValue<bigint | string>(value, "totalDisbursedWei", 6)),
    poolBalanceWei: BigInt(poolBalanceWei)
  };
}

/** 判断某地址是否已经成功领取过补助。 */
export async function readHasClaimed(publicClient: PublicClient, config: RuntimeConfig, address: Address) {
  return (await publicClient.readContract({
    abi: unemploymentBenefitDistributorAbi,
    address: config.benefitDistributorAddress,
    functionName: "hasClaimed",
    args: [address]
  })) as boolean;
}

/** 读取补助领取历史；传入 recipient 时会在前端侧做地址过滤。 */
export async function readClaimHistory(
  publicClient: PublicClient,
  config: RuntimeConfig,
  recipient?: Address
): Promise<BenefitClaimRecord[]> {
  const timestampCache = new Map<`0x${string}`, Promise<number>>();
  const logs = (await publicClient.getContractEvents({
    abi: unemploymentBenefitDistributorAbi,
    address: config.benefitDistributorAddress,
    eventName: "BenefitDisbursed",
    fromBlock: resolveEventsFromBlock(config)
  })) as Array<{
    args: {
      programId?: `0x${string}`;
      recipient?: Address;
      nullifierHash?: `0x${string}`;
      amountWei?: bigint | string;
      rootVersion?: bigint | number;
    };
    transactionHash?: `0x${string}`;
    blockHash?: `0x${string}`;
  }>;

  const filtered = recipient
    ? logs.filter((log) => log.args.recipient?.toLowerCase() === recipient.toLowerCase())
    : logs;

  const records = await Promise.all(
    filtered.map(async (log) => {
      if (
        !log.blockHash ||
        !log.args.programId ||
        !log.args.recipient ||
        !log.args.nullifierHash ||
        log.args.amountWei === undefined ||
        log.args.rootVersion === undefined
      ) {
        throw new Error("发放记录暂不完整，当前无法整理领取历史。");
      }

      return {
        programId: log.args.programId,
        recipient: log.args.recipient,
        nullifierHash: log.args.nullifierHash,
        amountWei: BigInt(log.args.amountWei),
        rootVersion: Number(log.args.rootVersion),
        claimedAt: await getBlockTimestamp(publicClient, log.blockHash, timestampCache),
        txHash: log.transactionHash
      } satisfies BenefitClaimRecord;
    })
  );

  return records.sort((left, right) => right.claimedAt - left.claimedAt);
}

/** 读取资格名单发布历史，并按时间倒序返回。 */
export async function readCredentialSetPublishHistory(
  publicClient: PublicClient,
  config: RuntimeConfig
): Promise<CredentialSetPublishRecord[]> {
  const timestampCache = new Map<`0x${string}`, Promise<number>>();
  const logs = (await publicClient.getContractEvents({
    abi: unemploymentCredentialRootRegistryAbi,
    address: config.rootRegistryAddress,
    eventName: "CredentialSetPublished",
    fromBlock: resolveEventsFromBlock(config)
  })) as Array<{
    args: {
      setId?: `0x${string}`;
      version?: bigint | number;
      merkleRoot?: bigint | string;
      referenceDate?: bigint | number;
      eligibleCount?: bigint | number;
      issuer?: Address;
    };
    blockHash?: `0x${string}`;
    transactionHash?: `0x${string}`;
  }>;

  const records = await Promise.all(
    logs.map(async (log) => {
      if (
        !log.blockHash ||
        !log.args.setId ||
        log.args.version === undefined ||
        log.args.merkleRoot === undefined ||
        log.args.referenceDate === undefined ||
        log.args.eligibleCount === undefined ||
        !log.args.issuer
      ) {
        throw new Error("资格集合记录暂不完整，当前无法整理操作历史。");
      }

      return {
        setId: log.args.setId,
        version: Number(log.args.version),
        merkleRoot: BigInt(log.args.merkleRoot),
        referenceDate: Number(log.args.referenceDate),
        eligibleCount: Number(log.args.eligibleCount),
        issuer: log.args.issuer,
        timestamp: await getBlockTimestamp(publicClient, log.blockHash, timestampCache),
        txHash: log.transactionHash
      };
    })
  );

  return records.sort((left, right) => right.timestamp - left.timestamp);
}
