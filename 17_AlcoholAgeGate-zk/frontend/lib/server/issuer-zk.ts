import "server-only";

import { createHash, randomBytes } from "crypto";
import { buildPoseidon } from "circomlibjs";
import { getAddress } from "viem";
import {
  calculateEligibleFromYmdFromBirthDate,
  getCurrentUtcYmd,
  parseStrictUtcDate
} from "@/lib/domain/age-eligibility";
import type {
  IssuerPendingSetSummary,
  IssuerUploadInvalidRow,
  IssuerUploadRecord,
  LocalAgeCredential
} from "@/types/domain";
import type { Address } from "@/types/contract-config";

// 年龄验证方上传链路的真正核心不在页面，而在这里：
// 它负责把“walletAddress,birthDate”名单转成 pending 身份集合、Merkle root 和可领取私有凭证。
const MERKLE_DEPTH = 20;
const SNARK_SCALAR_FIELD = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);
const CSV_HEADER = ["walletAddress", "birthDate"] as const;

type PoseidonHelpers = {
  hash2: (left: bigint, right: bigint) => bigint;
  hash5: (inputs: bigint[]) => bigint;
};

type NormalizedIssuerRecord = IssuerUploadRecord & {
  row: number;
  birthDateUnix: number;
  eligibleFromYmd: number;
};

type BuildPendingIssuerSetArgs = {
  setId: `0x${string}`;
  sourceTitle: string;
  version: number;
  baseVersion: number;
  referenceDate: number;
  issuer: string;
  records: NormalizedIssuerRecord[];
  invalidRows: IssuerUploadInvalidRow[];
  newBuyerAddresses: Address[];
};

type BuildPendingIssuerSetResult = {
  summary: IssuerPendingSetSummary;
  normalizedRecords: IssuerUploadRecord[];
  credentials: LocalAgeCredential[];
};

let poseidonPromise: Promise<PoseidonHelpers> | null = null;

function getPoseidonHelpers(): Promise<PoseidonHelpers> {
  if (!poseidonPromise) {
    poseidonPromise = buildPoseidon().then((poseidon: {
      F: {
        toString: (value: unknown) => string;
      };
      (inputs: bigint[]): unknown;
    }) => {
      const field = poseidon.F;

      return {
        hash2: (left: bigint, right: bigint) => BigInt(field.toString(poseidon([left, right]))),
        hash5: (inputs: bigint[]) => BigInt(field.toString(poseidon(inputs)))
      };
    });
  }

  return poseidonPromise;
}

