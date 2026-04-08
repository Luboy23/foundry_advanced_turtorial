import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";

export const metadata: Metadata = {
  title: "关灯游戏 (Lights Out)",
  description: "在最少步数内点亮所有格子。",
};

function getRuntimeConfigScript() {
  const runtimeConfigPath = path.join(process.cwd(), "public", "contract-config.json");
  const fallback = {
    lightsOutAddress:
      process.env.NEXT_PUBLIC_LIGHTS_OUT_ADDRESS ??
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen font-sans">
        <script dangerouslySetInnerHTML={{ __html: getRuntimeConfigScript() }} />
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
