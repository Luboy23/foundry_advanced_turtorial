"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTableParamKey } from "@/lib/table-query";

type SortOption = {
  value: string;
  label: string;
};

/**
 * 基于当前 URL 参数生成下一个查询参数对象。
 */
function buildParams(
  searchParams: URLSearchParams,
  updates: Record<string, string | null>
): URLSearchParams {
  const next = new URLSearchParams(searchParams.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      next.delete(key);
      continue;
    }
    next.set(key, value);
  }
  return next;
}

/**
 * 表格工具栏：筛选 + 排序 + 页大小 + 重置。
 */
export default function TableToolbar({
  namespace,
  sortOptions,
  filterPlaceholder,
  defaultPageSize = 20,
}: {
  namespace: string;
  sortOptions: SortOption[];
  filterPlaceholder: string;
  defaultPageSize?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 所有键名都带 namespace，避免多表格同页参数冲突。
  const pageKey = getTableParamKey(namespace, "page");
  const pageSizeKey = getTableParamKey(namespace, "pageSize");
  const sortKey = getTableParamKey(namespace, "sort");
  const orderKey = getTableParamKey(namespace, "order");
  const filterKey = getTableParamKey(namespace, "filter");

  const sort = searchParams.get(sortKey) ?? sortOptions[0]?.value ?? "";
  const order = searchParams.get(orderKey) === "asc" ? "asc" : "desc";
  const pageSize = searchParams.get(pageSizeKey) ?? String(defaultPageSize);
  const filter = searchParams.get(filterKey) ?? "";

  const [draftFilter, setDraftFilter] = useState(filter);

  useEffect(() => {
    // URL 变化时，同步输入框草稿值。
    setDraftFilter(filter);
  }, [filter]);

  // 判断是否存在可被“重置”清理的筛选状态。
  const hasAnyFilter = useMemo(() => {
    return Boolean(filter) || searchParams.has(sortKey) || searchParams.has(orderKey);
  }, [filter, searchParams, sortKey, orderKey]);

  /**
   * 提交 URL 参数更新，保持 SPA 无滚动刷新。
   */
  const commit = (updates: Record<string, string | null>) => {
    const next = buildParams(searchParams, updates);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/75 bg-white/70 p-2.5 md:flex-row md:items-center md:justify-between">
      <form
        className="flex min-w-0 flex-1 items-center gap-2"
        onSubmit={(event) => {
          // 提交筛选时强制回到第一页。
          event.preventDefault();
          commit({
            [filterKey]: draftFilter.trim() || null,
            [pageKey]: "1",
          });
        }}
      >
        <Input
          value={draftFilter}
          onChange={(event) => setDraftFilter(event.target.value)}
          placeholder={filterPlaceholder}
          className="h-8 min-w-0 border-white/75 bg-white/90 text-xs"
        />
        <Button
          type="submit"
          size="sm"
          className="h-8 border border-zinc-700/55 bg-gradient-to-r from-zinc-900 to-zinc-700 text-white hover:from-zinc-800 hover:to-zinc-600"
        >
          应用
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="interactive-ring h-8 rounded-lg border border-white/80 bg-white/90 px-2 text-xs text-slate-700"
          value={sort}
          onChange={(event) => {
            commit({
              [sortKey]: event.target.value,
              [pageKey]: "1",
            });
          }}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              排序: {option.label}
            </option>
          ))}
        </select>
        <select
          className="interactive-ring h-8 rounded-lg border border-white/80 bg-white/90 px-2 text-xs text-slate-700"
          value={order}
          onChange={(event) => {
            commit({
              [orderKey]: event.target.value,
              [pageKey]: "1",
            });
          }}
        >
          <option value="desc">降序</option>
          <option value="asc">升序</option>
        </select>
        <select
          className="interactive-ring h-8 rounded-lg border border-white/80 bg-white/90 px-2 text-xs text-slate-700"
          value={pageSize}
          onChange={(event) => {
            commit({
              [pageSizeKey]: event.target.value,
              [pageKey]: "1",
            });
          }}
        >
          <option value="10">10 / 页</option>
          <option value="20">20 / 页</option>
          <option value="50">50 / 页</option>
          <option value="100">100 / 页</option>
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 rounded-lg border-white/80 bg-white/85 text-slate-700"
          disabled={!hasAnyFilter}
          onClick={() => {
            commit({
              [sortKey]: null,
              [orderKey]: null,
              [filterKey]: null,
              [pageKey]: "1",
            });
          }}
        >
          重置
        </Button>
      </div>
    </div>
  );
}
