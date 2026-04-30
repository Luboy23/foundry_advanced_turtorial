import fs from "node:fs";
import path from "node:path";
import {
  encodeAbiParameters,
  encodePacked,
  formatUnits,
  keccak256,
  parseAbiParameters,
  parseEther,
  toBytes
} from "viem";
import { formatAssetAmount } from "@/lib/format";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";
import type { BatchLabelMap } from "@/types/contract-config";
import type { PlatformActivationPreviewResponse, PlatformMonthlyConfig } from "@/types/domain";

const SPLIT_BPS = [6000, 2000, 2000] as const;
const METADATA_SALT = "creator-revenue-center";

const runtimeConfigPath = path.join(process.cwd(), "public", "contract-config.json");
const currentBillPath = path.join(process.cwd(), "server-data", "bills", "current.json");
const currentClaimPackagePath = path.join(process.cwd(), "server-data", "claim-packages", "current.json");
const currentBatchPath = path.join(process.cwd(), "server-data", "batches", "current.json");
const monthlyConfigsPath = path.join(process.cwd(), "server-data", "batches", "monthly-configs.json");

const leafAbiParameters = parseAbiParameters(
  "bytes32 batchId, bytes32 claimId, address creator, uint256 grossAmount, address[] recipients, uint16[] bps"
);

type StoredMonthlyConfig = {
  monthLabel: string;
  grossAmount: string;
  updatedAt: string;
  isLocked: boolean;
  lockedAt: string | null;
};

