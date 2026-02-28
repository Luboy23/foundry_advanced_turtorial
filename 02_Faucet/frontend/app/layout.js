import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
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

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
