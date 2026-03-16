import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePublicClient, useReadContract, useWatchContractEvent } from "wagmi";
import {
  decodeRegistryBook,
  registryAbi,
  registryAddress,
  type RegistryBook,
} from "@/lib/registry";
import { formatErrorMessage } from "@/lib/errors";

// 馆藏列表 Hook：按页拉取链上书籍并响应事件自动刷新。
type UseRegistryBooksOptions = {
  pageSize?: number;
  onlyActive?: boolean;
};

const DEFAULT_PAGE_SIZE = 20;
const EVENT_REFRESH_DEBOUNCE_MS = 300;

// 书籍读取统一入口：按页分段拉取 getBook，避免一次性全量请求
export function useRegistryBooks(options?: UseRegistryBooksOptions) {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const onlyActive = options?.onlyActive ?? false;
  const publicClient = usePublicClient();
  const [pages, setPages] = useState<Record<number, RegistryBook[]>>({});
  const pagesRef = useRef<Record<number, RegistryBook[]>>({});
  const [page, setPage] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [error, setError] = useState("");
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bookCountQuery = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getBookCount",
    query: { enabled: Boolean(registryAddress) },
  });

  const bookCount = bookCountQuery.data ? Number(bookCountQuery.data) : 0;
  const totalPages = Math.max(1, Math.ceil(bookCount / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const loadPage = useCallback(
    async (targetPage: number) => {
      const address = registryAddress;
      if (!address || !publicClient || bookCount === 0) return;
      if (pagesRef.current[targetPage]) return;

      setIsLoadingPage(true);
      const start = (targetPage - 1) * pageSize + 1;
      const end = Math.min(bookCount, start + pageSize - 1);
      try {
        // NOTE:
        // Some local chain definitions (e.g. custom Anvil) may not include multicall3 metadata.
        // To keep teaching/demo flows stable, we avoid hard dependency on multicall and
        // read each book in parallel instead.
        const decodedResults = await Promise.all(
          Array.from({ length: Math.max(end - start + 1, 0) }, async (_, index) => {
            try {
              const result = await publicClient.readContract({
                address,
                abi: registryAbi,
                functionName: "getBook",
                args: [BigInt(start + index)],
              });
              return decodeRegistryBook(result);
            } catch {
              return null;
            }
          })
        );
        const decoded = decodedResults.filter((book): book is RegistryBook => Boolean(book));
        setPages((prev) => {
          if (prev[targetPage]) {
            return prev;
          }
          return { ...prev, [targetPage]: decoded };
        });
        setError("");
      } catch (loadError) {
        setError(formatErrorMessage(loadError));
      } finally {
        setIsLoadingPage(false);
      }
    },
    [bookCount, pageSize, publicClient]
  );

  const resetAndRefetch = useCallback(() => {
    pagesRef.current = {};
    setPages((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    setPage((prev) => (prev === 1 ? prev : 1));
    setRefreshVersion((prev) => prev + 1);
    void bookCountQuery.refetch();
  }, [bookCountQuery]);

  const scheduleResetAndRefetch = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      resetAndRefetch();
    }, EVENT_REFRESH_DEBOUNCE_MS);
  }, [resetAndRefetch]);

  useWatchContractEvent({
    address: registryAddress,
    abi: registryAbi,
    eventName: "BookRegistered",
    enabled: Boolean(registryAddress),
    onLogs: () => scheduleResetAndRefetch(),
  });

  useWatchContractEvent({
    address: registryAddress,
    abi: registryAbi,
    eventName: "BookActiveSet",
    enabled: Boolean(registryAddress),
    onLogs: () => scheduleResetAndRefetch(),
  });

  useWatchContractEvent({
    address: registryAddress,
    abi: registryAbi,
    eventName: "BookInventoryUpdated",
    enabled: Boolean(registryAddress),
    onLogs: () => scheduleResetAndRefetch(),
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
      setPages((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setPage((prev) => (prev === 1 ? prev : 1));
      return;
    }
    if (bookCount === 0) {
      setPages((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    void loadPage(safePage);
  }, [bookCount, safePage, loadPage, refreshVersion]);

  useEffect(() => {
    if (safePage !== page) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const books = useMemo(() => {
    const orderedPages = Object.keys(pages)
      .map((value) => Number(value))
      .sort((a, b) => a - b);
    const merged = orderedPages.flatMap((currentPage) => pages[currentPage] ?? []);
    return onlyActive ? merged.filter((book) => book.active) : merged;
  }, [onlyActive, pages]);

  const loadedBookCount = books.length;
  const hasMore = loadedBookCount < bookCount;

  const loadMore = () => {
    if (!hasMore) return;
    setPage((prev) => Math.min(prev + 1, totalPages));
  };

  const isInitialLoading =
    bookCountQuery.isLoading || (bookCount > 0 && books.length === 0 && isLoadingPage);

  return {
    books,
    bookCount,
    loadedBookCount,
    hasMore,
    isLoading: isInitialLoading,
    isLoadingMore: isLoadingPage && books.length > 0,
    error,
    loadMore,
    refresh: resetAndRefetch,
  };
}
