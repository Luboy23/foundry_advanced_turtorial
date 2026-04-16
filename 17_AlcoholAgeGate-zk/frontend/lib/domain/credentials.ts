import type { Address } from "@/types/contract-config";
import type { AgeCredentialSet, LocalAgeCredential } from "@/types/domain";

export function isCredentialCurrent(credential: LocalAgeCredential | null, credentialSet: AgeCredentialSet | null) {
  if (!credential || !credentialSet) {
    return false;
  }

  try {
    return (
      Number.isInteger(credential.eligibleFromYmd) &&
      credential.versionNumber === credentialSet.version &&
      credential.setIdBytes32.toLowerCase() === credentialSet.setId.toLowerCase() &&
      BigInt(credential.merkleRoot) === credentialSet.merkleRoot
    );
  } catch {
    return false;
  }
}

export function doesCredentialMatchAddress(credential: LocalAgeCredential | null, address?: Address) {
  if (!credential || !address) {
    return false;
  }

  return credential.boundBuyerAddress.toLowerCase() === address.toLowerCase();
}
