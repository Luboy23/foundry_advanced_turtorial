import type { Abi } from "viem";
import benefitRoleRegistryJson from "@/abi/BenefitRoleRegistry.json";
import unemploymentCredentialRootRegistryJson from "@/abi/UnemploymentCredentialRootRegistry.json";
import unemploymentBenefitDistributorJson from "@/abi/UnemploymentBenefitDistributor.json";

/** 正式前端使用的链上 ABI 入口，统一从同步脚本写入的 JSON 中导出。 */
export const benefitRoleRegistryAbi = benefitRoleRegistryJson as Abi;
export const unemploymentCredentialRootRegistryAbi = unemploymentCredentialRootRegistryJson as Abi;
export const unemploymentBenefitDistributorAbi = unemploymentBenefitDistributorJson as Abi;
