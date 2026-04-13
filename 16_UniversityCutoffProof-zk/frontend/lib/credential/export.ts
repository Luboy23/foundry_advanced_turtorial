import type { AdmissionCredential } from "@/types/credential";
import type { AuthorityImportPayload, ScoreRecordInput, ScoreSourceDraft, SampleScoreSource } from "@/types/admission";
import { addressToField, bytes32HexToField } from "@/lib/zk/proof-input";
import { buildPoseidon } from "@/lib/zk/poseidon";
import { asciiToBytes32Hex } from "@/lib/admission/rule-version";
import { isAddress } from "@/lib/utils";
import type { Address } from "@/types/contract-config";

// 当前教学项目固定使用深度为 20 的成绩树。
const DEFAULT_MERKLE_DEPTH = 20;

// Poseidon 初始化成本较高，因此在浏览器里做成惰性单例，避免每次导入草稿都重新构造。
let poseidonPromise: Promise<{
  hash2: (left: bigint, right: bigint) => bigint;
  hash5: (values: Array<string | number | bigint>) => bigint;
}> | null = null;

// 同时提供 2 入和 5 入 Poseidon，分别服务 Merkle 树节点哈希和成绩叶子哈希。
function getPoseidonHelpers() {
  if (!poseidonPromise) {
    poseidonPromise = (async () => {
      const poseidon = await buildPoseidon();
      const field = poseidon.F;
      return {
        hash2: (left: bigint, right: bigint) =>
          BigInt(field.toString(poseidon([left, right]))),
        hash5: (values: Array<string | number | bigint>) =>
          BigInt(field.toString(poseidon(values.map((value) => BigInt(value)))))
      };
    })();
  }

  return poseidonPromise;
}

// 统一把 bigint 输出成十进制字符串，避免 JSON 无法原生表示 bigint。
function toBigIntString(value: bigint) {
  return value.toString(10);
}

// 用于把 Merkle Root 同时导出成 bytes32 友好的十六进制表现。
function toBytes32Hex(value: bigint) {
  return `0x${value.toString(16).padStart(64, "0")}` as `0x${string}`;
}

// 对导入的单条学生记录做结构校验，尽量在考试院工作台前置发现脏数据。
function validateRecord(record: ScoreRecordInput, maxScore: number) {
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
  if (!Number.isInteger(record.score) || record.score < 0 || record.score > maxScore) {
    throw new Error(`学生 ${record.candidateLabel} 的成绩不正确。`);
  }
}

// 把考试院导入的原始 JSON 收敛成浏览器内可继续生成成绩树和凭证的草稿对象。
export function parseAuthorityImportJson(raw: string): ScoreSourceDraft {
  let parsed: AuthorityImportPayload;

  try {
    parsed = JSON.parse(raw) as AuthorityImportPayload;
  } catch {
    throw new Error("成绩文件格式不正确。");
  }

  // 当前教学流程里，考试院上传的文件只负责“本届成绩 + 学生记录”。
  // 如果历史模板里仍残留 schools 字段，解析器会直接忽略，不让考试院承担设线职责。
  if (!parsed?.scoreSource || typeof parsed.scoreSource !== "object") {
    throw new Error("缺少成绩源信息。");
  }
  if (!Array.isArray(parsed.records) || parsed.records.length === 0) {
    throw new Error("成绩记录不能为空。");
  }

  const scoreSourceIdLabel = parsed.scoreSource.scoreSourceIdLabel?.trim();
  const sourceTitle = parsed.scoreSource.sourceTitle?.trim();
  const maxScore = Number(parsed.scoreSource.maxScore);
  const merkleDepth = Number(parsed.scoreSource.merkleDepth ?? DEFAULT_MERKLE_DEPTH);

  if (!scoreSourceIdLabel) {
    throw new Error("成绩源编号不能为空。");
  }
  if (!sourceTitle) {
    throw new Error("成绩批次名称不能为空。");
  }
  if (!Number.isInteger(maxScore) || maxScore <= 0) {
    throw new Error("总分必须是正整数。");
  }
  if (merkleDepth !== DEFAULT_MERKLE_DEPTH) {
    throw new Error("当前系统暂不支持该成绩文件格式。");
  }

  const records = parsed.records.map((record) => ({
    candidateLabel: String(record.candidateLabel ?? "").trim(),
    candidateIdHash: String(record.candidateIdHash ?? "").trim(),
    score: Number(record.score),
    secretSalt: String(record.secretSalt ?? "").trim(),
    boundStudentAddress: String(record.boundStudentAddress ?? "").trim() as Address
  }));

  for (const record of records) {
    validateRecord(record, maxScore);
  }

  return {
    scoreSourceIdLabel,
    sourceTitle,
    maxScore,
    merkleDepth,
    records
  };
}

