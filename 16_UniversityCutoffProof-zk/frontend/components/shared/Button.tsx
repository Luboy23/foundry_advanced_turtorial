"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export function buttonClassName(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-transform duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50";

  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-700",
    secondary: "bg-slate-900 text-white hover:bg-slate-800",
    outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-700 hover:bg-slate-100",
    danger: "bg-rose-600 text-white shadow-sm shadow-rose-200 hover:bg-rose-700"
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return cn(base, variants[variant], sizes[size]);
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={cn(buttonClassName(variant, size), className)} {...props} />;
}
