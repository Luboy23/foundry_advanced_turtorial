"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { sharedCopy } from "@/lib/copy";
import { StateCard } from "@/components/shared/StateCard";
import type { RoleAccessState } from "@/lib/role-access";
import type { WalletStatus } from "@/hooks/useWalletStatus";

/** 角色工作台阻塞卡片的入参。 */
type RoleAccessStateCardProps = {
  access: RoleAccessState;
  wallet: WalletStatus;
  onConnect: () => void | Promise<void>;
  onSwitch: () => void | Promise<void>;
};

/**
 * 根据角色访问状态渲染统一的阻塞卡片。
 *
 * 不同阻塞原因会给出不同操作按钮，例如未连接钱包时提供连接按钮，错链时提供切链按钮。
 */
export function RoleAccessStateCard({
  access,
  wallet,
  onConnect,
  onSwitch
}: RoleAccessStateCardProps) {
  if (access.allowed) {
    return null;
  }

  const isDangerTone = access.reason === "missing-role" || access.reason === "role-query-failed";

  // 这里把不同阻塞原因映射成不同 CTA，避免每个工作台页面都重复写一套分支。
  const action =
    access.reason === "wallet-disconnected" ? (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void onConnect()} disabled={wallet.isConnecting} className="btn-primary">
          {wallet.isConnecting ? sharedCopy.connecting : sharedCopy.connectAccount}
        </button>
        <Link href="/" className="btn-outline">
          {sharedCopy.backHome}
        </Link>
      </div>
    ) : access.reason === "wrong-chain" ? (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void onSwitch()} disabled={wallet.isSwitching} className="btn-seal">
          {wallet.isSwitching ? sharedCopy.switching : sharedCopy.switchServiceNetwork}
        </button>
        <Link href="/" className="btn-outline">
          {sharedCopy.backHome}
        </Link>
      </div>
    ) : access.reason === "checking-role" ? (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled className="btn-outline">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在确认权限
          </span>
        </button>
        <Link href="/" className="btn-outline">
          {sharedCopy.backHome}
        </Link>
      </div>
    ) : access.reason === "role-query-failed" ? (
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="btn-outline">
          {sharedCopy.backHome}
        </Link>
      </div>
    ) : (
      <div className="space-y-3">
        {access.recommendedAccount ? (
          <div className="rounded-2xl border border-line-soft bg-bg-paper px-4 py-3 text-sm text-text-muted">
            推荐切换到 {access.recommendedAccountLabel}：
            <span className="ml-2 font-mono text-brand-ink">{access.recommendedAccount}</span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="btn-outline">
            {sharedCopy.backHome}
          </Link>
        </div>
      </div>
    );

  return (
    <StateCard
      title={access.reasonTitle}
      description={access.reasonBody}
      tone={isDangerTone ? "danger" : "default"}
      action={action}
    />
  );
}