function normalizeCsvLine(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

function parseCsvHeader(line: string) {
  return line.split(",").map((part) => part.trim());
}

function addressToField(value: Address) {
  return BigInt(value.toLowerCase()) % SNARK_SCALAR_FIELD;
}

function toBigIntString(value: bigint | number | string) {
  return BigInt(value).toString();
}

function bytes32ToSetIdLabel(value: `0x${string}`) {
  const raw = Buffer.from(value.slice(2), "hex");
  const trimmed = raw.subarray(0, raw.indexOf(0x00) >= 0 ? raw.indexOf(0x00) : raw.length).toString("utf8").trim();
  return trimmed.length > 0 ? trimmed : value;
}

function deriveIdentityHash(address: Address, birthDateUnix: number) {
  const digest = createHash("sha256")
    .update(`alcohol-age-gate.identity:${address.toLowerCase()}:${birthDateUnix}`)
    .digest("hex");

  return BigInt(`0x${digest}`) % SNARK_SCALAR_FIELD;
}

function createSecretSalt() {
  const digest = randomBytes(32).toString("hex");
  const nextValue = BigInt(`0x${digest}`) % SNARK_SCALAR_FIELD;
  return nextValue === 0n ? 1n : nextValue;
}

// 这里不再筛掉未成年人。
// 当前模型里，年龄验证方上传的是身份集合；是否已成年由后续验证时的当前 UTC 日期动态判断。
export function parseIssuerBuyerCsv(csvText: string, referenceDateInput: string) {
  const referenceDate = parseStrictUtcDate(referenceDateInput.trim());
  if (!referenceDate) {
    throw new Error("参考日期格式无效，请使用 YYYY-MM-DD。");
  }

  const rows = csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, index) => index === 0 || normalizeCsvLine(line).length > 0);

  if (rows.length === 0) {
    throw new Error("上传内容为空，请提供包含表头的 CSV。");
  }

  const header = parseCsvHeader(normalizeCsvLine(rows[0]));
  if (header.length !== CSV_HEADER.length || header.some((value, index) => value !== CSV_HEADER[index])) {
    throw new Error("CSV 表头必须为 walletAddress,birthDate。");
  }

  const invalidRows: IssuerUploadInvalidRow[] = [];
  const normalizedRecords: NormalizedIssuerRecord[] = [];
  const seenAddresses = new Set<string>();

  for (let index = 1; index < rows.length; index += 1) {
    const rowNumber = index + 1;
    const line = normalizeCsvLine(rows[index]);
    if (!line) {
      continue;
    }

    const columns = line.split(",").map((part) => part.trim());
    if (columns.length !== CSV_HEADER.length) {
      invalidRows.push({
        row: rowNumber,
        walletAddress: columns[0] ?? "",
        birthDate: columns[1] ?? "",
        reason: "列数不正确，请确保每行只包含钱包地址和生日。"
      });
      continue;
    }

    const [walletAddressRaw, birthDateRaw] = columns;
    let walletAddress: Address | null = null;

    try {
      walletAddress = getAddress(walletAddressRaw);
    } catch {
      invalidRows.push({
        row: rowNumber,
        walletAddress: walletAddressRaw,
        birthDate: birthDateRaw,
        reason: "钱包地址不是有效的 EVM 地址。"
      });
      continue;
    }

    const duplicateKey = walletAddress.toLowerCase();
    if (seenAddresses.has(duplicateKey)) {
      invalidRows.push({
        row: rowNumber,
        walletAddress: walletAddress,
        birthDate: birthDateRaw,
        reason: "该钱包地址在当前名单中重复出现。"
      });
      continue;
    }

    seenAddresses.add(duplicateKey);

    const birthDateUnix = parseStrictUtcDate(birthDateRaw);
    if (!birthDateUnix) {
      invalidRows.push({
        row: rowNumber,
        walletAddress,
        birthDate: birthDateRaw,
        reason: "生日格式无效，请使用 YYYY-MM-DD。"
      });
      continue;
    }

    const eligibleFromYmd = calculateEligibleFromYmdFromBirthDate(birthDateRaw);
    if (!eligibleFromYmd) {
      invalidRows.push({
        row: rowNumber,
        walletAddress,
        birthDate: birthDateRaw,
        reason: "当前未能计算该用户的成年日期，请检查生日字段。"
      });
      continue;
    }

    normalizedRecords.push({
      row: rowNumber,
      walletAddress,
      birthDate: birthDateRaw,
      birthDateUnix,
      eligibleFromYmd
    });
  }

  return {
    referenceDate,
    invalidRows,
    normalizedRecords
  };
}

