"use client";

import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useRoleIdentity } from "@/hooks/useRoleIdentity";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { shortenAddress } from "@/lib/utils";

export function WorkspaceTopbar() {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const roleIdentity = useRoleIdentity(wallet.address);
  const requiresWritableWallet = roleIdentity.role === "platform" || roleIdentity.role === "creator";

  const walletStatus = !wallet.isConnected
    ? {
        label: "钱包未连接",
        tone: "neutral" as const
      }
    : wallet.wrongChain
      ? {
          label: `需切换网络 · ${config.chainId}`,
          tone: "warning" as const
        }
      : requiresWritableWallet && !wallet.isWriteReady
        ? {
            label: "待授权可写钱包",
            tone: "warning" as const
          }
        : {
            label: requiresWritableWallet ? "操作已就绪" : "查看已就绪",
            tone: "success" as const
          };

  return (
    <div className="sticky top-0 z-20 border-b border-line-soft bg-white/85 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={`当前月份 ${config.activeBatchLabel}`} tone="info" />
          <StatusBadge label={`当前身份 ${roleIdentity.label}`} tone={roleIdentity.isRecognized ? "success" : "neutral"} />
          <StatusBadge label={walletStatus.label} tone={walletStatus.tone} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {wallet.isConnected ? (
            <>
              <Button variant="outline" size="sm" onClick={() => wallet.disconnectWallet()}>
                {shortenAddress(wallet.address)}
              </Button>
              {wallet.wrongChain ? (
                <Button variant="secondary" size="sm" onClick={() => void wallet.switchToExpectedChain()}>
                  切换网络
                </Button>
              ) : requiresWritableWallet && !wallet.isWriteReady ? (
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
    </div>
  );
}
