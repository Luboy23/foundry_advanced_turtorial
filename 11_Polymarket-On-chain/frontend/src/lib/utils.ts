import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * 合并 className：
 * 先按 `clsx` 规则展开条件类名，再通过 `twMerge` 去重冲突的 Tailwind 类。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
