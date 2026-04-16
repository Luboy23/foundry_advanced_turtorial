import type { PendingActionEntry } from "@/types/domain";

const PENDING_ACTIONS_KEY_PREFIX = "alcohol-age-gate.pending-actions";
const EMPTY_PENDING_ACTIONS: PendingActionEntry[] = [];

let cachedScope = "default";
let cachedRaw: string | null | undefined;
let cachedActions: PendingActionEntry[] = EMPTY_PENDING_ACTIONS;

function getPendingActionsKey(scopeKey: string) {
  return `${PENDING_ACTIONS_KEY_PREFIX}:${scopeKey}`;
}

function getPendingActionsEvent(scopeKey: string) {
  return `${PENDING_ACTIONS_KEY_PREFIX}:change:${scopeKey}`;
}

function ensurePendingActionsScope(scopeKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (cachedScope !== scopeKey) {
    cachedScope = scopeKey;
    cachedRaw = undefined;
    cachedActions = EMPTY_PENDING_ACTIONS;
  }
}

function emitPendingActionsChange(scopeKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(getPendingActionsEvent(scopeKey)));
}

export function loadPendingActions(scopeKey: string) {
  if (typeof window === "undefined") {
    return cachedActions;
  }

  ensurePendingActionsScope(scopeKey);

  try {
    const raw = window.sessionStorage.getItem(getPendingActionsKey(scopeKey));
    if (raw === cachedRaw) {
      return cachedActions;
    }

    cachedRaw = raw;
    cachedActions = raw ? (JSON.parse(raw) as PendingActionEntry[]) : EMPTY_PENDING_ACTIONS;
    return cachedActions;
  } catch {
    cachedRaw = null;
    cachedActions = EMPTY_PENDING_ACTIONS;
    return cachedActions;
  }
}

function persistPendingActions(next: PendingActionEntry[], scopeKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  ensurePendingActionsScope(scopeKey);
  const raw = JSON.stringify(next);
  window.sessionStorage.setItem(getPendingActionsKey(scopeKey), raw);
  cachedRaw = raw;
  cachedActions = next;
  emitPendingActionsChange(scopeKey);
}

export function upsertPendingAction(entry: PendingActionEntry, scopeKey: string) {
  const current = loadPendingActions(scopeKey);
  const next = [...current.filter((item) => item.kind !== entry.kind), entry];
  persistPendingActions(next, scopeKey);
}

export function removePendingAction(kind: PendingActionEntry["kind"], scopeKey: string) {
  const current = loadPendingActions(scopeKey);
  const next = current.filter((item) => item.kind !== kind);
  persistPendingActions(next, scopeKey);
}

export function subscribePendingActions(scopeKey: string, onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  ensurePendingActionsScope(scopeKey);
  const handleChange = () => onStoreChange();
  window.addEventListener("storage", handleChange);
  window.addEventListener(getPendingActionsEvent(scopeKey), handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(getPendingActionsEvent(scopeKey), handleChange);
  };
}

export function reloadPendingActions(scopeKey: string) {
  ensurePendingActionsScope(scopeKey);
  emitPendingActionsChange(scopeKey);
}

export function getEmptyPendingActionsSnapshot() {
  return EMPTY_PENDING_ACTIONS;
}
