"use client";

import { useMemo } from "react";
import { getRuntimeConfig } from "@/lib/runtime-config";

/** 在客户端读取并缓存当前运行时配置。 */
export function useRuntimeConfig() {
  return useMemo(() => getRuntimeConfig(), []);
}
