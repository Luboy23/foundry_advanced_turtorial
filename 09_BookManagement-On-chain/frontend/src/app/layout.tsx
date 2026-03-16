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

// 根布局：注入全局样式与 Provider
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
