import { createRequire } from "node:module";
import path from "node:path";
import { loadAppConfig } from "../config/app-config";

// 考试院成绩草稿生成器。
// 这一层把导入草稿转换成“成绩源摘要 + 学生成绩凭证”，是考试院发布前最关键的离链准备步骤。
const DEFAULT_MERKLE_DEPTH = 20;
const SNARK_SCALAR_FIELD = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

type PoseidonField = {
  toString(value: unknown): string;
};

type PoseidonFn = {
  (inputs: readonly unknown[], initState?: unknown, nOut?: number): unknown;
  F: PoseidonField;
};

export type GeneratedScoreRecord = {
  candidateLabel: string;
  candidateIdHash: string;
  score: number;
  secretSalt: string;
  boundStudentAddress: `0x${string}`;
};

export type GeneratedScoreSourceDraft = {
  scoreSourceIdLabel: string;
  sourceTitle: string;
  maxScore: number;
  merkleDepth: number;
  records: GeneratedScoreRecord[];
};

export type GeneratedScoreSourceSummary = {
  scoreSourceIdLabel: string;
  scoreSourceIdBytes32: `0x${string}`;
  scoreSourceIdField: string;
  sourceTitle: string;
  maxScore: number;
  merkleDepth: number;
  merkleRoot: string;
  merkleRootHex: `0x${string}`;
};

export type GeneratedCredential = {
  version: number;
  scoreSourceId: string;
  scoreSourceIdBytes32: `0x${string}`;
  scoreSourceTitle: string;
  boundStudentAddress: `0x${string}`;
  boundStudentField: string;
  candidateLabel: string;
  candidateIdHash: string;
  score: number;
  maxScore: number;
  secretSalt: string;
  leaf: string;
  merkleRoot: string;
  pathElements: string[];
  pathIndices: number[];
  issuedAt: number;
};

let poseidonPromise: Promise<PoseidonFn> | null = null;

function getFrontendRequire() {
  const appConfig = loadAppConfig();
  return createRequire(path.resolve(appConfig.backendRoot, "../frontend/package.json"));
}

async function buildPoseidon(): Promise<PoseidonFn> {
  if (!poseidonPromise) {
    poseidonPromise = (async () => {
      const frontendRequire = getFrontendRequire();
      const circomlibjs = frontendRequire("circomlibjs") as {
        buildPoseidon: () => Promise<PoseidonFn>;
      };
      return circomlibjs.buildPoseidon();
    })();
  }

  return poseidonPromise;
}

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function asciiToBytes32Hex(value: string): `0x${string}` {
  const bytes = new TextEncoder().encode(value);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex.padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
}

function bytes32HexToField(value: `0x${string}`) {
  return BigInt(value) % SNARK_SCALAR_FIELD;
}

function addressToField(value: `0x${string}`) {
  return BigInt(value.toLowerCase()) % SNARK_SCALAR_FIELD;
}

function toBigIntString(value: bigint) {
  return value.toString(10);
}

function toBytes32Hex(value: bigint) {
  return `0x${value.toString(16).padStart(64, "0")}` as `0x${string}`;
}

function validateDraft(draft: GeneratedScoreSourceDraft) {
  // 草稿校验在这里重复执行一遍，是为了保证即使绕过前端，后端仍然不会生成无效成绩源。
  if (!draft.scoreSourceIdLabel.trim()) {
    throw new Error("成绩源编号不能为空。");
  }
  if (!draft.sourceTitle.trim()) {
    throw new Error("成绩批次名称不能为空。");
  }
  if (!Number.isInteger(draft.maxScore) || draft.maxScore <= 0) {
    throw new Error("总分必须是正整数。");
  }
  if (!Array.isArray(draft.records) || draft.records.length === 0) {
    throw new Error("成绩记录不能为空。");
  }
  if (draft.merkleDepth !== DEFAULT_MERKLE_DEPTH) {
    throw new Error("当前系统暂不支持该成绩文件格式。");
  }

  for (const record of draft.records) {
    if (!record.candidateLabel.trim()) {
      throw new Error("存在未填写姓名或标签的学生记录。");
    }
    if (!/^\d+$/.test(record.candidateIdHash.trim())) {
      throw new Error(`学生 ${record.candidateLabel} 的身份校验信息不正确。`);
    }
    if (!/^\d+$/.test(record.secretSalt.trim())) {
      throw new Error(`学生 ${record.candidateLabel} 的安全校验信息不正确。`);
    }
    if (!isAddress(record.boundStudentAddress)) {
      throw new Error(`学生 ${record.candidateLabel} 的绑定账户不正确。`);
    }
    if (
      !Number.isInteger(record.score) ||
      record.score < 0 ||
      record.score > draft.maxScore
    ) {
      throw new Error(`学生 ${record.candidateLabel} 的成绩不正确。`);
    }
  }
}

