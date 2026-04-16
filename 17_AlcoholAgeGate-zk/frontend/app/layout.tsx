import Script from "next/script";
import type { Metadata } from "next";
import { AppFooter } from "@/components/layout/AppFooter";
import { AppHeader } from "@/components/layout/AppHeader";
import { Providers } from "@/app/providers";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";
import "./globals.css";

export const metadata: Metadata = {
  title: "隐私年龄验证酒水交易平台 | AlcoholAgeGate-zk",
  description: "先完成法定饮酒年龄验证，再进入酒水购买流程。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const runtimeConfig = readRuntimeConfigForScript();

  return (
    <html lang="zh-CN">
      <body>
        <Script id="app-runtime-config" strategy="beforeInteractive">
          {`window.__APP_RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};`}
        </Script>
        <Providers>
          <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(191,132,48,0.12),_transparent_30%),_linear-gradient(180deg,_#fffdf8_0%,_#f5eedc_100%)]">
            <AppHeader />
            <main className="mx-auto flex w-full max-w-7xl flex-1 px-4 py-8 md:px-6 lg:px-8">{children}</main>
            <AppFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
