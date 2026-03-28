"use client";

import { useEventEvents } from "@/hooks/useEventEvents";

/** 全局链上事件监听器：挂载后自动触发相关 query 失效。 */
export function ChainEventIndexer() {
  useEventEvents();
  return null;
}
