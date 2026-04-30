"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { RuntimeConfig } from "@/types/contract-config";

const RuntimeConfigContext = createContext<RuntimeConfig | null>(null);

export function RuntimeConfigProvider({
  children,
  value
}: {
  children: ReactNode;
  value: RuntimeConfig;
}) {
  return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>;
}

export function useRuntimeConfigContext() {
  const value = useContext(RuntimeConfigContext);
  if (!value) {
    throw new Error("RuntimeConfigProvider is missing.");
  }

  return value;
}
