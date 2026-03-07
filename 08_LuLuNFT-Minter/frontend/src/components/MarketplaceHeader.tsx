"use client";

import NextImage from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";

import { Button } from "@/components/ui/button";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

const ANVIL_CHAIN_ID = 31337;

const IconMenu = ({
  className
}: {
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
  </svg>
);

const IconClose = ({
  className
}: {
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <path d="M6 6l12 12" />
    <path d="M18 6l-12 12" />
  </svg>
);

const IconHome = ({
  className
}: {
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 10.5l9-7 9 7" />
    <path d="M5 9.5V20h14V9.5" />
    <path d="M9 20v-6h6v6" />
  </svg>
);

const IconGrid = ({
  className
}: {
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const IconCollection = ({
  className
}: {
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 4h12a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z" />
    <path d="M9 8h6" />
    <path d="M9 12h6" />
    <path d="M9 16h4" />
  </svg>
);

const IconMarket = ({
  className
}: {
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 9h16" />
    <path d="M5 9l1-4h12l1 4" />
    <path d="M6 9v10h12V9" />
    <path d="M10 13h4" />
  </svg>
);

const WalletBadge = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();

  const handleConnect = () => {
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  return (
    <div className="u-text-meta flex flex-wrap items-center u-gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 shadow-sm">
      <span className="text-slate-500">
        {isConnected ? shortAddress(address) : "未连接"}
      </span>
      <span className="hidden h-1 w-1 rounded-full bg-slate-200 sm:inline-block" />
      <span className="u-text-mini uppercase tracking-[0.2em] text-slate-500">
        {chainId === ANVIL_CHAIN_ID ? "31337" : "网络不匹配"}
      </span>
      {isConnected ? (
        <button
          type="button"
          onClick={() => disconnect()}
          className="u-text-mini rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          断开连接
        </button>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          className="u-text-mini rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-rose-600 transition hover:bg-slate-50"
        >
          {isPending ? "连接中" : "连接"}
        </button>
      )}
    </div>
  );
};

export const MarketplaceHeader = ({
  active
}: {
  active: "mint" | "gallery" | "collection" | "market";
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = [
    { label: "铸造台", href: "/", key: "mint", icon: IconHome },
    { label: "作品展示", href: "/explore", key: "gallery", icon: IconGrid },
    { label: "我的藏品", href: "/collection", key: "collection", icon: IconCollection },
    { label: "NFT市场", href: "/market", key: "market", icon: IconMarket }
  ] as const;

  const renderNavMenuItems = ({
    className,
    onSelect
  }: {
    className?: string;
    onSelect?: () => void;
  }) => (
    <div className={cn("flex flex-col md:flex-row u-gap-2", className)}>
      {menuItems.map((item) => (
        <Link key={item.key} href={item.href} onClick={onSelect}>
          <Button
            variant="ghost"
            className={cn(
              "u-text-body w-full justify-start md:w-auto md:justify-center",
              active === item.key
                ? "bg-rose-50 text-rose-600"
                : "text-slate-600"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Button>
        </Link>
      ))}
    </div>
  );

  return (
    <nav className="sticky top-0 z-50 bg-white py-3.5 md:py-4 isolate">
      <div className="container relative px-6 flex flex-col md:flex-row md:items-center justify-between u-gap-4 md:gap-6 m-auto">
        <div className="flex justify-between">
          <Link href="/" className="items-center flex u-gap-3">
            <NextImage
              src="/brand-deer.svg"
              alt="LuLuNFT藏品工坊 鹿标"
              className="h-12 w-12"
              width={48}
              height={48}
            />
            <h2 className="whitespace-nowrap text-2xl font-bold text-slate-900">
              LuLuNFT藏品工坊
            </h2>
          </Link>
          <Button
            variant="ghost"
            className="size-9 flex items-center justify-center md:hidden"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label={isMenuOpen ? "关闭菜单" : "打开菜单"}
          >
            {isMenuOpen ? (
              <IconClose className="h-5 w-5" />
            ) : (
              <IconMenu className="h-5 w-5" />
            )}
          </Button>
        </div>

        <div className="hidden md:flex flex-row u-gap-5 w-full justify-end items-center">
          {renderNavMenuItems({})}
          <WalletBadge />
        </div>

        {isMenuOpen ? (
          <div className="md:hidden flex flex-col u-gap-4 w-full justify-end pb-2.5">
            {renderNavMenuItems({ onSelect: () => setIsMenuOpen(false) })}
            <div className="flex justify-start">
              <WalletBadge />
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
};
