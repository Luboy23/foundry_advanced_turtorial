import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

// 站点元信息（SEO/浏览器标签）
export const metadata: Metadata = {
  title: "BookManagement On-chain · 图书借阅管理平台",
  description: "面向馆员与读者的链上图书借阅管理平台，覆盖馆藏、库存、借阅台账与读者管理。",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

function getRuntimeConfigScript() {
  const runtimeConfigPath = path.join(process.cwd(), "public", "contract-config.json");
  const fallback = {
    bookManagementAddress:
      process.env.NEXT_PUBLIC_BOOK_MANAGEMENT_ADDRESS ??
      process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
      "0x0000000000000000000000000000000000000000",
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545",
    chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337"),
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

// 根布局：注入全局样式与 Provider
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <script dangerouslySetInnerHTML={{ __html: getRuntimeConfigScript() }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
