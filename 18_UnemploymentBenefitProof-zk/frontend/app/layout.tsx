import type { ReactNode } from "react";
import { AppFooter } from "@/components/layout/AppFooter";
import { AppHeader } from "@/components/layout/AppHeader";
import { Providers } from "@/app/providers";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";
import "./globals.css";

/**
 * 根布局负责注入全站 Providers 和运行时配置。
 *
 * 运行时配置会先在服务端读取，再通过内联脚本挂到 `window.__APP_RUNTIME_CONFIG__`，这样客户
 * 端 Hook 可以在不额外请求配置接口的情况下立即拿到正确的合约地址和链信息。
 */
export const metadata = {
  title: "失业一次性补助资格证明平台 | UnemploymentBenefitProof-zk",
  description: "失业补助资格证明平台"
};

/** 根布局组件。 */
export default function RootLayout({ children }: { children: ReactNode }) {
  const runtimeConfig = readRuntimeConfigForScript();

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen">
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__APP_RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};`
          }}
        />
        <Providers>
          <div className="flex min-h-screen flex-col">
            <AppHeader />
            <main className="flex-1">{children}</main>
            <AppFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
