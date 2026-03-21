"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import GlobalSearch from "@/components/explorer/GlobalSearch";
import RefreshControl from "@/components/explorer/RefreshControl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// 顶部导航配置。
const NAV_ITEMS = [
  { href: "/", label: "首页" },
  { href: "/block", label: "区块", matchPrefix: true },
  { href: "/tx", label: "交易", matchPrefix: true },
  { href: "/address", label: "地址", matchPrefix: true },
  { href: "/status", label: "链状态" },
  { href: "/cast", label: "Cast" },
];

/**
 * 导航链接组：
 * - 支持 hash 路由高亮；
 * - 支持紧凑模式（移动端抽屉）。
 */
function NavLinks({
  pathname,
  currentHash,
  onNavigate,
  compact = false,
}: {
  pathname: string;
  currentHash: string;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <>
      {NAV_ITEMS.map((item) => {
        // 根据 pathname + hash 判定激活态。
        const active = (() => {
          if (item.href.startsWith("/#")) {
            return pathname === "/" && currentHash === item.href.slice(1);
          }
          if (item.href === "/") {
            return pathname === "/" && !currentHash;
          }
          if (item.matchPrefix) {
            return pathname === item.href || pathname.startsWith(`${item.href}/`);
          }
          return pathname === item.href;
        })();
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              compact
                ? "rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                : "flex-1 rounded-full px-4 py-2 text-center text-sm font-medium transition-colors",
              active
                ? "border border-zinc-300 bg-white text-zinc-900 shadow-[0_8px_18px_-14px_rgba(0,0,0,0.45)]"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

/**
 * 品牌链接区（图标 + 标题 + 副标题）。
 */
function BrandLink({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group flex min-w-0 items-center gap-3", className)}>
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-zinc-300/90 bg-zinc-100 text-zinc-700 shadow-[0_12px_24px_-18px_rgba(0,0,0,0.35)]">
        <Sparkles className="size-4" />
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-zinc-900 shadow-[0_0_0_4px_rgba(255,255,255,0.95)]" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-display text-base font-semibold tracking-tight text-slate-900">
          Anvil Explorer
        </span>
        <span className="truncate text-[11px] text-slate-500">
          Local Chain Workbench · 教学版
        </span>
      </span>
    </Link>
  );
}

/**
 * 站点头部：
 * - 品牌区 + 主导航；
 * - 全局搜索；
 * - 自动刷新控制；
 * - 移动端抽屉导航。
 */
export default function Header() {
  const pathname = usePathname();
  const [currentHash, setCurrentHash] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    // 在 hash 变化时同步导航高亮状态。
    const syncHash = () => {
      setCurrentHash(window.location.hash);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => {
      window.removeEventListener("hashchange", syncHash);
    };
  }, [pathname]);

  return (
    <header className="header-surface">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-4 py-3 md:px-6">
        <div className="flex items-center justify-between gap-4 md:hidden">
          <BrandLink />
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-zinc-300/90 bg-zinc-200/70 md:hidden"
                aria-label="打开导航菜单"
              >
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] border-white/70 bg-white/90">
              <SheetHeader>
                <SheetTitle className="font-display">Anvil Explorer</SheetTitle>
              </SheetHeader>
              <nav className="mt-5 flex flex-col gap-2">
                <NavLinks
                  pathname={pathname}
                  currentHash={currentHash}
                  compact
                  onNavigate={() => setSheetOpen(false)}
                />
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        <div className="header-panel hidden w-full items-center gap-3 p-2 md:flex">
          <BrandLink className="max-w-[320px] shrink-0 rounded-xl px-2 py-1 hover:bg-zinc-200/60" />
          <nav className="flex min-w-0 flex-1 items-center gap-2">
            <NavLinks pathname={pathname} currentHash={currentHash} />
          </nav>
        </div>

        <div className="header-panel flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
          <GlobalSearch />
          <RefreshControl />
        </div>
      </div>
    </header>
  );
}
