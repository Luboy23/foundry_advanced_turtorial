import path from "node:path";
import { formatAssetAmount } from "@/lib/format";
import { readJsonFile } from "@/lib/server/json";
import type { Address } from "@/types/contract-config";
import type { CreatorClaimPackage, CreatorSettlementBill, RevenueBatchSummary } from "@/types/domain";

/**
 * 这一层只负责把 server-data 里的私有工作输入装配成三种视图：
 * 1. 给人看的账单视图 CreatorSettlementBill；
 * 2. 给链上 claim 用的 CreatorClaimPackage；
 * 3. 给平台工作台展示的批次草稿 RevenueBatchSummary。
 * 三者字段看起来相似，但服务的读者完全不同，因此不在同一个对象里混用。
 */
const currentBillPath = path.join(process.cwd(), "server-data", "bills", "current.json");
const currentClaimPath = path.join(process.cwd(), "server-data", "claim-packages", "current.json");
const currentBatchPath = path.join(process.cwd(), "server-data", "batches", "current.json");

type StoredBreakdownLine = {
  label: string;
  amount: string;
  amountDisplay?: string;
  description: string;
};

type StoredSplitEntry = {
  role: "creator" | "collaborator";
  label: string;
  recipient: Address;
  bps: number;
  amount: string;
  amountDisplay?: string;
};

type StoredCurrentBill = Omit<CreatorSettlementBill, "status" | "grossAmountDisplay" | "creatorNetAmountDisplay" | "breakdown" | "splitRuleSnapshot"> & {
  status?: CreatorSettlementBill["status"];
  breakdown: StoredBreakdownLine[];
  splitRuleSnapshot: StoredSplitEntry[];
};

type StoredCurrentClaimPackage = {
  batchIdHex: `0x${string}`;
  claimIdHex: `0x${string}`;
  creator: Address;
  grossAmount: string;
  recipients: Address[];
  bps: number[];
  merkleProof: `0x${string}`[];
};

type StoredCurrentBatch = Omit<RevenueBatchSummary, "grossAmountDisplay" | "lastSyncedAt"> & {
  grossAmountDisplay?: string;
  lastSyncedAt?: string;
};

const emptyBill: StoredCurrentBill = {
  monthLabel: "2026-04",
  batchId: "2026-04",
  batchIdHex: "0x17c6c9f1db18f6f0c61bb64abd0c4f7766db5f1b3ce71f0f12dbf7595bd53d4f",
  billId: "BILL-202604-CREATOR",
  claimIdHex: "0x0",
  creatorAddress: "0x0000000000000000000000000000000000000000",
  assetSymbol: "ETH",
  grossAmount: "0",
  creatorNetAmount: "0",
  breakdown: [],
  splitRuleSnapshot: []
};

const emptyClaimPackage: StoredCurrentClaimPackage = {
  batchIdHex: "0x0",
  claimIdHex: "0x0",
  creator: "0x0000000000000000000000000000000000000000",
  grossAmount: "0",
  recipients: [],
  bps: [],
  merkleProof: []
};

const emptyBatch: StoredCurrentBatch = {
  batchId: "2026-04",
  batchIdHex: "0x17c6c9f1db18f6f0c61bb64abd0c4f7766db5f1b3ce71f0f12dbf7595bd53d4f",
  monthLabel: "2026-04",
  status: "draft",
  assetSymbol: "ETH",
  grossAmount: "0",
  grossAmountDisplay: "0.00",
  creatorCount: 0,
  collaboratorCount: 0,
  activeCreator: "0x0000000000000000000000000000000000000000",
  lastSyncedAt: new Date(0).toISOString()
};

/**
 * server-data 允许同时存原始金额和预格式化展示值。
 * 这里优先复用人工确认过的展示文案；只有缺失时才退回统一格式化逻辑，
 * 这样既保住页面展示稳定性，也避免不同来源的金额格式打架。
 */
function resolveDisplay(valueDisplay: string | undefined, value: string, variant: Parameters<typeof formatAssetAmount>[1]) {
  return typeof valueDisplay === "string" && valueDisplay.trim().length > 0
    ? valueDisplay
    : formatAssetAmount(value, variant);
}

