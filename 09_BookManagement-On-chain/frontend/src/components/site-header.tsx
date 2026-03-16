import Link from "next/link";
import { Button } from "@/components/ui/button";
import WalletButton from "@/components/wallet-button";
import BrandIcon from "@/components/brand-icon";

// 公共站点头部：Logo + 导航入口
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container mx-auto flex w-full flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary shadow-sm">
            <BrandIcon />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              BookManagement On-chain
            </p>
            <p className="text-lg font-semibold text-foreground">图书借阅管理平台</p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/reader">读者中心</Link>
          </Button>
          <Button asChild>
            <Link href="/admin">管理控制台</Link>
          </Button>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
