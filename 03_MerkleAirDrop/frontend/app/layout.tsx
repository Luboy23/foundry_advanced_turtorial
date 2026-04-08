import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Merkle AirDrop Tutorial",
  description: "MerkleTree AirDrop tutorial",
  icons: {
    icon: [
      {
        url: "/favicon.ico",
        type: "image/x-icon",
        sizes: "64x64",
      },
    ],
    shortcut: ["/favicon.ico"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
