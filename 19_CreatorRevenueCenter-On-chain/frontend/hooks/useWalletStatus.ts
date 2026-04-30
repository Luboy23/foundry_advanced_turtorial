"use client";

import { useAppSessionContext } from "@/components/providers/AppSessionProvider";

export function useWalletStatus(_expectedChainId?: number) {
  return useAppSessionContext().wallet;
}
