"use client";

import { useMemo } from "react";
import { deriveBuyerFlowState } from "@/lib/buyer-flow";
import type { AgeCredentialSet, EligibilityStatus } from "@/types/domain";
import type { RoleStatus } from "@/types/domain";

type BuyerFlowStateArgs = {
  wallet: {
    isConnected: boolean;
    wrongChain: boolean;
  };
  roleStatus: RoleStatus | null | undefined;
  localCredential: {
    hasStoredCredential: boolean;
    status: "missing" | "loading" | "ready" | "mismatch" | "error";
    error: string | null;
    isClaiming: boolean;
    credential: import("@/types/domain").LocalAgeCredential | null;
  };
  currentSet: AgeCredentialSet | null;
  eligibility: EligibilityStatus | null;
  currentDateYmd: number | null;
  canPurchaseNow?: boolean;
};

export function useBuyerFlowState(args: BuyerFlowStateArgs) {
  return useMemo(
    () =>
      deriveBuyerFlowState({
        isConnected: args.wallet.isConnected,
        wrongChain: args.wallet.wrongChain,
        hasBuyerRole: Boolean(args.roleStatus?.isBuyer),
        hasStoredCredential: args.localCredential.hasStoredCredential,
        credentialStatus: args.localCredential.status,
        credentialError: args.localCredential.error,
        isClaiming: args.localCredential.isClaiming,
        credential: args.localCredential.credential,
        currentSet: args.currentSet,
        eligibility: args.eligibility,
        currentDateYmd: args.currentDateYmd,
        canPurchaseNow: args.canPurchaseNow
      }),
    [args]
  );
}
