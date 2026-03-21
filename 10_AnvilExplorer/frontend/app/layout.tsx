import type { Metadata } from "next";
import { Noto_Sans_SC, Space_Grotesk } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "@/app/globals.css";

// 正文字体：用于正文、表格与说明文本。
const bodyFont = Noto_Sans_SC({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// 展示字体：用于标题与强调信息。
const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
});

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
      <body
        className={`${bodyFont.variable} ${displayFont.variable} bg-background text-foreground`}
      >
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
