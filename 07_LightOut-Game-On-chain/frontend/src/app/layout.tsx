import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";

export const metadata: Metadata = {
  title: "关灯游戏 (Lights Out)",
  description: "在最少步数内点亮所有格子。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen font-sans">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
