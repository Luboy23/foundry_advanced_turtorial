import { parseAbiItem } from "viem";
import type { ReadClient } from "@/lib/blockchain/read-client";
import type { Address } from "@/types/contract-config";
import type { ScoreSourceConfig } from "@/types/admission";
import scoreRootRegistryAbiJson from "@/abi/ScoreRootRegistry.json";

const scoreRootRegistryAbi = scoreRootRegistryAbiJson;

// 考试院发布成绩源后的前端事件入口。
export const scoreSourceCreatedEvent = parseAbiItem(
  "event ScoreSourceCreated(bytes32 indexed scoreSourceId, string sourceTitle, uint32 maxScore, uint256 merkleRoot, address indexed issuer)"
);

type ScoreSourceTupleResult = readonly [
  `0x${string}`,
  string,
  bigint,
  bigint,
  bigint,
  Address,
  boolean
];

type ScoreSourceObjectResult = {
  scoreSourceId: `0x${string}`;
  sourceTitle: string;
  merkleRoot: bigint;
  maxScore: bigint;
  issuedAt: bigint;
  issuer: Address;
  active: boolean;
};

// 合约返回的 bigint 统一转成前端易用的 number。
function toNumber(value: bigint | number): number {
  return typeof value === "bigint" ? Number(value) : value;
}

// viem 读取 struct 时可能返回 tuple，这里做一次兼容识别。
function isTupleResult(value: unknown): value is ScoreSourceTupleResult {
  return Array.isArray(value) && value.length === 7;
}

// 读取成绩源配置，并兼容 tuple / object 两种返回形状。
export async function getScoreSourceConfig(
  publicClient: ReadClient,
  registryAddress: Address,
  scoreSourceId: `0x${string}`
): Promise<ScoreSourceConfig> {
  const result = await publicClient.readContract({
    abi: scoreRootRegistryAbi,
    address: registryAddress,
    functionName: "getScoreSource",
    args: [scoreSourceId]
  });

  if (isTupleResult(result)) {
    return {
      scoreSourceId: result[0],
      sourceTitle: result[1],
      merkleRoot: result[2],
      maxScore: toNumber(result[3]),
      issuedAt: toNumber(result[4]),
      issuer: result[5],
      active: result[6]
    };
  }

  const scoreSource = result as ScoreSourceObjectResult;
  return {
    scoreSourceId: scoreSource.scoreSourceId,
    sourceTitle: scoreSource.sourceTitle,
    merkleRoot: scoreSource.merkleRoot,
    maxScore: toNumber(scoreSource.maxScore),
    issuedAt: toNumber(scoreSource.issuedAt),
    issuer: scoreSource.issuer,
    active: scoreSource.active
  };
}

export { scoreRootRegistryAbi };
