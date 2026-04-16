"use client";

import Link from "next/link";
import { ArrowRight, Lock, ShieldCheck, ShoppingBag, Store, UserCheck } from "lucide-react";
import { ProductCard } from "@/components/product/ProductCard";
import { StatePanel } from "@/components/shared/StatePanel";
import { useMarketplaceProductsQuery, useRoleStatusQuery } from "@/hooks/useAppQueries";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { getBuyerRoleAccessState, getDemoRoleAccessState, type DemoRole } from "@/lib/access";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const productsQuery = useMarketplaceProductsQuery({
    enabled: true
  });
  const products = productsQuery.data;
  const buyerRoleQuery = useRoleStatusQuery(wallet.address, {
    enabled: wallet.isConnected && !wallet.wrongChain
  });
  const buyerAccess = getBuyerRoleAccessState({
    isConnected: wallet.isConnected,
    wrongChain: wallet.wrongChain,
    isLoadingRole: wallet.isConnected && !wallet.wrongChain && buyerRoleQuery.isLoading,
    roleError: buyerRoleQuery.isError,
    hasBuyerRole: Boolean(buyerRoleQuery.data?.isBuyer)
  });
  const sellerAccess = getDemoRoleAccessState({ role: "seller", isConnected: wallet.isConnected, wrongChain: wallet.wrongChain, address: wallet.address, config });
  const issuerAccess = getDemoRoleAccessState({ role: "issuer", isConnected: wallet.isConnected, wrongChain: wallet.wrongChain, address: wallet.address, config });
  const roleEntries: Array<{
    role: DemoRole;
    href: string;
    title: string;
    description: string;
  }> = [
    { role: "buyer", href: "/buyer", title: "我是买家", description: "查看购买资格、浏览商品并完成下单。" },
    { role: "seller", href: "/seller", title: "我是卖家", description: "管理商品状态、库存、价格与待结算货款。" },
    { role: "issuer", href: "/issuer", title: "我是年龄验证方", description: "维护资格集合版本与当前有效状态。" }
  ];
  const accessByRole = {
    buyer: buyerAccess,
    seller: sellerAccess,
    issuer: issuerAccess
  };

  return (
    <div className="space-y-16">
      <section className="grid gap-10 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-amber/10 px-4 py-2 text-sm font-medium text-brand-amber">
            <ShieldCheck className="h-4 w-4" />
            法定年龄验证
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-semibold leading-tight text-brand-green md:text-6xl">
              隐私年龄验证
              <br />
              <span className="text-brand-amber">酒水交易平台</span>
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-text-muted">
              买家无需公开完整身份信息和具体生日，只证明自己满足法定饮酒年龄。验证通过后，才可以进入酒水购买流程。
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            {buyerAccess.allowed ? (
              <Link href="/buyer" className="btn-primary gap-2">
                进入买家中心
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button type="button" disabled title={buyerAccess.description ?? undefined} className="btn-primary gap-2 opacity-50 cursor-not-allowed">
                进入买家中心
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {issuerAccess.allowed ? (
              <Link href="/issuer" className="btn-outline">
                年龄验证方入口
              </Link>
            ) : (
              <button type="button" disabled title={issuerAccess.description ?? undefined} className="btn-outline opacity-45 cursor-not-allowed">
                年龄验证方入口
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              icon: Lock,
              title: "隐私保护",
              description: "不暴露生日明文和身份细节"
            },
            {
              icon: UserCheck,
              title: "合规准入",
              description: "只有年龄资格有效时才能购买"
            },
            {
              icon: ShoppingBag,
              title: "有限陈列",
              description: "首页只展示精选酒水预览"
            },
            {
              icon: Store,
              title: "托管结算",
              description: "下单后货款进入待结算余额"
            }
          ].map((item, index) => (
            <article
              key={item.title}
              className={`glass-card p-6 ${index % 2 === 1 ? "md:translate-y-8" : ""}`}
            >
              <item.icon className="h-8 w-8 text-brand-amber" />
              <h2 className="mt-6 text-lg font-semibold text-brand-green">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <StatePanel
        title="角色入口按账户权限开放"
        description="只有具备对应身份的账户才能进入对应工作台。买家、卖家、年龄验证方入口会根据当前连接账户自动启用或禁用。"
      />

      <section className="grid gap-6 md:grid-cols-3">
        {roleEntries.map((entry) => {
          const access = accessByRole[entry.role];
          const cardClassName = cn(
            "glass-card p-8 transition",
            access.allowed ? "hover:border-brand-amber/30" : "cursor-not-allowed opacity-65"
          );

          return access.allowed ? (
            <Link key={entry.role} href={entry.href} className={cardClassName}>
              <h3 className="text-xl font-semibold text-brand-green">{entry.title}</h3>
              <p className="mt-3 text-sm leading-6 text-text-muted">{entry.description}</p>
            </Link>
          ) : (
            <div key={entry.role} className={cardClassName} title={access.description ?? undefined} aria-disabled="true">
              <h3 className="text-xl font-semibold text-brand-green">{entry.title}</h3>
              <p className="mt-3 text-sm leading-6 text-text-muted">{entry.description}</p>
              <p className="mt-4 text-xs leading-5 text-brand-amber">{access.description}</p>
            </div>
          );
        })}
      </section>

      <section className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-brand-green">精选陈列</h2>
            <p className="mt-2 text-sm text-text-muted">正式购买前，系统会检查当前账户的购买资格是否仍然有效。</p>
          </div>
          {buyerAccess.allowed ? (
            <Link href="/buyer" className="text-sm font-semibold text-brand-amber">
              查看买家视角
            </Link>
          ) : (
            <span className="cursor-not-allowed text-sm font-semibold text-brand-amber/50" title={buyerAccess.description ?? undefined}>
              查看买家视角
            </span>
          )}
        </div>

        {productsQuery.isLoading ? (
          <StatePanel title="正在加载商品预览" description="正在整理当前商品信息，请稍候。" />
        ) : productsQuery.isError ? (
          <StatePanel title="无法读取商品预览" description="当前暂时无法读取商品数据，请稍后刷新重试。" tone="danger" />
        ) : (
          <div className="grid max-w-[40rem] gap-3 justify-items-start sm:grid-cols-2">
            {products.map((product) => (
              <ProductCard
                key={product.productId}
                product={product}
                variant="compact"
                disabled={!buyerAccess.allowed}
                disabledReason={buyerAccess.description}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
