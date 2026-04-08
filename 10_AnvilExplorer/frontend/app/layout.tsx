import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "@/app/globals.css";

const fontVariables = {
  "--font-body":
    '"Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Helvetica Neue",Arial,sans-serif',
  "--font-display": '"Space Grotesk","Segoe UI","PingFang SC","Noto Sans SC",sans-serif',
} as CSSProperties;

export const metadata: Metadata = {
  title: "Anvil Explorer",
  description: "Anvil 本地区块链浏览器（教学版）",
};

/**
 * 应用根布局：
 * - 注入全局字体变量；
 * - 统一 Header / Footer；
 * - 主内容区保持固定最大宽度。
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-background text-foreground" style={fontVariables}>
        <div className="page-shell flex min-h-screen flex-col">
          <Header />
          <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
