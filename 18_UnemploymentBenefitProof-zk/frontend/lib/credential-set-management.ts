import { buildPoseidon } from "circomlibjs";
import type { Address } from "@/types/contract-config";
import type {
  LocalUnemploymentCredential,
  ResolvedCredentialSetDraftInput,
  SampleCredentialSetRecord
} from "@/types/domain";
export {
  CREDENTIAL_SET_ID_LABEL,
  CREDENTIAL_SET_MERKLE_DEPTH,
  CREDENTIAL_SET_SOURCE_TITLE,
  createEmptyApplicantRecord,
  credentialSetRecordsAreEqual,
  draftsAreEqual,
  getTodayReferenceDate,
  normalizeCredentialSetDraftInput,
  normalizeResolvedCredentialSetDraftInput,
  parseReferenceDateInput,
  referenceDateToInputValue,
  validateCredentialSetDraftInput,
  validateResolvedCredentialSetDraftInput,
  type ApplicantRowErrors,
  type CredentialSetDraftValidationResult,
  type ResolvedCredentialSetDraftValidationResult
} from "@/lib/credential-set-management.shared";
import {
  CREDENTIAL_SET_ID_LABEL,
  CREDENTIAL_SET_MERKLE_DEPTH,
  CREDENTIAL_SET_SOURCE_TITLE,
  credentialSetRecordsAreEqual,
  normalizeResolvedCredentialSetDraftInput,
  validateResolvedCredentialSetDraftInput
} from "@/lib/credential-set-management.shared";

/**
 * 资格名单草稿处理与产物生成工具。
 *
 * 这个文件专门承载生成 Merkle 集合与私有凭证所需的重逻辑，会依赖 Poseidon、Buffer
 * 和路径构建算法。client page 不应直接引入它；纯前端表单编辑逻辑应改用
 * `credential-set-management.shared` 中的轻量函数。
 */
const SNARK_SCALAR_FIELD = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

let poseidonHelpersPromise:
  | Promise<{
      hash2: (left: bigint, right: bigint) => bigint;
      hash3: (inputs: Array<bigint | string | number>) => bigint;
    }>
  | null = null;

/**
 * 把稳定的集合标识编码成 bytes32。
 *
 * 这里固定使用 UTF-8 文本加右侧补零，目的是让链上 setId 和链下样例文件始终共享同一
 * 份标识，不需要额外维护另一套映射表。
 */
function asciiToBytes32Hex(value: string): `0x${string}` {
  const raw = Buffer.from(value, "utf8");
  if (raw.length > 32) {
    throw new Error("资格名单标识长度超过 bytes32 上限。");
  }

  return `0x${Buffer.concat([raw, Buffer.alloc(32 - raw.length)]).toString("hex")}` as `0x${string}`;
}

/**
 * 把钱包地址映射到电路有限域中的字段值。
 *
 * zk 电路不能直接处理 160 bit 地址语义，所以这里统一用 mod scalar field 的方式把
 * 地址转成 field element，并在前后端与 Worker 中保持完全一致。
 */
function addressToField(value: Address) {
  return BigInt(value.toLowerCase()) % SNARK_SCALAR_FIELD;
}

/** 把各种 bigint-like 输入统一转成十进制字符串，便于写入 JSON 样例和私有凭证。 */
function toBigIntString(value: bigint | number | string) {
  return BigInt(value).toString();
}

