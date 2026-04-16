"use client";

import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type AccessGuardHeroProps = {
  pageLabel: string;
  title: string;
  reason: string;
  primaryAction?: {
    label: string;
    href: string;
  };
  className?: string;
};

export function AccessGuardHero({
  pageLabel,
  title,
  reason,
  primaryAction,
  className
}: AccessGuardHeroProps) {
  const action = primaryAction ?? {
    label: "返回首页",
    href: "/"
  };

  return (
    <div
      className={cn(
        "flex min-h-[60vh] w-full items-center justify-center py-4 sm:py-6 lg:min-h-[68vh]",
        className
      )}
    >
      <section className="glass-card relative w-full max-w-3xl overflow-hidden border-brand-amber/18 bg-[linear-gradient(180deg,_rgba(255,253,248,0.98)_0%,_rgba(245,238,220,0.95)_100%)] p-6 sm:p-8 lg:p-10">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,_rgba(191,132,48,0.2),_transparent_58%)]" />
        <div className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_center,_rgba(32,76,58,0.08),_transparent_62%)]" />

        <div className="relative space-y-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-amber/12 px-4 py-2 text-sm font-semibold text-brand-amber">
            <Lock className="h-4 w-4" />
            访问受限
          </div>

          <div className="mx-auto max-w-2xl space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-amber">{pageLabel}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-brand-green sm:text-4xl">
              {title}
            </h1>
            <p className="text-base leading-8 text-text-muted">
              {reason}
            </p>
          </div>

          <div className="flex justify-center">
            <Link href={action.href} className="btn-primary gap-2">
              <ArrowLeft className="h-4 w-4" />
              {action.label}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
