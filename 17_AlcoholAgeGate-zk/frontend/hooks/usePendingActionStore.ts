"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { getRuntimeFailureHistoryScope } from "@/lib/runtime-config";
import type { PendingActionEntry, PendingActionKind } from "@/types/domain";
import {
  getEmptyPendingActionsSnapshot,
  loadPendingActions,
  reloadPendingActions,
  removePendingAction,
  subscribePendingActions,
  upsertPendingAction
} from "@/lib/storage/pending-actions";

export function usePendingActionStore() {
  const config = useRuntimeConfig();
  const scopeKey = useMemo(() => getRuntimeFailureHistoryScope(config), [config]);
  const entries = useSyncExternalStore(
    useCallback((onStoreChange: () => void) => subscribePendingActions(scopeKey, onStoreChange), [scopeKey]),
    useCallback(() => loadPendingActions(scopeKey), [scopeKey]),
    getEmptyPendingActionsSnapshot
  );

  const upsert = useCallback((entry: PendingActionEntry) => {
    upsertPendingAction(entry, scopeKey);
  }, [scopeKey]);

  const clear = useCallback((kind: PendingActionKind) => {
    removePendingAction(kind, scopeKey);
  }, [scopeKey]);

  const reload = useCallback(() => {
    reloadPendingActions(scopeKey);
  }, [scopeKey]);

  const findByKind = useCallback((kind: PendingActionKind) => entries.find((entry) => entry.kind === kind) ?? null, [entries]);

  return useMemo(
    () => ({
      entries,
      upsert,
      clear,
      reload,
      findByKind
    }),
    [clear, entries, findByKind, reload, upsert]
  );
}
