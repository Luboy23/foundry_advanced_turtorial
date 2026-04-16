import "server-only";

import type {
  IssuerCredentialSetSummary,
  IssuerPendingSetSummary,
  IssuerSetSnapshot,
  IssuerUploadRecord,
  LocalAgeCredential
} from "@/types/domain";
import type { Address } from "@/types/contract-config";
import {
  isIssuerMember,
  loadCredentialByKindAndAddress,
  loadIssuerSetSummary,
  promotePendingIssuerSet,
  replacePendingIssuerSet
} from "@/lib/server/runtime-db";

export function hasActiveIssuerSet() {
  return Boolean(loadIssuerSetSummary("active"));
}

export function loadPendingIssuerSet() {
  return loadIssuerSetSummary("pending") as IssuerPendingSetSummary | null;
}

export function loadActiveIssuerSet(): IssuerCredentialSetSummary | null {
  return loadIssuerSetSummary("active") as IssuerCredentialSetSummary | null;
}

export function loadIssuerSetSnapshot(): IssuerSetSnapshot {
  return {
    activeSummary: loadActiveIssuerSet(),
    pendingSummary: loadPendingIssuerSet()
  };
}

export function savePendingIssuerDraft(args: {
  summary: IssuerPendingSetSummary;
  records: IssuerUploadRecord[];
  credentials: LocalAgeCredential[];
}) {
  replacePendingIssuerSet(args);
}

export function activatePendingIssuerDraft(activeSummary: IssuerCredentialSetSummary) {
  return promotePendingIssuerSet({
    updatedAt: activeSummary.updatedAt
  });
}

export function loadClaimableCredentialByAddress(address: Address): LocalAgeCredential | null {
  return loadCredentialByKindAndAddress("active", address);
}

export function hasClaimableCredential(address: Address) {
  return Boolean(loadClaimableCredentialByAddress(address));
}

export function isAddressInActiveIssuerSet(address: Address) {
  return isIssuerMember("active", address);
}
