"use client";

import { useEffect, useState } from "react";
import type { Address } from "@/types/contract-config";
import type { FailureHistoryEntry } from "@/types/domain";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import {
  appendFailureHistory,
  clearFailureHistory,
  loadFailureHistory,
  subscribeFailureHistory
} from "@/lib/storage/failure-history";

/** 订阅并操作当前地址对应的本地失败历史。 */
export function useFailureHistory(address?: Address) {
  const config = useRuntimeConfig();
  const [entries, setEntries] = useState<FailureHistoryEntry[]>([]);

  useEffect(() => {
    if (!address) {
      return () => {};
    }

    // 失败历史既可能由当前页写入，也可能由其他标签页写入，因此统一走订阅刷新。
    const applySnapshot = () => {
      setEntries(loadFailureHistory(config, address));
    };

    applySnapshot();
    const unsubscribe = subscribeFailureHistory(applySnapshot);
    return unsubscribe;
  }, [address, config]);

  /** 追加一条新的失败记录。 */
  function addEntry(entry: FailureHistoryEntry) {
    if (!address) {
      return;
    }

    appendFailureHistory(config, address, entry);
  }

  /** 清空当前地址的失败历史。 */
  function clearEntries() {
    if (!address) {
      return;
    }

    clearFailureHistory(config, address);
  }

  return {
    entries: address ? entries : [],
    addEntry,
    clearEntries
  };
}
