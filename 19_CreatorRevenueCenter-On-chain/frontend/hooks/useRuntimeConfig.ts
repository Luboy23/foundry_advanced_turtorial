"use client";

import { useRuntimeConfigContext } from "@/components/providers/RuntimeConfigProvider";

export function useRuntimeConfig() {
  return useRuntimeConfigContext();
}
