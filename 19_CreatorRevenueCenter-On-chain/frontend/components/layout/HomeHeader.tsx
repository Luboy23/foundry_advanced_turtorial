"use client";

import Link from "next/link";
import { Wallet2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useRoleIdentity } from "@/hooks/useRoleIdentity";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { shortenAddress } from "@/lib/utils";

export function HomeHeader() {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const roleIdentity = useRoleIdentity(wallet.address);

  return (
    <header className="border-b border-line-soft bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-pink text-white shadow-[var(--shadow-soft-pink)]">
            <Wallet2 className="h-5 w-5" />
          </div>
          <div className="text-sm font-black text-text-ink">创作者收益中心</div>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 md:flex">
            <span className="rounded-full border border-line-soft bg-white px-3 py-1 text-xs font-semibold text-text-muted">
              身份：{roleIdentity.label}
            </span>
            <span className="rounded-full border border-line-soft bg-white px-3 py-1 text-xs font-semibold text-text-muted">
              可写：{wallet.isConnected ? (wallet.isWriteReady ? "已就绪" : "待准备") : "未连接"}
            </span>
            <span className="rounded-full border border-line-soft bg-white px-3 py-1 text-xs font-semibold text-text-muted">
              网络：{wallet.wrongChain ? "需切换" : "正常"}
            </span>
          </div>
          {wallet.isConnected ? (
            <>
              <Button variant="outline" size="sm" onClick={() => wallet.disconnectWallet()}>
                {shortenAddress(wallet.address)}
              </Button>
              {wallet.wrongChain ? (
                <Button variant="secondary" size="sm" onClick={() => void wallet.switchToExpectedChain()}>
                  切换网络
                </Button>
              ) : !wallet.isWriteReady ? (
                <Button variant="secondary" size="sm" onClick={() => void wallet.connectWallet(wallet.connectorId ?? undefined)}>
                  准备可写钱包
                </Button>
              ) : null}
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={() => void wallet.connectWallet()}>
              连接钱包
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
