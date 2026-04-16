import type { FailureHistoryEntry } from "@/types/domain";

const FAILURE_HISTORY_KEY_PREFIX = "alcohol-age-gate.failure-history";
const LEGACY_FAILURE_HISTORY_KEY = "alcohol-age-gate.failure-history";
const EMPTY_FAILURE_HISTORY: FailureHistoryEntry[] = [];

let cachedScope = "default";
let cachedFailureHistoryRaw: string | null | undefined;
let cachedFailureHistory: FailureHistoryEntry[] = EMPTY_FAILURE_HISTORY;

function getFailureHistoryKey(scopeKey: string) {
  return `${FAILURE_HISTORY_KEY_PREFIX}:${scopeKey}`;
}

function getFailureHistoryEvent(scopeKey: string) {
  return `${FAILURE_HISTORY_KEY_PREFIX}:change:${scopeKey}`;
}

function ensureFailureHistoryScope(scopeKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (cachedScope !== scopeKey) {
    cachedScope = scopeKey;
    cachedFailureHistoryRaw = undefined;
    cachedFailureHistory = EMPTY_FAILURE_HISTORY;
  }

  if (window.localStorage.getItem(LEGACY_FAILURE_HISTORY_KEY) !== null) {
    window.localStorage.removeItem(LEGACY_FAILURE_HISTORY_KEY);
  }
}

function emitFailureHistoryChange(scopeKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(getFailureHistoryEvent(scopeKey)));
}

export function loadFailureHistory(scopeKey: string): FailureHistoryEntry[] {
  if (typeof window === "undefined") {
    return cachedFailureHistory;
  }

  ensureFailureHistoryScope(scopeKey);

  try {
    const raw = window.localStorage.getItem(getFailureHistoryKey(scopeKey));
    if (raw === cachedFailureHistoryRaw) {
      return cachedFailureHistory;
    }

    cachedFailureHistoryRaw = raw;
    cachedFailureHistory = raw ? (JSON.parse(raw) as FailureHistoryEntry[]) : EMPTY_FAILURE_HISTORY;
    return cachedFailureHistory;
  } catch {
    cachedFailureHistoryRaw = null;
    cachedFailureHistory = EMPTY_FAILURE_HISTORY;
    return cachedFailureHistory;
  }
}

export function appendFailureHistory(entry: FailureHistoryEntry, scopeKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  ensureFailureHistoryScope(scopeKey);

  const next = [entry, ...loadFailureHistory(scopeKey)].slice(0, 20);
  const raw = JSON.stringify(next);
  window.localStorage.setItem(getFailureHistoryKey(scopeKey), raw);
  cachedFailureHistoryRaw = raw;
  cachedFailureHistory = next;
  emitFailureHistoryChange(scopeKey);
}

export function clearFailureHistory(scopeKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  ensureFailureHistoryScope(scopeKey);

  window.localStorage.removeItem(getFailureHistoryKey(scopeKey));
  cachedFailureHistoryRaw = null;
  cachedFailureHistory = EMPTY_FAILURE_HISTORY;
  emitFailureHistoryChange(scopeKey);
}

export function subscribeFailureHistory(scopeKey: string, onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  ensureFailureHistoryScope(scopeKey);

  const handleChange = () => onStoreChange();
  window.addEventListener("storage", handleChange);
  window.addEventListener(getFailureHistoryEvent(scopeKey), handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(getFailureHistoryEvent(scopeKey), handleChange);
  };
}

export function reloadFailureHistory(scopeKey: string) {
  ensureFailureHistoryScope(scopeKey);
  emitFailureHistoryChange(scopeKey);
}

export function getEmptyFailureHistorySnapshot() {
  return EMPTY_FAILURE_HISTORY;
}