export async function buildPendingIssuerSet(args: BuildPendingIssuerSetArgs): Promise<BuildPendingIssuerSetResult> {
  if (args.records.length === 0) {
    throw new Error("当前名单中没有可用于生成身份集合的有效记录。");
  }

  if (args.records.length > 2 ** MERKLE_DEPTH) {
    throw new Error(`当前名单超过支持上限，最多允许 ${2 ** MERKLE_DEPTH} 条记录。`);
  }

  const { hash2, hash5 } = await getPoseidonHelpers();
  const currentUtcYmd = getCurrentUtcYmd();
  const versionField = BigInt(args.version);

  // 叶子里承诺的不是“当前年龄”，而是不会随时间变化的身份字段 + 成年起始日 + 钱包绑定。
  const records = args.records.map((record, index) => {
    const identityHash = deriveIdentityHash(record.walletAddress, record.birthDateUnix);
    const secretSalt = createSecretSalt();
    const walletBinding = addressToField(record.walletAddress);

    return {
      ...record,
      index,
      identityHash,
      secretSalt,
      walletBinding,
      leaf: hash5([
        versionField,
        identityHash,
        BigInt(record.eligibleFromYmd),
        secretSalt,
        walletBinding
      ])
    };
  });

  const zeroLeaf = hash5([0n, 0n, 0n, 0n, 0n]);
  const zeroHashes = [zeroLeaf];
  for (let depth = 0; depth < MERKLE_DEPTH; depth += 1) {
    zeroHashes.push(hash2(zeroHashes[depth], zeroHashes[depth]));
  }

  let levelMap = new Map<bigint, bigint>();
  for (const record of records) {
    levelMap.set(BigInt(record.index), record.leaf);
  }

  // levelMaps 会保留每一层节点，后面生成 pathElements / pathIndices 时就不需要重新建树。
  const levelMaps = [new Map(levelMap)];
  for (let depth = 0; depth < MERKLE_DEPTH; depth += 1) {
    const parentMap = new Map<bigint, bigint>();
    const parentIndexes = [...new Set([...levelMap.keys()].map((value) => (value / 2n).toString()))]
      .map((value) => BigInt(value))
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

    if (parentIndexes.length === 0) {
      parentMap.set(0n, zeroHashes[depth + 1]);
    } else {
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

  const merkleRoot = levelMap.get(0n) ?? zeroHashes[MERKLE_DEPTH];
  const setIdLabel = bytes32ToSetIdLabel(args.setId);

  const credentials = records.map((record, index) => {
    let currentIndex = BigInt(record.index);
    const pathElements: string[] = [];
    const pathIndices: number[] = [];

    for (let depth = 0; depth < MERKLE_DEPTH; depth += 1) {
      const siblingIndex = currentIndex ^ 1n;
      const siblingValue = levelMaps[depth].get(siblingIndex) ?? zeroHashes[depth];
      pathElements.push(toBigIntString(siblingValue));
      pathIndices.push(Number(currentIndex & 1n));
      currentIndex >>= 1n;
    }

    const credentialId = createHash("sha256")
      .update(`alcohol-age-gate.credential:${args.setId}:${args.version}:${record.walletAddress.toLowerCase()}`)
      .digest("hex")
      .slice(0, 24);

    return {
      credentialId: `cred-${credentialId}`,
      setId: setIdLabel,
      setIdBytes32: args.setId,
      issuer: args.issuer,
      issuedAt: args.referenceDate + index,
      sourceTitle: args.sourceTitle,
      versionNumber: args.version,
      boundBuyerAddress: record.walletAddress,
      walletBinding: toBigIntString(record.walletBinding),
      birthDateMasked: record.birthDate.slice(0, 7),
      eligibleFromYmd: record.eligibleFromYmd,
      identityHash: toBigIntString(record.identityHash),
      secretSalt: toBigIntString(record.secretSalt),
      merkleRoot: toBigIntString(merkleRoot),
      pathElements,
      pathIndices,
      proofInputRef: `issuer-upload:${args.version}:${record.walletAddress.toLowerCase()}`
    } satisfies LocalAgeCredential;
  });

  return {
    summary: {
      setId: args.setId,
      sourceTitle: args.sourceTitle,
      version: args.version,
      baseVersion: args.baseVersion,
      referenceDate: args.referenceDate,
      merkleRoot: toBigIntString(merkleRoot),
      // 已成年 / 未成年数量是生成时的展示统计，不会改写成员本身的身份集合语义。
      memberCount: credentials.length,
      adultCountNow: credentials.filter((credential) => credential.eligibleFromYmd <= currentUtcYmd).length,
      minorCountNow: credentials.filter((credential) => credential.eligibleFromYmd > currentUtcYmd).length,
      invalidRows: args.invalidRows,
      updatedAt: Math.floor(Date.now() / 1000),
      buyerAddresses: credentials.map((credential) => credential.boundBuyerAddress),
      newBuyerCount: args.newBuyerAddresses.length,
      newBuyerAddresses: args.newBuyerAddresses
    },
    normalizedRecords: args.records.map((record) => ({
      walletAddress: record.walletAddress,
      birthDate: record.birthDate
    })),
    credentials
  };
}
