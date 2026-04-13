"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { InfoNotice } from "@/components/shared/StatePanels";
import { writeAccessFlash } from "@/lib/auth/access-flash";
import { useRoleIdentity } from "@/hooks/useRoleIdentity";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import type { AppRole, RoleIdentity } from "@/types/auth";

// 角色页统一入口守卫。
// 这里把“未连接钱包 / 身份不匹配 / 配置未完成”统一收口，避免每个工作台页面重复写一套跳转逻辑。
export function RoleGate({
  expectedRole,
  children
}: {
  expectedRole: AppRole;
  children: (identity: RoleIdentity) => ReactNode;
}) {
  const router = useRouter();
  const { config, isConfigured } = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const roleState = useRoleIdentity({
    config,
    walletAddress: wallet.address,
    enabled: wallet.isConnected && isConfigured
  });

  useEffect(() => {
    // hydration 未完成前先不做重定向，避免白名单账户在客户端恢复前被误踢回首页。
    if (!wallet.isHydrated || !isConfigured) {
      return;
    }
    if (!wallet.isConnected) {
      writeAccessFlash("请先连接项目授权账户，再进入对应工作台。");
      router.replace("/");
      return;
    }
    if (roleState.isLoading) {
      return;
    }
    if (roleState.identity.role !== expectedRole) {
      writeAccessFlash("当前账户不对应这个身份，已返回首页。");
      router.replace("/");
    }
  }, [expectedRole, isConfigured, roleState.identity.role, roleState.isLoading, router, wallet.isConnected, wallet.isHydrated]);

  if (!wallet.isHydrated) {
    return <InfoNotice title="正在读取钱包状态" description="请稍候，系统正在校验当前浏览器钱包连接。" />;
  }

  if (!isConfigured) {
    return <InfoNotice title="系统配置未完成" description="当前暂时无法进入工作台，请稍后再试。" tone="warning" />;
  }

  if (!wallet.isConnected) {
    return <InfoNotice title="正在返回首页" description="只有项目授权账户可以进入该工作台。" tone="warning" />;
  }

  if (roleState.isLoading) {
    return <InfoNotice title="正在核验账户身份" description="系统正在确认当前账户对应的身份，请稍候。" />;
  }

  if (roleState.identity.role !== expectedRole) {
    return <InfoNotice title="当前账户不能进入这个工作台" description="系统已识别到当前账户不对应这个身份，正在返回首页。" tone="warning" />;
  }

  return <>{children(roleState.identity)}</>;
}
