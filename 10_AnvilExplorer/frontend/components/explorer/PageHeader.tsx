import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type Crumb = {
  label: string;
  href?: string;
};

/**
 * 页面级标题壳：
 * - 可选面包屑；
 * - 主标题与描述；
 * - 可选右侧扩展操作区。
 */
export default function PageHeader({
  kicker = "Anvil Local Explorer",
  title,
  description,
  breadcrumbs,
  extra,
}: {
  kicker?: string;
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  extra?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList className="text-xs text-slate-500">
            {breadcrumbs.map((crumb, index) => {
              // 末级面包屑不渲染为可点击链接。
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={`${crumb.label}-${index}`} className="contents">
                  <BreadcrumbItem>
                    {crumb.href && !isLast ? (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {!isLast ? <BreadcrumbSeparator /> : null}
                </div>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}
      <div className="glass-panel soft-glow relative overflow-hidden px-5 py-5 md:px-6 md:py-6">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-400/85 to-transparent" />
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="section-kicker">{kicker}</p>
            <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
              {title}
            </h1>
            {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
          </div>
          {extra ? <div className="shrink-0">{extra}</div> : null}
        </div>
      </div>
    </div>
  );
}
