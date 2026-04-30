"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StatePanels";
import { buildWorkspaceAccessState, getRoleLabel, type ExpectedWorkspaceRole } from "@/lib/roles";
import { useRoleIdentity } from "@/hooks/useRoleIdentity";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";

export function RoleGate({
  expectedRole,
  children
}: {
  expectedRole: ExpectedWorkspaceRole;
  children: ReactNode;
}) {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const identity = useRoleIdentity(wallet.address);
  const access = buildWorkspaceAccessState({
    isHydrated: wallet.isHydrated,
    isConnected: wallet.isConnected,
    role: identity.role,
    roleLabel: identity.label,
    expectedRole,
    isRecognized: identity.isRecognized
  });

  if (!wallet.isHydrated) {
    return <LoadingState title="正在读取钱包状态" description="请稍候。" />;
  }

  if (!wallet.isConnected) {
    return (
      <EmptyState
        title={`请先连接${getRoleLabel(expectedRole)}钱包`}
        description="连接后继续。"
        variant="compact"
        action={
          <Button size="lg" onClick={() => void wallet.connectWallet()}>
            连接钱包
          </Button>
        }
      />
    );
  }

  if (!access.allowed) {
    return (
      <ErrorState
        title={`当前钱包不能进入${getRoleLabel(expectedRole)}工作台`}
        description={access.reason ?? "身份不匹配。"}
        action={
          <Link href="/" className="rounded-full bg-brand-pink px-5 py-3 text-sm font-semibold text-white">
            返回首页
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
}
