"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Wallet, X } from "lucide-react";
import { Logo } from "@/components/branding/Logo";
import { useRoleStatusQuery } from "@/hooks/useAppQueries";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { getBuyerRoleAccessState, getDemoRoleAccessState, type DemoRole } from "@/lib/access";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { cn, formatAddress } from "@/lib/utils";

const navItems = [
  { name: "首页", href: "/" },
  { name: "买家中心", href: "/buyer", role: "buyer" as DemoRole },
  { name: "卖家中心", href: "/seller", role: "seller" as DemoRole },
  { name: "年龄验证方", href: "/issuer", role: "issuer" as DemoRole }
];

export function AppHeader() {
  const [open, setOpen] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const buyerRoleQuery = useRoleStatusQuery(wallet.address, {
    enabled: wallet.isConnected && !wallet.wrongChain
  });

  async function handleWalletAction() {
    setWalletError(null);

    try {
      if (!wallet.isConnected) {
        await wallet.connectWallet();
        return;
      }

      if (wallet.wrongChain) {
        await wallet.switchToExpectedChain();
        return;
      }

      wallet.disconnectWallet();
    } catch (error) {
      setWalletError(getFriendlyErrorMessage(error, !wallet.isConnected ? "wallet-connect" : "wallet-switch"));
    }
  }

  const walletLabel = !wallet.isConnected
    ? "连接钱包"
    : wallet.wrongChain
      ? "切换到项目链"
      : formatAddress(wallet.address);

  const accessByRole = {
    buyer: getBuyerRoleAccessState({
      isConnected: wallet.isConnected,
      wrongChain: wallet.wrongChain,
      isLoadingRole: wallet.isConnected && !wallet.wrongChain && buyerRoleQuery.isLoading,
      roleError: buyerRoleQuery.isError,
      hasBuyerRole: Boolean(buyerRoleQuery.data?.isBuyer)
    }),
    seller: getDemoRoleAccessState({ role: "seller", isConnected: wallet.isConnected, wrongChain: wallet.wrongChain, address: wallet.address, config }),
    issuer: getDemoRoleAccessState({ role: "issuer", isConnected: wallet.isConnected, wrongChain: wallet.wrongChain, address: wallet.address, config })
  };

  return (
    <header className="sticky top-0 z-50 border-b border-brand-green/8 bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          <div className="space-y-0.5">
            <p className="text-lg font-semibold tracking-tight text-brand-green">隐私年龄验证酒水交易平台</p>
            <p className="text-sm font-semibold tracking-tight text-text-muted">AlcoholAgeGate-zk</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => {
            const access = item.role ? accessByRole[item.role] : { allowed: true, description: null };

            return access.allowed ? (
              <Link key={item.href} href={item.href} className="text-sm font-medium text-text-muted transition hover:text-brand-amber">
                {item.name}
              </Link>
            ) : (
              <span
                key={item.href}
                title={access.description ?? undefined}
                className="cursor-not-allowed text-sm font-medium text-text-muted/45"
              >
                {item.name}
              </span>
            );
          })}
          <button onClick={handleWalletAction} className="btn-primary flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4" />
            {walletLabel}
          </button>
        </nav>

        <button onClick={() => setOpen((value) => !value)} className="text-brand-green md:hidden">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-brand-green/8 bg-surface px-4 py-4 md:hidden">
          <div className="space-y-2">
            {navItems.map((item) => {
              const access = item.role ? accessByRole[item.role] : { allowed: true, description: null };

              return access.allowed ? (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn("block rounded-2xl px-4 py-3 text-sm font-medium text-text-muted hover:bg-bg-ivory hover:text-brand-green")}
                >
                  {item.name}
                </Link>
              ) : (
                <span
                  key={item.href}
                  title={access.description ?? undefined}
                  className={cn("block cursor-not-allowed rounded-2xl px-4 py-3 text-sm font-medium text-text-muted/45")}
                >
                  {item.name}
                </span>
              );
            })}
          </div>
          <button onClick={handleWalletAction} className="btn-primary mt-4 flex w-full items-center justify-center gap-2 text-sm">
            <Wallet className="h-4 w-4" />
            {walletLabel}
          </button>
        </div>
      ) : null}
      {walletError ? (
        <div className="border-t border-rose-200 bg-rose-50">
          <div className="mx-auto max-w-7xl px-4 py-3 text-sm text-rose-700 md:px-6 lg:px-8">{walletError}</div>
        </div>
      ) : null}
    </header>
  );
}
