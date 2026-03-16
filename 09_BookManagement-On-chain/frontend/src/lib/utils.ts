import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// tailwind class 合并工具（shadcn 常用）
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
