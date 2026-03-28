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

/** 根布局：挂载全局 Provider，并固定头部导航与底部栏。 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
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
