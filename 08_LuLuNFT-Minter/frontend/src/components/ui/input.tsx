import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Input = ({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "u-text-body h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-slate-900 placeholder:text-slate-400 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200",
      className
    )}
    {...props}
  />
);
