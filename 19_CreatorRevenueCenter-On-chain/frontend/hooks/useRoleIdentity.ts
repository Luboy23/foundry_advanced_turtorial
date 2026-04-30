"use client";

import type { Address } from "@/types/contract-config";
import { resolveRoleIdentity } from "@/lib/roles";
import { useAppSessionContext } from "@/components/providers/AppSessionProvider";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";

export function useRoleIdentity(walletAddress?: Address) {
  const session = useAppSessionContext();
  const config = useRuntimeConfig();
  return walletAddress ? resolveRoleIdentity(walletAddress, config.demoAddresses) : session.roleIdentity;
}
