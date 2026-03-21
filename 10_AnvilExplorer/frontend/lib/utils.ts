import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 className：
 * 先用 `clsx` 处理条件类，再用 `tailwind-merge` 去重冲突类。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
