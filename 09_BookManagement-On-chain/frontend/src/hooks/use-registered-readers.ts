import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePublicClient, useReadContract, useWatchContractEvent } from "wagmi";
import {
  decodeRegisteredReader,
  registryAbi,
  registryAddress,
  type RegisteredReader,
} from "@/lib/registry";
import { formatErrorMessage } from "@/lib/errors";

// 读者列表 Hook：负责注册读者全量读取、排序与事件刷新。
const EVENT_REFRESH_DEBOUNCE_MS = 300;

// 链上注册用户读取：供管理端借阅登记和用户管理复用
export function useRegisteredReaders() {
  const publicClient = usePublicClient();
  const [readers, setReaders] = useState<RegisteredReader[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [error, setError] = useState("");
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readerCountQuery = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getReaderCount",
    query: { enabled: Boolean(registryAddress) },
  });

  const readerCount = Number(readerCountQuery.data ?? BigInt(0));

  const loadRows = useCallback(async (totalReaders: number) => {
    const address = registryAddress;
    if (!address || !publicClient) {
      setReaders([]);
      setError("");
      return;
    }
    if (totalReaders <= 0) {
      setReaders([]);
      setError("");
      return;
    }

    setIsLoadingRows(true);
    try {
      const rows = await Promise.all(
        Array.from({ length: totalReaders }, async (_, index) => {
          try {
            const result = await publicClient.readContract({
              address,
              abi: registryAbi,
              functionName: "getReaderAt" as const,
              args: [BigInt(index)] as const,
            });
            return decodeRegisteredReader(result);
          } catch {
            return null;
          }
        })
      );
      const decoded = rows
        .filter((row): row is RegisteredReader => Boolean(row))
        .sort((a, b) => {
          if (a.registeredAt === b.registeredAt) {
            return a.reader.localeCompare(b.reader);
          }
          return a.registeredAt > b.registeredAt ? -1 : 1;
        });
      setReaders(decoded);
      setError("");
    } catch (loadError) {
      setError(formatErrorMessage(loadError));
    } finally {
      setIsLoadingRows(false);
    }
  }, [publicClient]);

  const refresh = useCallback(async () => {
    const result = await readerCountQuery.refetch();
    const latestCount = Number(result.data ?? BigInt(0));
    await loadRows(latestCount);
  }, [loadRows, readerCountQuery]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, EVENT_REFRESH_DEBOUNCE_MS);
  }, [refresh]);

  useWatchContractEvent({
    address: registryAddress,
    abi: registryAbi,
    eventName: "ReaderRegistered",
    enabled: Boolean(registryAddress),
    onLogs: () => scheduleRefresh(),
  });

  useWatchContractEvent({
    address: registryAddress,
    abi: registryAbi,
    eventName: "ReaderStatusUpdated",
    enabled: Boolean(registryAddress),
    onLogs: () => scheduleRefresh(),
  });

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!registryAddress) {
      setReaders([]);
      setError("");
      return;
    }
    void loadRows(readerCount);
  }, [loadRows, readerCount]);

  const activeReaders = useMemo(() => readers.filter((row) => row.active), [readers]);

  return {
    readers,
    activeReaders,
    readerCount,
    isLoading: readerCountQuery.isLoading || isLoadingRows,
    error,
    refresh,
  };
}