// 根据考试院草稿在浏览器内重新生成成绩树和全体学生成绩凭证。
// 这是“无后端教学模式”下最核心的本地签发步骤。
export async function generateCredentialsFromDraft(draft: ScoreSourceDraft): Promise<{
  scoreSource: SampleScoreSource;
  credentials: AdmissionCredential[];
}> {
  const { hash2, hash5 } = await getPoseidonHelpers();
  const scoreSourceIdBytes32 = asciiToBytes32Hex(draft.scoreSourceIdLabel);
  const scoreSourceIdField = bytes32HexToField(scoreSourceIdBytes32);

  // 先构造所有层级的零值哈希，供未填满的 Merkle 树节点回退使用。
  const zeroLeaf = hash5([0n, 0n, 0n, 0n, 0n]);
  const zeroHashes = [zeroLeaf];
  for (let depth = 0; depth < draft.merkleDepth; depth += 1) {
    zeroHashes.push(hash2(zeroHashes[depth], zeroHashes[depth]));
  }

  const records = draft.records.map((record, index) => ({
    ...record,
    index,
    boundStudentField: addressToField(record.boundStudentAddress),
    // 叶子同时绑定成绩源、学生身份摘要、成绩、安全盐和学生钱包地址。
    leaf: hash5([
      scoreSourceIdField,
      record.candidateIdHash,
      record.score,
      record.secretSalt,
      addressToField(record.boundStudentAddress)
    ])
  }));

  let levelMap = new Map<bigint, bigint>();
  for (const record of records) {
    levelMap.set(BigInt(record.index), record.leaf);
  }

  // 自底向上构建整棵 Merkle 树，并把每一层节点缓存下来，后面生成路径时可以直接复用。
  const levelMaps = [new Map(levelMap)];
  for (let depth = 0; depth < draft.merkleDepth; depth += 1) {
    const parentMap = new Map<bigint, bigint>();
    const parentIndexSet = new Set([...levelMap.keys()].map((index) => (index / 2n).toString()));

    if (parentIndexSet.size === 0) {
      parentMap.set(0n, zeroHashes[depth + 1]);
    } else {
      const parentIndexes = [...parentIndexSet].map((value) => BigInt(value)).sort((left, right) => (left < right ? -1 : 1));
      for (const parentIndex of parentIndexes) {
        const leftIndex = parentIndex * 2n;
        const rightIndex = leftIndex + 1n;
        const leftNode = levelMap.get(leftIndex) ?? zeroHashes[depth];
        const rightNode = levelMap.get(rightIndex) ?? zeroHashes[depth];
        parentMap.set(parentIndex, hash2(leftNode, rightNode));
      }
    }

    levelMap = parentMap;
    levelMaps.push(new Map(levelMap));
  }

  const merkleRoot = levelMap.get(0n) ?? zeroHashes[draft.merkleDepth];
  const issuedAt = Math.floor(Date.now() / 1000);

  // 逐个学生回填完整路径，得到可以直接发放给学生侧的成绩凭证。
  const credentials: AdmissionCredential[] = records.map((record) => {
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

// 在浏览器里导出 JSON 文件，供考试院发放成绩凭证或批量导出整包数据。
export function downloadJsonFile(fileName: string, payload: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json"
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
