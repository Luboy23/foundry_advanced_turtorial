"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * 返回组件是否已在客户端挂载。
 * 用于避免 SSR 与 CSR 首帧渲染差异导致的 hydration 警告。
 */
export function useClientMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}
