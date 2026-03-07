import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "2048 On-chain Demo",
  description: "2048 本地玩法 + 上链提交分数 + 链上排行榜",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
      </body>
    </html>
  );
}
