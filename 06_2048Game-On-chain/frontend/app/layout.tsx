import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import "./globals.css";

export const metadata: Metadata = {
  title: "2048 On-chain Demo",
  description: "2048 本地玩法 + 上链提交分数 + 链上排行榜",
  icons: {
    icon: "/favicon.ico",
  },
};

function getRuntimeConfigScript() {
  const runtimeConfigPath = path.join(process.cwd(), "public", "contract-config.json");
  const fallback = {
    scoreContractAddress:
      process.env.NEXT_PUBLIC_SCORE_CONTRACT_ADDRESS ??
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
      <body>
        <script dangerouslySetInnerHTML={{ __html: getRuntimeConfigScript() }} />
        {children}
      </body>
    </html>
  );
}
