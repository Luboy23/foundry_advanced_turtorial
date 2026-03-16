import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePublicClient, useReadContract, useWatchContractEvent } from "wagmi";
import {
  decodeBorrowRecord,
  registryAbi,
  registryAddress,
  type RegistryBorrowRecord,
} from "@/lib/registry";
import { formatErrorMessage } from "@/lib/errors";

// 借阅流水 Hook：维护“最新优先 + 可分页加载”的读取状态。
const RECORD_PAGE_SIZE = 20;
const EVENT_REFRESH_DEBOUNCE_MS = 300;

// 链上借阅流水读取：按索引读取并按最新优先排序。
export function useBorrowRecords() {
  const publicClient = usePublicClient();
  const [records, setRecords] = useState<RegistryBorrowRecord[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [error, setError] = useState("");
  const [loadedCount, setLoadedCount] = useState(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const countQuery = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getBorrowRecordCount",
    query: { enabled: Boolean(registryAddress) },
  });

  const count = Number(countQuery.data ?? BigInt(0));

  const fetchChunk = useCallback(async (totalCount: number, offset: number, size: number) => {
    const address = registryAddress;
    if (!address || !publicClient || totalCount <= offset) return [];

    const chunkSize = Math.min(size, totalCount - offset);
    const newestIndex = totalCount - 1 - offset;
    const indexes = Array.from({ length: chunkSize }, (_, index) => newestIndex - index);

    const rows = await Promise.all(
      indexes.map(async (index) => {
        try {
          const result = await publicClient.readContract({
            address,
            abi: registryAbi,
            functionName: "getBorrowRecordAt",
            args: [BigInt(index)],
          });
          return decodeBorrowRecord(result);
        } catch {
          return null;
        }
      })
    );

    return rows.filter((row): row is RegistryBorrowRecord => Boolean(row));
  }, [publicClient]);

  const loadRows = useCallback(async (totalCount: number) => {
    const address = registryAddress;
    if (!address || !publicClient || totalCount <= 0) {
      setRecords([]);
      setLoadedCount(0);
      setError("");
      return;
    }


    setIsLoadingRows(true);
    try {
      const decoded = await fetchChunk(totalCount, 0, RECORD_PAGE_SIZE);
      setRecords(decoded);
      setLoadedCount(decoded.length);
      setError("");
    } catch (loadError) {
      setError(formatErrorMessage(loadError));
    } finally {
      setIsLoadingRows(false);
    }
  }, [fetchChunk, publicClient]);

  const refresh = useCallback(async () => {
    const result = await countQuery.refetch();
    const latestCount = Number(result.data ?? BigInt(0));
    await loadRows(latestCount);
  }, [countQuery, loadRows]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, EVENT_REFRESH_DEBOUNCE_MS);
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (loadedCount >= count) return;
    setIsLoadingRows(true);
    try {
      const chunk = await fetchChunk(count, loadedCount, RECORD_PAGE_SIZE);
      setRecords((prev) => [...prev, ...chunk]);
      setLoadedCount((prev) => prev + chunk.length);
      setError("");
    } catch (loadError) {
      setError(formatErrorMessage(loadError));
    } finally {
      setIsLoadingRows(false);
    }
  }, [count, fetchChunk, loadedCount]);

  useWatchContractEvent({
    address: registryAddress,
    abi: registryAbi,
    eventName: "BorrowRecorded",
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
      setRecords([]);
      setLoadedCount(0);
      setError("");
      return;
    }
    void loadRows(count);
  }, [count, loadRows]);

  const latestRecords = useMemo(() => records.slice(0, 10), [records]);
  const hasMore = loadedCount < count;

  return {
    records,
    latestRecords,
    count,
    hasMore,
    isLoading: countQuery.isLoading || isLoadingRows,
    error,
    refresh,
    loadMore,
  };
}
