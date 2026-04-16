"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { getRuntimeFailureHistoryScope } from "@/lib/runtime-config";
import type { FailureHistoryEntry } from "@/types/domain";
import {
  appendFailureHistory,
  clearFailureHistory,
  getEmptyFailureHistorySnapshot,
  loadFailureHistory,
  reloadFailureHistory,
  subscribeFailureHistory
} from "@/lib/storage/failure-history";

export function useFailureHistory() {
  const config = useRuntimeConfig();
  const scopeKey = useMemo(() => getRuntimeFailureHistoryScope(config), [config]);

  const entries = useSyncExternalStore(
    useCallback((onStoreChange: () => void) => subscribeFailureHistory(scopeKey, onStoreChange), [scopeKey]),
    useCallback(() => loadFailureHistory(scopeKey), [scopeKey]),
    getEmptyFailureHistorySnapshot
  );

  const append = useCallback((entry: FailureHistoryEntry) => {
    appendFailureHistory(entry, scopeKey);
  }, [scopeKey]);

  const clear = useCallback(() => {
    clearFailureHistory(scopeKey);
  }, [scopeKey]);

  const reload = useCallback(() => {
    reloadFailureHistory(scopeKey);
  }, [scopeKey]);

  return useMemo(
    () => ({
      entries,
      append,
      clear,
      reload
    }),
    [append, clear, entries, reload]
  );
}
