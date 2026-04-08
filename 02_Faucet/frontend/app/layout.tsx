import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Faucet Turtorial",
  description: "ERC20 Faucet tutorial",
  icons: {
    icon: [
      {
        url: "/favicon.ico?v=2",
        type: "image/x-icon",
        sizes: "64x64",
      },
    ],
    shortcut: ["/favicon.ico?v=2"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