type DerivedMonthlyArtifacts = {
  monthLabel: string;
  billId: string;
  batchIdHex: `0x${string}`;
  claimIdHex: `0x${string}`;
  grossAmount: bigint;
  creatorNetAmount: bigint;
  collaboratorAAmount: bigint;
  collaboratorBAmount: bigint;
  recipients: [`0x${string}`, `0x${string}`, `0x${string}`];
  bps: [number, number, number];
  merkleRoot: `0x${string}`;
  metadataHash: `0x${string}`;
};

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath: string, payload: unknown) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function isValidMonthLabel(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function normalizeMonthLabel(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeWeiString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  try {
    const asBigInt = BigInt(trimmed);
    if (asBigInt <= 0n) return null;
    return asBigInt.toString();
  } catch {
    return null;
  }
}

function toBillId(monthLabel: string) {
  return `BILL-${monthLabel.replace("-", "")}-CREATOR`;
}

function compareMonthDesc(left: string, right: string) {
  if (left === right) return 0;
  return left > right ? -1 : 1;
}

function toEthInputDisplay(value: string) {
  const decimal = formatUnits(BigInt(value), 18);
  return decimal.replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
}

function getMinAllowedMonth(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function deriveMonthlyArtifacts(monthLabel: string, grossAmount: bigint): DerivedMonthlyArtifacts {
  const config = readRuntimeConfigForScript();
  const billId = toBillId(monthLabel);
  const batchIdHex = keccak256(toBytes(monthLabel));
  const claimIdHex = keccak256(toBytes(billId));

  const recipients = [
    config.demoAddresses.creator,
    config.demoAddresses.collaboratorA,
    config.demoAddresses.collaboratorB
  ] as [`0x${string}`, `0x${string}`, `0x${string}`];

  const creatorNetAmount = (grossAmount * BigInt(SPLIT_BPS[0])) / 10_000n;
  const collaboratorAAmount = (grossAmount * BigInt(SPLIT_BPS[1])) / 10_000n;
  const collaboratorBAmount = grossAmount - creatorNetAmount - collaboratorAAmount;

  const merkleRoot = keccak256(
    encodeAbiParameters(leafAbiParameters, [
      batchIdHex,
      claimIdHex,
      config.demoAddresses.creator,
      grossAmount,
      recipients,
      [...SPLIT_BPS]
    ])
  );

  const metadataHash = keccak256(
    encodePacked(["string", "string", "string"], [monthLabel, billId, METADATA_SALT])
  );

  return {
    monthLabel,
    billId,
    batchIdHex,
    claimIdHex,
    grossAmount,
    creatorNetAmount,
    collaboratorAAmount,
    collaboratorBAmount,
    recipients,
    bps: [...SPLIT_BPS],
    merkleRoot,
    metadataHash
  };
}

function fallbackStoredMonthlyConfigs() {
  const config = readRuntimeConfigForScript();
  const currentBill = readJson<{ monthLabel?: string; grossAmount?: string } | null>(currentBillPath, null);
  const fallbackMonth = normalizeMonthLabel(currentBill?.monthLabel) || config.activeBatchLabel;
  const fallbackGross = normalizeWeiString(currentBill?.grossAmount) ?? "1";
  const updatedAt = new Date().toISOString();

  if (!isValidMonthLabel(fallbackMonth)) {
    return [] as StoredMonthlyConfig[];
  }

  return [
    {
      monthLabel: fallbackMonth,
      grossAmount: fallbackGross,
      updatedAt,
      isLocked: true,
      lockedAt: updatedAt
    }
  ];
}

function normalizeStoredMonthlyConfigs(input: unknown) {
  if (!Array.isArray(input)) {
    return fallbackStoredMonthlyConfigs();
  }

  const map = new Map<string, StoredMonthlyConfig>();
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const monthLabel = normalizeMonthLabel((item as { monthLabel?: unknown }).monthLabel);
    const grossAmount = normalizeWeiString((item as { grossAmount?: unknown }).grossAmount);
    if (!isValidMonthLabel(monthLabel) || !grossAmount) continue;

    const updatedAtRaw = (item as { updatedAt?: unknown }).updatedAt;
    const updatedAt =
      typeof updatedAtRaw === "string" && updatedAtRaw.trim().length > 0
        ? updatedAtRaw
        : new Date().toISOString();
    const isLocked = Boolean((item as { isLocked?: unknown }).isLocked);
    const lockedAtRaw = (item as { lockedAt?: unknown }).lockedAt;
    const lockedAt =
      typeof lockedAtRaw === "string" && lockedAtRaw.trim().length > 0
        ? lockedAtRaw
        : isLocked
          ? updatedAt
          : null;

    map.set(monthLabel, { monthLabel, grossAmount, updatedAt, isLocked, lockedAt });
  }

  const normalized = [...map.values()].sort((left, right) => compareMonthDesc(left.monthLabel, right.monthLabel));
  return normalized.length ? normalized : fallbackStoredMonthlyConfigs();
}

function readStoredMonthlyConfigs() {
  return normalizeStoredMonthlyConfigs(readJson<unknown>(monthlyConfigsPath, []));
}

function toMonthlyConfigView(entry: StoredMonthlyConfig, activeMonth: string | null): PlatformMonthlyConfig {
  const grossAmount = BigInt(entry.grossAmount);
  const creatorNetAmount = (grossAmount * BigInt(SPLIT_BPS[0])) / 10_000n;

  return {
    monthLabel: entry.monthLabel,
    grossAmount: entry.grossAmount,
    grossAmountDisplay: formatAssetAmount(entry.grossAmount, "summary"),
    creatorNetAmount: creatorNetAmount.toString(),
    creatorNetAmountDisplay: formatAssetAmount(creatorNetAmount, "summary"),
    isActive: activeMonth != null && entry.monthLabel === activeMonth,
    updatedAt: entry.updatedAt,
    isLocked: entry.isLocked,
    lockedAt: entry.lockedAt
  };
}

function buildBatchLabelMap(entries: StoredMonthlyConfig[], existing: unknown): BatchLabelMap {
  const next: Record<`0x${string}`, string> =
    existing && typeof existing === "object" ? ({ ...(existing as Record<`0x${string}`, string>) } as Record<`0x${string}`, string>) : {};

  for (const entry of entries) {
    next[keccak256(toBytes(entry.monthLabel))] = entry.monthLabel;
  }

  return next as BatchLabelMap;
}

function writeActiveArtifacts(artifacts: DerivedMonthlyArtifacts, entries: StoredMonthlyConfig[]) {
  const config = readRuntimeConfigForScript();
  const grossAmountDisplay = formatAssetAmount(artifacts.grossAmount, "summary");
  const creatorNetAmountDisplay = formatAssetAmount(artifacts.creatorNetAmount, "summary");
  const collaboratorAAmountDisplay = formatAssetAmount(artifacts.collaboratorAAmount, "detail");
  const collaboratorBAmountDisplay = formatAssetAmount(artifacts.collaboratorBAmount, "detail");
  const adRevenue = (artifacts.grossAmount * 80n) / 100n;
  const membershipBonus = artifacts.grossAmount - adRevenue;

  writeJson(currentBillPath, {
    monthLabel: artifacts.monthLabel,
    batchId: artifacts.monthLabel,
    batchIdHex: artifacts.batchIdHex,
    billId: artifacts.billId,
    claimIdHex: artifacts.claimIdHex,
    creatorAddress: config.demoAddresses.creator,
    assetSymbol: "ETH",
    grossAmount: artifacts.grossAmount.toString(),
    creatorNetAmount: artifacts.creatorNetAmount.toString(),
    grossAmountDisplay,
    creatorNetAmountDisplay,
    status: "claimable",
    breakdown: [
      {
        label: "广告分成收益",
        amount: adRevenue.toString(),
        amountDisplay: formatAssetAmount(adRevenue, "detail"),
        description: `基于 ${artifacts.monthLabel} 平台结算结果`
      },
      {
        label: "会员激励奖金",
        amount: membershipBonus.toString(),
        amountDisplay: formatAssetAmount(membershipBonus, "detail"),
        description: `基于 ${artifacts.monthLabel} 互动激励汇总`
      }
    ],
    splitRuleSnapshot: [
      {
        role: "creator",
        label: "个人所得",
        recipient: config.demoAddresses.creator,
        bps: SPLIT_BPS[0],
        amount: artifacts.creatorNetAmount.toString(),
        amountDisplay: formatAssetAmount(artifacts.creatorNetAmount, "detail")
      },
      {
        role: "collaborator",
        label: "编导",
        recipient: config.demoAddresses.collaboratorA,
        bps: SPLIT_BPS[1],
        amount: artifacts.collaboratorAAmount.toString(),
        amountDisplay: collaboratorAAmountDisplay
      },
      {
        role: "collaborator",
        label: "摄影",
        recipient: config.demoAddresses.collaboratorB,
        bps: SPLIT_BPS[2],
        amount: artifacts.collaboratorBAmount.toString(),
        amountDisplay: collaboratorBAmountDisplay
      }
    ]
  });

  writeJson(currentClaimPackagePath, {
    batchIdHex: artifacts.batchIdHex,
    claimIdHex: artifacts.claimIdHex,
    creator: config.demoAddresses.creator,
    grossAmount: artifacts.grossAmount.toString(),
    recipients: artifacts.recipients,
    bps: artifacts.bps,
    merkleProof: []
  });

  writeJson(currentBatchPath, {
    batchId: artifacts.monthLabel,
    batchIdHex: artifacts.batchIdHex,
    monthLabel: artifacts.monthLabel,
    status: "published",
    assetSymbol: "ETH",
    grossAmount: artifacts.grossAmount.toString(),
    grossAmountDisplay,
    creatorCount: 1,
    collaboratorCount: 2,
    activeCreator: config.demoAddresses.creator,
    lastSyncedAt: new Date().toISOString()
  });

  const runtimeConfig = readJson<Record<string, unknown>>(runtimeConfigPath, {});
  const nextBatchLabelMap = buildBatchLabelMap(entries, runtimeConfig.batchLabelMap);
  writeJson(runtimeConfigPath, {
    ...runtimeConfig,
    activeBatchId: artifacts.batchIdHex,
    activeBatchLabel: artifacts.monthLabel,
    activeBillId: artifacts.billId,
    activeBatchRoot: artifacts.merkleRoot,
    activeMetadataHash: artifacts.metadataHash,
    batchLabelMap: nextBatchLabelMap
  });
}

function validateActivationInput(monthLabelInput: string, grossAmountEthInput: string) {
  const monthLabel = normalizeMonthLabel(monthLabelInput);
  if (!isValidMonthLabel(monthLabel)) {
    throw new Error("月份格式不正确，请使用 YYYY-MM。");
  }

  const minAllowedMonth = getMinAllowedMonth();
  if (monthLabel < minAllowedMonth) {
    throw new Error(`当前只能录入 ${minAllowedMonth} 及之后的月份收益。`);
  }

  const grossInput = typeof grossAmountEthInput === "string" ? grossAmountEthInput.trim() : "";
  if (!grossInput) {
    throw new Error("请输入结算总额。");
  }

  let grossAmount: bigint;
  try {
    grossAmount = parseEther(grossInput);
  } catch {
    throw new Error("结算总额格式不正确，请输入合法 ETH 金额。");
  }

  if (grossAmount <= 0n) {
    throw new Error("结算总额必须大于 0。");
  }

  const entries = readStoredMonthlyConfigs();
  const existing = entries.find((entry) => entry.monthLabel === monthLabel);
  if (existing?.isLocked) {
    throw new Error(`月份 ${monthLabel} 已经激活上链，不能再次设置或补资。`);
  }

  return {
    monthLabel,
    grossAmount,
    grossAmountEth: grossInput,
    minAllowedMonth,
    entries
  };
}

export function readPlatformMonthlyConfigs() {
  const config = readRuntimeConfigForScript();
  const entries = readStoredMonthlyConfigs();
  const activeMonth = entries.some((entry) => entry.monthLabel === config.activeBatchLabel)
    ? config.activeBatchLabel
    : (entries[0]?.monthLabel ?? null);

  return {
    configs: entries.map((entry) => toMonthlyConfigView(entry, activeMonth)),
    activeMonth,
    minAllowedMonth: getMinAllowedMonth()
  };
}

export function previewPlatformMonthlyActivation(input: {
  monthLabel: string;
  grossAmountEth: string;
}): PlatformActivationPreviewResponse {
  const validated = validateActivationInput(input.monthLabel, input.grossAmountEth);
  const artifacts = deriveMonthlyArtifacts(validated.monthLabel, validated.grossAmount);

  return {
    monthLabel: artifacts.monthLabel,
    billId: artifacts.billId,
    batchIdHex: artifacts.batchIdHex,
    claimIdHex: artifacts.claimIdHex,
    merkleRoot: artifacts.merkleRoot,
    metadataHash: artifacts.metadataHash,
    grossAmount: artifacts.grossAmount.toString(),
    grossAmountWei: artifacts.grossAmount.toString(),
    grossAmountDisplay: formatAssetAmount(artifacts.grossAmount, "summary"),
    creator: artifacts.recipients[0],
    minAllowedMonth: validated.minAllowedMonth
  };
}

export function commitPlatformMonthlyActivation(input: {
  monthLabel: string;
  grossAmountEth: string;
}) {
  const validated = validateActivationInput(input.monthLabel, input.grossAmountEth);
  const artifacts = deriveMonthlyArtifacts(validated.monthLabel, validated.grossAmount);
  const now = new Date().toISOString();

  const nextMap = new Map(validated.entries.map((entry) => [entry.monthLabel, entry] as const));
  nextMap.set(validated.monthLabel, {
    monthLabel: validated.monthLabel,
    grossAmount: validated.grossAmount.toString(),
    updatedAt: now,
    isLocked: true,
    lockedAt: now
  });

  const nextEntries = [...nextMap.values()].sort((left, right) => compareMonthDesc(left.monthLabel, right.monthLabel));
  writeJson(monthlyConfigsPath, nextEntries);
  writeActiveArtifacts(artifacts, nextEntries);

  return {
    configs: nextEntries.map((entry) => toMonthlyConfigView(entry, validated.monthLabel)),
    activeMonth: validated.monthLabel,
    minAllowedMonth: validated.minAllowedMonth,
    activeBatch: {
      monthLabel: validated.monthLabel,
      grossAmountEth: toEthInputDisplay(validated.grossAmount.toString()),
      batchIdHex: artifacts.batchIdHex
    }
  };
}
