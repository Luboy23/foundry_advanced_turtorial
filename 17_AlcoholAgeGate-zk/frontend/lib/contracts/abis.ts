import type { Abi } from "viem";
import alcoholRoleRegistryJson from "@/abi/AlcoholRoleRegistry.json";
import ageCredentialRootRegistryJson from "@/abi/AgeCredentialRootRegistry.json";
import alcoholAgeEligibilityVerifierJson from "@/abi/AlcoholAgeEligibilityVerifier.json";
import alcoholMarketplaceJson from "@/abi/AlcoholMarketplace.json";

export const alcoholRoleRegistryAbi = alcoholRoleRegistryJson as Abi;
export const ageCredentialRootRegistryAbi = ageCredentialRootRegistryJson as Abi;
export const alcoholAgeEligibilityVerifierAbi = alcoholAgeEligibilityVerifierJson as Abi;
export const alcoholMarketplaceAbi = alcoholMarketplaceJson as Abi;
