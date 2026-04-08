import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import {
  PROJECT_DESCRIPTION,
  PROJECT_NAME_EN,
  PROJECT_NAME_ZH,
} from "@/lib/projectBrand";

// 页面元信息：统一使用项目中英文名，便于 SEO 与标签页识别。
export const metadata: Metadata = {
  title: `${PROJECT_NAME_ZH} | ${PROJECT_NAME_EN}`,
  description: PROJECT_DESCRIPTION,
};

// 根布局：注入全局样式并挂载 providers。
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
