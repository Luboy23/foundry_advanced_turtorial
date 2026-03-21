"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildSearchHref, parseSearchTarget } from "@/lib/search";

/**
 * 全局搜索框：识别区块/交易/地址并跳转到对应详情页。
 */
export default function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 输入辅助提示：根据当前 query 实时给出类型识别反馈。
  const helper = useMemo(() => {
    const target = parseSearchTarget(query);
    if (!query.trim()) return "输入区块号 / 交易哈希 / 地址";
    if (!target) return "无法识别输入类型";
    if (target.type === "block") return "识别为区块号";
    if (target.type === "tx") return "识别为交易哈希";
    return "识别为地址";
  }, [query]);

  /**
   * 提交搜索并执行路由跳转。
   */
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = parseSearchTarget(query);
    if (!target) {
      setError("请输入合法区块号、交易哈希或地址");
      return;
    }

    const href = buildSearchHref(target);
    setError(null);
    setQuery("");

    router.push(href);
  };

  return (
    <form className="w-full min-w-0 space-y-1 md:w-[440px]" onSubmit={handleSubmit}>
      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(event) => {
            // 输入变化时实时清理旧错误提示。
            setQuery(event.target.value);
            if (error) setError(null);
          }}
          placeholder="搜索区块号 / Tx Hash / 地址"
          className="h-9 border-white/75 bg-white/85 text-xs"
        />
        <Button
          type="submit"
          className="h-9 border border-zinc-700/55 bg-gradient-to-r from-zinc-900 to-zinc-700 text-white shadow-[0_10px_20px_-14px_rgba(0,0,0,0.45)] hover:from-zinc-800 hover:to-zinc-600"
        >
          <Search className="size-4" />
          搜索
        </Button>
      </div>
      <p className="text-[11px] text-slate-500">{error ?? helper}</p>
    </form>
  );
}
