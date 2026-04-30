"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const variantClassName = {
      primary: "bg-brand-pink text-white hover:bg-brand-pink-hover shadow-[var(--shadow-soft-pink)]",
      secondary: "bg-bg-soft-pink text-brand-pink hover:bg-brand-pink/10",
      outline: "border border-line-soft bg-white text-text-ink hover:bg-bg-soft-pink",
      ghost: "bg-transparent text-text-muted hover:bg-bg-soft-pink hover:text-brand-pink"
    }[variant];

    const sizeClassName = {
      sm: "h-9 px-4 text-sm",
      md: "h-11 px-5 text-sm",
      lg: "h-14 px-7 text-base"
    }[size];

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
          variantClassName,
          sizeClassName,
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
