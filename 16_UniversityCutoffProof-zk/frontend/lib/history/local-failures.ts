import type { Address, ContractConfig } from "@/types/contract-config";
import type { LocalFailureHistoryItem } from "@/types/history";

const STORAGE_PREFIX = "zk-exam-pass:admission-failures:v2";
const LEGACY_STORAGE_PREFIX = "zk-exam-pass:admission-failures";

function getStorageScope(config: ContractConfig) {
  return [
    config.chainId,
    config.universityAdmissionVerifierAddress.toLowerCase(),
    config.scoreRootRegistryAddress.toLowerCase()
  ].join(":");
}

function getStorageKey(address: Address, config: ContractConfig) {
  return `${STORAGE_PREFIX}:${getStorageScope(config)}:${address.toLowerCase()}`;
}

function getLegacyStorageKey(address: Address) {
  return `${LEGACY_STORAGE_PREFIX}:${address.toLowerCase()}`;
}

export function getLocalFailureFingerprint(item: LocalFailureHistoryItem) {
  return [
    item.walletAddress.toLowerCase(),
    item.schoolId.toLowerCase(),
    item.score,
    item.cutoffScore,
    item.versionId ?? "unknown"
  ].join(":");
}

export function normalizeLocalFailureHistory(items: LocalFailureHistoryItem[]) {
  const seen = new Set<string>();
  const normalized: LocalFailureHistoryItem[] = [];

  for (const item of items) {
    const fingerprint = getLocalFailureFingerprint(item);
    if (seen.has(fingerprint)) {
      continue;
    }
    seen.add(fingerprint);
    normalized.push(item);
  }

  return normalized.slice(0, 20);
}

function readHistoryFromStorage(storage: Storage, key: string): LocalFailureHistoryItem[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as LocalFailureHistoryItem[]) : [];
}

export function readLocalFailureHistory(address: Address, config: ContractConfig): LocalFailureHistoryItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    // 老版本把本地阻断记录直接放在 localStorage 且没有按部署隔离，容易把旧演示数据继续带出来。
    window.localStorage.removeItem(getLegacyStorageKey(address));

    const storageKey = getStorageKey(address, config);
    const normalized = normalizeLocalFailureHistory(readHistoryFromStorage(window.sessionStorage, storageKey));
    window.sessionStorage.setItem(storageKey, JSON.stringify(normalized));
    return normalized;
  } catch {
    return [];
  }
}

export function appendLocalFailureHistory(address: Address, config: ContractConfig, item: LocalFailureHistoryItem) {
  if (typeof window === "undefined") {
    return;
  }

  const existing = readLocalFailureHistory(address, config);
  const fingerprint = getLocalFailureFingerprint(item);
  if (existing.some((historyItem) => getLocalFailureFingerprint(historyItem) === fingerprint)) {
    return;
  }

  const next = normalizeLocalFailureHistory([item, ...existing]);
  window.sessionStorage.setItem(getStorageKey(address, config), JSON.stringify(next));
}
