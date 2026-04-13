"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, School, ShieldCheck, ShieldEllipsis } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { useRoleIdentity } from "@/hooks/useRoleIdentity";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { cn } from "@/lib/utils";
import { formatAddress } from "@/lib/utils";

const navItems = [
  { href: "/", label: "首页", icon: ShieldCheck },
  { href: "/authority", label: "考试院", icon: ShieldEllipsis },
  { href: "/student", label: "学生", icon: GraduationCap },
  { href: "/university", label: "大学", icon: School }
];

export function AppHeader() {
  const pathname = usePathname();
  const { config, isConfigured } = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const roleState = useRoleIdentity({
    config,
    walletAddress: wallet.address,
    enabled: wallet.isConnected && isConfigured
  });

  const roleLabel =
    roleState.identity.role === "authority"
      ? "考试院"
        : roleState.identity.role === "student"
        ? "学生"
        : roleState.identity.role === "university"
          ? "大学"
          : "未识别身份";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-200">
            <School className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide text-slate-900">高考录取资格证明系统</div>
            <div className="text-xs text-slate-500">UniversityCutoffProof-zk</div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
            {navItems.map((item) => {
              const disabled =
                item.href !== "/" &&
                (!wallet.isConnected ||
                  roleState.identity.role === "none" ||
                  (item.href === "/authority" && roleState.identity.role !== "authority") ||
                  (item.href === "/student" && roleState.identity.role !== "student") ||
                  (item.href === "/university" && roleState.identity.role !== "university"));
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={disabled ? "#" : item.href}
                aria-disabled={disabled}
                onClick={(event) => {
                  if (disabled) {
                    event.preventDefault();
                  }
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
            })}
          </nav>

          <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600 lg:block">
            {!wallet.isHydrated ? "正在读取账户" : wallet.address ? `${formatAddress(wallet.address, 5)} · ${roleLabel}` : "未连接钱包"}
          </div>

          {!wallet.isHydrated ? (
            <Button disabled size="sm">
              检查中...
            </Button>
          ) : !wallet.isConnected ? (
            <Button onClick={() => void wallet.connectWallet()} disabled={wallet.isConnecting} size="sm">
              {wallet.isConnecting ? "连接中..." : "连接钱包"}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={wallet.disconnectWallet}>
              断开连接
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
