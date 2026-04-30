"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, FileClock, FileText, HandCoins, House, LayoutDashboard, ShieldCheck } from "lucide-react";
import { useRoleIdentity } from "@/hooks/useRoleIdentity";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { cn } from "@/lib/utils";

const homeNavigation = [{ href: "/", label: "首页", icon: House }];

const navigationByRole = {
  guest: [],
  platform: [
    { href: "/platform", label: "平台", icon: ShieldCheck },
    { href: "/platform/results", label: "最近结果", icon: FileClock },
    { href: "/platform/history", label: "历史记录", icon: FileText }
  ],
  creator: [
    { href: "/creator", label: "创作者", icon: LayoutDashboard },
    { href: "/creator/history", label: "历史记录", icon: FileClock },
    { href: "/ledger", label: "流水", icon: FileText }
  ],
  collaborator: [{ href: "/collaborator", label: "协作者", icon: Coins }]
};

function isNavigationMatch(pathname: string, href: string) {
  if (href === "/") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceSidebar() {
  const pathname = usePathname();
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const roleIdentity = useRoleIdentity(wallet.address);
  const navigation = [...homeNavigation, ...navigationByRole[roleIdentity.role]];
  const activeHref = navigation.reduce<string | null>((currentMatch, item) => {
    if (!isNavigationMatch(pathname, item.href)) {
      return currentMatch;
    }

    if (!currentMatch || item.href.length > currentMatch.length) {
      return item.href;
    }

    return currentMatch;
  }, null);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-line-soft bg-white/85 backdrop-blur lg:flex">
      <div className="sticky top-0 flex min-h-screen flex-1 flex-col px-4 py-5">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-pink text-white shadow-[var(--shadow-soft-pink)]">
            <HandCoins className="h-5 w-5" />
          </div>
          <div className="text-sm font-black text-text-ink">收益中心</div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {navigation.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  active ? "bg-bg-soft-pink text-brand-pink" : "text-text-muted hover:bg-bg-soft-pink hover:text-brand-pink"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
