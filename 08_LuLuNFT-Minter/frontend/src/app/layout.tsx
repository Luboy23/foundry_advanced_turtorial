import type { Metadata } from "next";

import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";

export const metadata: Metadata = {
  title: "LuLuNFT藏品工坊",
  description: "本地 ERC721 铸造与展示平台"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen font-sans">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
