"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { WalletButton } from "@/components/WalletButton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/** 顶部导航菜单项配置。 */
const navItems = [
  { label: copy.nav.events, href: "/events" },
  { label: copy.nav.resolve, href: "/events/resolve" },
  { label: copy.nav.create, href: "/events/create" }
];

/**
 * 导航高亮判定：
 * 处理 `/events`、`/events/create`、`/events/resolve` 以及详情/结算子路由的归属关系。
 */
function isNavItemActive(pathname: string, href: string) {
  if (href === "/events/resolve") {
    return pathname === "/events/resolve" || (pathname.startsWith("/events/") && pathname.endsWith("/resolve"));
  }
  if (href === "/events/create") {
    return pathname === "/events/create";
  }
  if (href === "/events") {
    if (pathname === "/events") {
      return true;
    }
    if (!pathname.startsWith("/events/")) {
      return false;
    }
    if (pathname.startsWith("/events/create")) {
      return false;
    }
    if (pathname.startsWith("/events/resolve")) {
      return false;
    }
    if (pathname.endsWith("/resolve")) {
      return false;
    }
    return true;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 应用顶栏：品牌、主导航、钱包状态与移动端抽屉菜单。 */
export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-black/20 bg-white/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-2">
        <Link
          href="/events"
          className="inline-flex h-11 items-center gap-2.5 rounded-md px-1 text-lg font-bold tracking-[0.16em] uppercase leading-none"
        >
          <Image
            src="/lulu-polymarket-icon.svg"
            alt={copy.brand.title}
            width={34}
            height={34}
            className="rounded-md"
          />
          <span className="whitespace-nowrap">{copy.brand.title}</span>
        </Link>

        <nav className="hidden h-11 items-center gap-2 rounded-xl border border-black/10 bg-neutral-50/70 px-2 md:flex">
          {navItems.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex h-9 items-center rounded-lg px-5 text-[15px] font-semibold transition-colors",
                  active ? "bg-black text-white" : "text-neutral-700 hover:bg-neutral-100"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden h-11 items-center md:flex [&_[data-slot=badge]]:h-9 [&_[data-slot=badge]]:rounded-lg [&_[data-slot=badge]]:px-3 [&_[data-slot=badge]]:text-sm [&_[data-slot=button]]:h-9 [&_[data-slot=button]]:rounded-lg [&_[data-slot=button]]:px-4 [&_[data-slot=button]]:text-sm">
          <WalletButton />
        </div>

        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" aria-label={copy.nav.openMenu} className="size-10 rounded-lg">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] border-black/20">
              <SheetHeader>
                <SheetTitle>{copy.brand.menuTitle}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4">
                {navItems.map((item) => {
                  const active = isNavItemActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "block rounded-md border px-3 py-2 text-sm",
                        active
                          ? "border-black bg-black text-white"
                          : "border-black/20 text-neutral-700 hover:bg-neutral-50"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <WalletButton />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
