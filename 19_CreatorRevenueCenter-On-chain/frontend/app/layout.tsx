import Script from "next/script";
import type { Metadata } from "next";
import { AppFooter } from "@/components/layout/AppFooter";
import { Providers } from "@/app/providers";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";
import "./globals.css";

export const metadata: Metadata = {
  title: "创作者收益结算中心 | CreatorRevenueCenter-On-chain",
  description: "创作者月度账单、链上领取与自动分账。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const runtimeConfig = readRuntimeConfigForScript();

  return (
    <html lang="zh-CN">
      <body>
        <Script id="app-runtime-config" strategy="beforeInteractive">
          {`window.__APP_RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};`}
        </Script>
        <Providers initialRuntimeConfig={runtimeConfig}>
          <div className="flex min-h-screen flex-col">
            <main className="flex flex-1 flex-col">{children}</main>
            <AppFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