/** 把 bigint-like 输入转成 bytes32 十六进制，便于与链上参数保持一致。 */
function toBytes32Hex(value: bigint | number | string): `0x${string}` {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}` as `0x${string}`;
}

/**
 * 延迟初始化 Poseidon 帮助函数。
 *
 * 构建名单时会频繁做 leaf/hash 路径计算，因此这里把 Poseidon 初始化缓存成单例 Promise，
 * 避免同一轮编辑或服务端处理里重复初始化 wasm。
 */
async function getPoseidonHelpers() {
  if (!poseidonHelpersPromise) {
    poseidonHelpersPromise = buildPoseidon().then((poseidon) => {
      const field = poseidon.F;
      return {
        hash2: (left: bigint, right: bigint) => BigInt(field.toString(poseidon([left, right]))),
        hash3: (inputs: Array<bigint | string | number>) =>
          BigInt(field.toString(poseidon(inputs.map((value) => BigInt(value)))))
      };
    });
  }

  return poseidonHelpersPromise;
}

/**
 * 从 resolved 草稿构建完整的资格名单产物。
 *
 * 返回值同时包含：
 * 1. 发布到链上的名单摘要信息；
 * 2. 按申请人拆分的私有凭证样例；
 * 3. 每个申请人后续生成 zk 证明所需的路径元素和索引。
 */
export async function buildCredentialSetArtifacts(input: ResolvedCredentialSetDraftInput): Promise<{
  set: SampleCredentialSetRecord;
  credentials: LocalUnemploymentCredential[];
}> {
  const validation = validateResolvedCredentialSetDraftInput(input);
  if (!validation.valid) {
    throw new Error(validation.errors[0] ?? "资格名单数据无效。");
  }

  const normalizedInput = validation.normalizedInput;
  const { hash2, hash3 } = await getPoseidonHelpers();
  const setIdBytes32 = asciiToBytes32Hex(CREDENTIAL_SET_ID_LABEL);

  // 先把每条记录变成稳定 leaf。后续不论是写快照还是给申请人签发私有凭证，都基于同一份 leaf。
  const records = normalizedInput.records.map((record, index) => {
    const applicantAddress = record.applicantAddress as Address;
    const walletBinding = addressToField(applicantAddress);
    const identityHash = BigInt(record.identityHash);
    const secretSalt = BigInt(record.secretSalt);

    return {
      ...record,
      index,
      applicantAddress,
      identityHash,
      secretSalt,
      walletBinding,
      leaf: hash3([identityHash, secretSalt, walletBinding])
    };
  });

  const zeroLeaf = hash3([0n, 0n, 0n]);
  const zeroHashes = [zeroLeaf];
  // 预先算出每一层的零值节点，便于处理“名单未铺满整棵树”的教学场景。
  for (let depth = 0; depth < CREDENTIAL_SET_MERKLE_DEPTH; depth += 1) {
    zeroHashes.push(hash2(zeroHashes[depth], zeroHashes[depth]));
  }

  let levelMap = new Map<bigint, bigint>();
  for (const record of records) {
    levelMap.set(BigInt(record.index), record.leaf);
  }

  const levelMaps = [new Map(levelMap)];
  // 自底向上构建 Merkle tree，每一层都保留节点映射，后面生成 pathElements 时会直接复用。
  for (let depth = 0; depth < CREDENTIAL_SET_MERKLE_DEPTH; depth += 1) {
    const parentMap = new Map<bigint, bigint>();
    const parentIndexes = new Set([...levelMap.keys()].map((value) => (value / 2n).toString()));

    if (parentIndexes.size === 0) {
      parentMap.set(0n, zeroHashes[depth + 1]);
    } else {
      const sortedParentIndexes = [...parentIndexes]
        .map((value) => BigInt(value))
        .sort((left, right) => (left < right ? -1 : 1));

      for (const parentIndex of sortedParentIndexes) {
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

  const merkleRoot = levelMap.get(0n) ?? zeroHashes[CREDENTIAL_SET_MERKLE_DEPTH];

  // 为每个申请人收集从 leaf 到 root 的路径，供本地生成 zk proof 时直接使用。
  const credentials: LocalUnemploymentCredential[] = records.map((record) => {
    let currentIndex = BigInt(record.index);
    const pathElements: string[] = [];
    const pathIndices: number[] = [];

    for (let depth = 0; depth < CREDENTIAL_SET_MERKLE_DEPTH; depth += 1) {
      const siblingIndex = currentIndex ^ 1n;
      const siblingValue = levelMaps[depth].get(siblingIndex) ?? zeroHashes[depth];
      pathElements.push(toBigIntString(siblingValue));
      pathIndices.push(Number(currentIndex & 1n));
      currentIndex >>= 1n;
    }

    return {
      version: 1,
      setId: CREDENTIAL_SET_ID_LABEL,
      setIdBytes32,
      sourceTitle: CREDENTIAL_SET_SOURCE_TITLE,
      versionNumber: normalizedInput.version,
      referenceDate: normalizedInput.referenceDate,
      boundApplicantAddress: record.applicantAddress,
      walletBinding: toBigIntString(record.walletBinding),
      identityHash: toBigIntString(record.identityHash),
      secretSalt: toBigIntString(record.secretSalt),
      leaf: toBigIntString(record.leaf),
      merkleRoot: toBigIntString(merkleRoot),
      pathElements,
      pathIndices,
      issuedAt: normalizedInput.referenceDate,
      applicantLabel: record.applicantLabel || undefined
    };
  });

  return {
    set: {
      setIdLabel: CREDENTIAL_SET_ID_LABEL,
      setIdBytes32,
      sourceTitle: CREDENTIAL_SET_SOURCE_TITLE,
      version: normalizedInput.version,
      referenceDate: normalizedInput.referenceDate,
      merkleDepth: CREDENTIAL_SET_MERKLE_DEPTH,
      merkleRoot: toBigIntString(merkleRoot),
      merkleRootHex: toBytes32Hex(merkleRoot),
      eligibleCount: credentials.length
    },
    credentials
  };
}
