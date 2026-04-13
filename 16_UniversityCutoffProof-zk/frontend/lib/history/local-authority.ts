import type { ScoreSourceDraft } from "@/types/admission";
import type { ContractConfig } from "@/types/contract-config";
import type { AuthorityIssuanceRecord } from "@/types/history";

const STORAGE_PREFIX = "zk-exam-pass:authority:v2";
const LEGACY_DRAFT_KEY = "zk-exam-pass:authority:draft";
const LEGACY_PUBLISH_KEY = "zk-exam-pass:authority:publish-records";
const LEGACY_ISSUANCE_KEY = "zk-exam-pass:authority:issuance-records";

// 考试院本地草稿和记录必须跟当前链、当前部署地址一起作用域隔离。
// 否则重新 make dev 之后，浏览器会把上一轮演示数据错误地带进来。
function getStorageScope(config: ContractConfig) {
  return [
    config.chainId,
    config.scoreRootRegistryAddress.toLowerCase(),
    config.universityAdmissionVerifierAddress.toLowerCase()
  ].join(":");
}

// 统一收口所有考试院本地 key，避免不同调用点各自拼接字符串造成作用域漂移。
function getStorageKey(config: ContractConfig, kind: "draft" | "publish-records" | "issuance-records") {
  return `${STORAGE_PREFIX}:${getStorageScope(config)}:${kind}`;
}

export function readAuthorityDraft(config: ContractConfig): ScoreSourceDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    window.localStorage.removeItem(LEGACY_DRAFT_KEY);
    const raw = window.localStorage.getItem(getStorageKey(config, "draft"));
    if (!raw) return null;
    return JSON.parse(raw) as ScoreSourceDraft;
  } catch {
    return null;
  }
}

// 写入考试院当前草稿。
// 草稿只存在浏览器本地，不代表链上已经发布本届成绩。
export function writeAuthorityDraft(config: ContractConfig, draft: ScoreSourceDraft) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStorageKey(config, "draft"), JSON.stringify(draft));
}

// 清空考试院当前草稿，通常用于重置导入流程或切换到新一届成绩。
export function clearAuthorityDraft(config: ContractConfig) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getStorageKey(config, "draft"));
}

// 旧版考试院页面把发布记录放在浏览器本地，容易让用户误以为那是链上真相。
// 当前版本改成只展示链上事件，因此升级时主动清掉本地 publish 缓存。
export function clearAuthorityLegacyPublishRecords(config: ContractConfig) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LEGACY_PUBLISH_KEY);
  window.localStorage.removeItem(getStorageKey(config, "publish-records"));
}

function readList<T>(config: ContractConfig, kind: "publish-records" | "issuance-records", legacyKey: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    window.localStorage.removeItem(legacyKey);
    const key = getStorageKey(config, kind);
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

// 写列表时不做 merge，只负责原子替换；
// 真正的“追加一条并截断保留长度”策略交给 append* 系列函数统一管理。
function writeList<T>(config: ContractConfig, kind: "publish-records" | "issuance-records", value: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStorageKey(config, kind), JSON.stringify(value));
}

export function readAuthorityIssuanceRecords(config: ContractConfig) {
  return readList<AuthorityIssuanceRecord>(config, "issuance-records", LEGACY_ISSUANCE_KEY);
}

// 追加一条单学生凭证发放记录。
export function appendAuthorityIssuanceRecord(config: ContractConfig, record: AuthorityIssuanceRecord) {
  const next = [record, ...readAuthorityIssuanceRecords(config)].slice(0, 50);
  writeList(config, "issuance-records", next);
}

// 批量追加凭证发放记录，服务“一键导出全部学生凭证”的教学场景。
export function appendAuthorityIssuanceRecords(config: ContractConfig, records: AuthorityIssuanceRecord[]) {
  if (!records.length) {
    return;
  }

  const next = [...records, ...readAuthorityIssuanceRecords(config)].slice(0, 50);
  writeList(config, "issuance-records", next);
}
