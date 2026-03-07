"use client";

import { cn } from "@/lib/utils";

export const SectionHeader = ({
  title,
  description,
  eyebrow,
  as = "h2",
  className
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  as?: "h1" | "h2";
  className?: string;
}) => {
  const Heading = as;
  return (
    <div className={cn("u-stack-2", className)}>
      {eyebrow ? (
        <p className="u-text-meta font-semibold uppercase tracking-[0.3em] text-slate-400">
          {eyebrow}
        </p>
      ) : null}
      <Heading
        className={cn(
          "font-bold text-slate-900",
          as === "h1" ? "text-4xl md:text-5xl" : "text-3xl md:text-4xl"
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p className="u-text-body text-slate-600">{description}</p>
      ) : null}
    </div>
  );
};