/**
 * 读取“给创作者看”的当前账单原始输入。
 * 这份 JSON 是私有工作输入，不直接暴露给前端，而是后续再装配成产品视图。
 */
export function readCurrentBillInput() {
  return readJsonFile(currentBillPath, emptyBill);
}

/**
 * 读取“给链上 claim 用”的当前领取包原始输入。
 * 这里保留的是 proof、recipient、bps 等链上验证最小字段。
 */
export function readCurrentClaimPackageInput() {
  return readJsonFile(currentClaimPath, emptyClaimPackage);
}

/**
 * 读取“给平台工作台看”的当前批次草稿输入。
 * 它描述的是一份待发布或刚同步过的批次摘要，不天然等于链上真实状态。
 */
export function readCurrentBatchInput() {
  return readJsonFile(currentBatchPath, emptyBatch);
}

/**
 * 账单视图面向创作者工作台：
 * 它强调 monthLabel、billId、gross / net、breakdown 和 splitRuleSnapshot，
 * 也就是“这笔钱为什么这样分”的产品语义，而不是链上验证最小字段。
 */
export function buildCurrentBillView(
  input: StoredCurrentBill,
  status: CreatorSettlementBill["status"] = input.status ?? "draft"
): CreatorSettlementBill {
  return {
    monthLabel: input.monthLabel,
    batchId: input.batchId,
    batchIdHex: input.batchIdHex,
    billId: input.billId,
    claimIdHex: input.claimIdHex,
    creatorAddress: input.creatorAddress,
    assetSymbol: input.assetSymbol,
    grossAmount: input.grossAmount,
    creatorNetAmount: input.creatorNetAmount,
    grossAmountDisplay: formatAssetAmount(input.grossAmount, "summary"),
    creatorNetAmountDisplay: formatAssetAmount(input.creatorNetAmount, "summary"),
    status,
    breakdown: input.breakdown.map((item) => ({
      label: item.label,
      amount: item.amount,
      amountDisplay: resolveDisplay(item.amountDisplay, item.amount, "detail"),
      description: item.description
    })),
    splitRuleSnapshot: input.splitRuleSnapshot.map((entry) => ({
      role: entry.role,
      label: entry.label,
      recipient: entry.recipient,
      bps: entry.bps,
      amount: entry.amount,
      amountDisplay: resolveDisplay(entry.amountDisplay, entry.amount, "detail")
    }))
  };
}

/**
 * claim package 面向合约验证：
 * 它只保留 batchId / claimId / creator / grossAmount / recipients / bps / merkleProof，
 * 不携带 breakdown 这种只给人阅读的字段。
 * 这里故意优先复用 bill 里的 batchId / claimId / creator / grossAmount，
 * 是为了确保“用户看到的当前账单”和“用户真正送上链的领取包”指向同一笔结算。
 */
export function buildCurrentClaimPackageView(
  bill: CreatorSettlementBill,
  input: StoredCurrentClaimPackage
): CreatorClaimPackage & { billId: string } {
  return {
    billId: bill.billId,
    batchIdHex: bill.batchIdHex,
    claimIdHex: bill.claimIdHex,
    creator: bill.creatorAddress,
    grossAmount: bill.grossAmount,
    recipients: input.recipients,
    bps: input.bps,
    merkleProof: input.merkleProof
  };
}

/**
 * 批次草稿视图面向平台工作台：
 * 它描述“当前准备发布的批次长什么样”，但不天然代表链上已经发布成功。
 * 页面后续还会再结合链上状态，把它翻译成 draft / published / paused / closed。
 */
export function buildCurrentBatchDraftView(input: StoredCurrentBatch): RevenueBatchSummary {
  return {
    batchId: input.batchId,
    batchIdHex: input.batchIdHex,
    monthLabel: input.monthLabel,
    status: input.status,
    assetSymbol: input.assetSymbol,
    grossAmount: input.grossAmount,
    grossAmountDisplay: resolveDisplay(input.grossAmountDisplay, input.grossAmount, "summary"),
    creatorCount: input.creatorCount,
    collaboratorCount: input.collaboratorCount,
    activeCreator: input.activeCreator,
    lastSyncedAt: input.lastSyncedAt ?? new Date().toISOString()
  };
}