export async function generateCredentialsFromDraft(draft: GeneratedScoreSourceDraft): Promise<{
  scoreSource: GeneratedScoreSourceSummary;
  credentials: GeneratedCredential[];
}> {
  validateDraft(draft);

  const poseidon = await buildPoseidon();
  const field = poseidon.F;
  const scoreSourceIdBytes32 = asciiToBytes32Hex(draft.scoreSourceIdLabel);
  const scoreSourceIdField = bytes32HexToField(scoreSourceIdBytes32);

  const zeroLeaf = BigInt(field.toString(poseidon([0n, 0n, 0n, 0n, 0n])));
  const zeroHashes = [zeroLeaf];
  // 预先计算每一层的零哈希，后面构造稀疏 Merkle 树时可以直接复用，避免重复分支判断。
  for (let depth = 0; depth < draft.merkleDepth; depth += 1) {
    zeroHashes.push(BigInt(field.toString(poseidon([zeroHashes[depth], zeroHashes[depth]]))));
  }

  const records = draft.records.map((record, index) => ({
    ...record,
    index,
    boundStudentField: addressToField(record.boundStudentAddress),
    leaf: BigInt(
      field.toString(
        poseidon([
          scoreSourceIdField,
          BigInt(record.candidateIdHash),
          BigInt(record.score),
          BigInt(record.secretSalt),
          addressToField(record.boundStudentAddress)
        ])
      )
    )
  }));

  let levelMap = new Map<bigint, bigint>();
  for (const record of records) {
    levelMap.set(BigInt(record.index), record.leaf);
  }

  const levelMaps = [new Map(levelMap)];
  // 逐层向上聚合直到根节点；后面生成每个学生的认证路径时还要回读这些中间层。
  for (let depth = 0; depth < draft.merkleDepth; depth += 1) {
    const parentMap = new Map<bigint, bigint>();
    const parentIndexSet = new Set([...levelMap.keys()].map((index) => (index / 2n).toString()));

    if (parentIndexSet.size === 0) {
      parentMap.set(0n, zeroHashes[depth + 1]);
    } else {
      const parentIndexes = [...parentIndexSet]
        .map((value) => BigInt(value))
        .sort((left, right) => (left < right ? -1 : 1));
      for (const parentIndex of parentIndexes) {
        const leftIndex = parentIndex * 2n;
        const rightIndex = leftIndex + 1n;
        const leftNode = levelMap.get(leftIndex) ?? zeroHashes[depth];
        const rightNode = levelMap.get(rightIndex) ?? zeroHashes[depth];
        parentMap.set(
          parentIndex,
          BigInt(field.toString(poseidon([leftNode, rightNode])))
        );
      }
    }

    levelMap = parentMap;
    levelMaps.push(new Map(levelMap));
  }

  const merkleRoot = levelMap.get(0n) ?? zeroHashes[draft.merkleDepth];
  const issuedAt = Math.floor(Date.now() / 1000);

  const credentials: GeneratedCredential[] = records.map((record) => {
    let currentIndex = BigInt(record.index);
    const pathElements: string[] = [];
    const pathIndices: number[] = [];

    for (let depth = 0; depth < draft.merkleDepth; depth += 1) {
      const siblingIndex = currentIndex ^ 1n;
      const siblingValue = levelMaps[depth].get(siblingIndex) ?? zeroHashes[depth];
      pathElements.push(toBigIntString(siblingValue));
      pathIndices.push(Number(currentIndex & 1n));
      currentIndex >>= 1n;
    }

    // 每个学生凭证都携带完整的 Merkle 证明路径，学生侧浏览器 proving 会直接消费这些字段。
    return {
      version: 2,
      scoreSourceId: draft.scoreSourceIdLabel,
      scoreSourceIdBytes32,
      scoreSourceTitle: draft.sourceTitle,
      boundStudentAddress: record.boundStudentAddress,
      boundStudentField: toBigIntString(record.boundStudentField),
      candidateLabel: record.candidateLabel,
      candidateIdHash: record.candidateIdHash,
      score: record.score,
      maxScore: draft.maxScore,
      secretSalt: record.secretSalt,
      leaf: toBigIntString(record.leaf),
      merkleRoot: toBigIntString(merkleRoot),
      pathElements,
      pathIndices,
      issuedAt
    };
  });

  return {
    scoreSource: {
      scoreSourceIdLabel: draft.scoreSourceIdLabel,
      scoreSourceIdBytes32,
      scoreSourceIdField: scoreSourceIdField.toString(),
      sourceTitle: draft.sourceTitle,
      maxScore: draft.maxScore,
      merkleDepth: draft.merkleDepth,
      merkleRoot: toBigIntString(merkleRoot),
      merkleRootHex: toBytes32Hex(merkleRoot)
    },
    credentials
  };
}
