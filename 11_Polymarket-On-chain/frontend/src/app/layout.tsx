import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Providers } from "@/app/providers";
import { copy } from "@/lib/copy";
import "@/app/globals.css";

/** 应用级 metadata：统一品牌标题、描述与站点图标。 */
export const metadata: Metadata = {
  title: copy.brand.title,
  description: copy.brand.description,
  icons: {
    icon: "/lulu-polymarket-icon.svg",
    shortcut: "/lulu-polymarket-icon.svg"
  }
};

function getRuntimeConfigScript() {
  const runtimeConfigPath = path.join(process.cwd(), "public", "contract-config.json");
  const fallback = {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545",
    chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337"),
    projectGithub:
      process.env.NEXT_PUBLIC_PROJECT_GITHUB ??
      "https://github.com/lllu23/foundry_advanced_turtorial",
    eventFactoryAddress:
      process.env.NEXT_PUBLIC_EVENT_FACTORY_ADDRESS ??
      "0x0000000000000000000000000000000000000000",
    positionTokenAddress:
      process.env.NEXT_PUBLIC_POSITION_TOKEN_ADDRESS ??
      "0x0000000000000000000000000000000000000000",
    ethCollateralVaultAddress:
      process.env.NEXT_PUBLIC_ETH_COLLATERAL_VAULT_ADDRESS ??
      "0x0000000000000000000000000000000000000000",
    oracleAdapterAddress:
      process.env.NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS ??
      "0x0000000000000000000000000000000000000000",
  };

  let runtimeConfig = fallback;
  try {
    if (fs.existsSync(runtimeConfigPath)) {
      runtimeConfig = {
        ...fallback,
        ...JSON.parse(fs.readFileSync(runtimeConfigPath, "utf8")),
      };
    }
  } catch (error) {
    console.warn("Failed to read contract-config.json:", error);
  }

  return `window.__APP_RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};`;
}

/** 根布局：挂载全局 Provider，并固定头部导航与底部栏。 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <script dangerouslySetInnerHTML={{ __html: getRuntimeConfigScript() }} />
        <Providers>
          <div className="min-h-screen">
            <Navbar />
            <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-8">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
