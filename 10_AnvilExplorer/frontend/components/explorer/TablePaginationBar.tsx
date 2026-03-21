"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getTableParamKey } from "@/lib/table-query";

/**
 * 表格分页条：负责上一页/下一页与页码信息展示。
 */
export default function TablePaginationBar({
  namespace,
  page,
  totalPages,
  total,
}: {
  namespace: string;
  page: number;
  totalPages: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pageKey = getTableParamKey(namespace, "page");

  /**
   * 写入下一页页码到 URL。
   */
  const updatePage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set(pageKey, String(nextPage));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/75 bg-white/70 px-3 py-2 text-xs text-slate-600 md:flex-row md:items-center md:justify-between">
      <span>
        共 {total} 条，当前第 {page} / {totalPages} 页
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 rounded-lg border-white/80 bg-white/90"
          disabled={page <= 1}
          onClick={() => updatePage(page - 1)}
        >
          上一页
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 rounded-lg border-white/80 bg-white/90"
          disabled={page >= totalPages}
          onClick={() => updatePage(page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
