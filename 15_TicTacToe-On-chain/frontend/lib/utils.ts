import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// 合并 className：先做条件拼接，再按 Tailwind 规则去重冲突类名。
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
