"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Wallet, X } from "lucide-react";
import { Logo } from "@/components/branding/Logo";
import { useDialog } from "@/components/shared/DialogProvider";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useWalletActionFeedback } from "@/hooks/useWalletActionFeedback";
import { sharedCopy } from "@/lib/copy";
import { roleDefinitions, type RoleKey } from "@/lib/role-access";
import { cn, formatAddress } from "@/lib/utils";

/**
 * 全站顶部导航。
 *
 * 它既负责品牌展示，也负责把“哪些工作台当前可进入”直接映射到导航项里，并在用户点击不可
 * 进入的角色入口时给出统一的阻塞原因说明。
 */
const navigationItems: Array<
  | {
      type: "link";
      name: string;
      href: string;
    }
  | {
      type: "role";
      role: RoleKey;
    }
> = [
  { type: "link", name: "首页", href: "/" },
  { type: "role", role: "government" },
  { type: "role", role: "applicant" },
  { type: "role", role: "agency" }
];

/** 顶部导航组件。 */
export function AppHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { wallet, accessByRole } = useRoleAccess();
  const { walletError, setWalletError, ensureWalletReady } = useWalletActionFeedback(wallet);
  const dialog = useDialog();

  /** 连接钱包、切链或断开钱包的统一入口。 */
  async function handleWalletAction() {
    setWalletError(null);

    if (!wallet.isConnected || wallet.wrongChain) {
      await ensureWalletReady();
      return;
    }

    wallet.disconnectWallet();
  }

  /** 点击无权限工作台时，弹出对应的阻塞原因，而不是静默无响应。 */
  async function handleBlockedRoleClick(role: RoleKey) {
    const access = accessByRole[role];
    if (access.allowed) {
      return;
    }

    await dialog.showInfo({
      title: access.reasonTitle,
      description: access.reasonBody,
      tone: access.reason === "missing-role" ? "warning" : access.reason === "role-query-failed" ? "error" : "info"
    });
    setOpen(false);
  }

  const walletLabel = !wallet.isConnected
    ? wallet.isConnecting
      ? sharedCopy.connecting
      : sharedCopy.connectAccount
    : wallet.wrongChain
      ? wallet.isSwitching
        ? sharedCopy.switching
        : sharedCopy.switchServiceNetwork
      : formatAddress(wallet.address);

  return (
    <header className="sticky top-0 z-50 border-b border-line-soft bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          <div>
            <p className="text-base font-semibold tracking-tight text-brand-ink">UnemploymentBenefitProof-zk</p>
            <p className="text-[11px] text-text-muted">{sharedCopy.platformSubtitle}</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-3 md:flex">
          {navigationItems.map((item) => {
            if (item.type === "link") {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    active ? "bg-brand-ink text-surface" : "text-text-muted hover:bg-bg-paper hover:text-brand-ink"
                  )}
                >
                  {item.name}
                </Link>
              );
            }

            const definition = roleDefinitions[item.role];
            const access = accessByRole[item.role];
            const active = pathname === definition.path || pathname.startsWith(`${definition.path}/`);

            return access.allowed ? (
              <Link
                key={definition.path}
                href={definition.path}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  active ? "bg-brand-ink text-surface" : "text-text-muted hover:bg-bg-paper hover:text-brand-ink"
                )}
              >
                {definition.title}
              </Link>
            ) : (
              <button
                key={definition.path}
                type="button"
                aria-disabled="true"
                onClick={() => void handleBlockedRoleClick(item.role)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  active ? "bg-brand-ink/80 text-surface" : "text-text-muted",
                  "cursor-not-allowed opacity-60"
                )}
              >
                {definition.title}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => void handleWalletAction()}
            aria-busy={wallet.isConnecting || wallet.isSwitching}
            className="btn-outline flex items-center gap-2 text-sm"
          >
            <Wallet className="h-4 w-4" />
            {walletLabel}
          </button>
        </nav>

        <button type="button" onClick={() => setOpen((value) => !value)} className="text-brand-ink md:hidden">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-line-soft bg-surface px-4 py-4 md:hidden">
          <div className="space-y-2">
            {navigationItems.map((item) => {
              if (item.type === "link") {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-4 py-3 text-sm font-medium text-text-muted transition hover:bg-bg-paper hover:text-brand-ink"
                  >
                    {item.name}
                  </Link>
                );
              }

              const definition = roleDefinitions[item.role];
              const access = accessByRole[item.role];

              return access.allowed ? (
                <Link
                  key={definition.path}
                  href={definition.path}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-4 py-3 text-sm font-medium text-text-muted transition hover:bg-bg-paper hover:text-brand-ink"
                >
                  {definition.title}
                </Link>
              ) : (
                <button
                  key={definition.path}
                  type="button"
                  aria-disabled="true"
                  onClick={() => void handleBlockedRoleClick(item.role)}
                  className="block w-full cursor-not-allowed rounded-xl px-4 py-3 text-left text-sm font-medium text-text-muted opacity-60"
                >
                  {definition.title}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => void handleWalletAction()}
            aria-busy={wallet.isConnecting || wallet.isSwitching}
            className="btn-outline mt-4 flex w-full items-center justify-center gap-2 text-sm"
          >
            <Wallet className="h-4 w-4" />
            {walletLabel}
          </button>
        </div>
      ) : null}

      {walletError ? (
        <div className="pointer-events-none absolute inset-x-0 top-full z-50 px-4 pt-3 sm:px-6 lg:px-8" aria-live="polite">
          <div className="mx-auto max-w-7xl">
            <div className="pointer-events-auto flex items-start justify-between gap-3 rounded-2xl border border-[#F2C7C3] bg-[#FFF2F1]/95 px-4 py-3 text-sm text-brand-seal shadow-[0_18px_40px_-28px_rgba(123,47,34,0.45)] backdrop-blur">
              <p className="min-w-0 flex-1">{walletError}</p>
              <button
                type="button"
                onClick={() => setWalletError(null)}
                className="shrink-0 rounded-full p-1 text-brand-seal/80 transition hover:bg-brand-seal/10 hover:text-brand-seal"
                aria-label="关闭账户提示"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
