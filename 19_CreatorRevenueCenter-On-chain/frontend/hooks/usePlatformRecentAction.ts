"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type PlatformRecentBatchAction = {
  action: "resume" | "pause" | "close";
  hash: `0x${string}`;
  blockNumber: string;
  updatedAt: string;
};

function buildStorageKey(scope: string) {
  return `creator-revenue-center:platform-recent-action:${scope}`;
}

function readStoredAction(storageKey: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlatformRecentBatchAction;
    return parsed?.action && parsed?.hash ? parsed : null;
  } catch {
    return null;
  }
}

export function usePlatformRecentAction(scope: string) {
  const storageKey = useMemo(() => buildStorageKey(scope), [scope]);
  const [lastAction, setLastAction] = useState<PlatformRecentBatchAction | null>(null);

  useEffect(() => {
    setLastAction(readStoredAction(storageKey));
  }, [storageKey]);

  const rememberAction = useCallback(
    (action: { action: PlatformRecentBatchAction["action"]; hash: `0x${string}`; blockNumber: bigint | string }) => {
      const value: PlatformRecentBatchAction = {
        action: action.action,
        hash: action.hash,
        blockNumber: String(action.blockNumber),
        updatedAt: new Date().toISOString()
      };

      setLastAction(value);

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(storageKey, JSON.stringify(value));
      }
    },
    [storageKey]
  );

  return {
    lastAction,
    rememberAction
  };
}
