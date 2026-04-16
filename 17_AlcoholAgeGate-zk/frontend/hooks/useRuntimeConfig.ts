"use client";

import { useMemo } from "react";
import { getRuntimeConfig } from "@/lib/runtime-config";

export function useRuntimeConfig() {
  return useMemo(() => getRuntimeConfig(), []);
}
