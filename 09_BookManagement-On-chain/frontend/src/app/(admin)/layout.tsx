"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatErrorMessage } from "@/lib/errors";
import { registryAddress, TARGET_CHAIN_ID } from "@/lib/registry";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { useAdminAccess } from "@/hooks/use-admin-access";

// 管理端布局：校验 owner/operator 权限
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isHydrated, isConnected, chainId, isAllowed, queryError, isLoading } = useAdminAccess();
  const permissionErrorMessage = queryError
    ? formatErrorMessage(queryError)
    : "网络或权限校验失败，请检查钱包网络后重试。";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="container mx-auto w-full flex-1 px-6 py-8">
        {/* 未配置合约地址：直接阻断管理端并提示部署流程 */}
        {!registryAddress && (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            <p>系统未完成部署，请联系管理员完成配置。</p>
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <Link href="/">返回首页</Link>
              </Button>
            </div>
          </div>
        )}
        {/* SSR -> CSR 过渡期：等待客户端钱包状态可用 */}
        {registryAddress && !isHydrated && (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            正在初始化客户端钱包状态…
          </div>
        )}
        {/* 钱包未连接：引导连接后再做权限校验 */}
        {registryAddress && isHydrated && !isConnected && (
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">管理端访问验证</h2>
            <p className="mt-2 text-sm text-muted-foreground">请使用右上角钱包按钮连接管理员钱包后继续。</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/">返回首页</Link>
              </Button>
            </div>
          </div>
        )}
        {/* 网络不匹配：避免错误网络下发起写链 */}
        {registryAddress && isHydrated && isConnected && chainId !== TARGET_CHAIN_ID && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-50 p-6">
            <h2 className="text-lg font-semibold text-foreground">网络不匹配</h2>
            <p className="mt-2 text-sm text-amber-700">
              当前网络不是目标网络（{TARGET_CHAIN_ID}），请先切换网络后再进入管理端。
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/">返回首页</Link>
              </Button>
            </div>
          </div>
        )}
        {/* 权限查询进行中：展示 loading 态，避免闪烁 */}
        {registryAddress && isHydrated && isConnected && chainId === TARGET_CHAIN_ID && isLoading && (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            正在校验管理员权限…
          </div>
        )}
        {/* 权限查询报错：允许用户手动重试刷新 */}
        {registryAddress &&
          isHydrated &&
          isConnected &&
          chainId === TARGET_CHAIN_ID &&
          !isLoading &&
          queryError && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-50 p-6">
            <h2 className="text-lg font-semibold text-foreground">权限校验失败</h2>
            <p className="mt-2 text-sm text-amber-700">{permissionErrorMessage}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
                重新校验
              </Button>
              <Button asChild variant="outline" size="sm">
              <Link href="/">返回首页</Link>
              </Button>
            </div>
          </div>
        )}
        {/* 校验通过但非管理员：允许只读访问入口，不渲染后台主体 */}
        {registryAddress &&
          isHydrated &&
          isConnected &&
          chainId === TARGET_CHAIN_ID &&
          !isLoading &&
          !queryError &&
          !isAllowed && (
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">无权限访问</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              当前钱包不是管理员，请通过右上角钱包按钮切换到管理员钱包。
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/">返回首页</Link>
              </Button>
            </div>
          </div>
        )}
        {/* 所有门禁通过后，渲染管理端业务内容 */}
        {registryAddress &&
          isHydrated &&
          isConnected &&
          chainId === TARGET_CHAIN_ID &&
          !isLoading &&
          !queryError &&
          isAllowed &&
          children}
      </main>
      <SiteFooter />
    </div>
  );
}
