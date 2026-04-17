import type { RuntimeConfig, Address } from "@/types/contract-config";

/**
 * React Query key 工厂。
 *
 * 所有键都显式带上 deploymentId 或关键合约地址，避免切链、重新部署或切换账户后复用到旧缓存。
 */
export const queryKeys = {
  /** 角色状态键。 */
  roleStatus(config: RuntimeConfig, address?: Address) {
    return ["role-status", address ?? null, config.roleRegistryAddress, config.deploymentId] as const;
  },
  governmentCredentialSetState(config: RuntimeConfig, address?: Address) {
    return ["government-credential-set-state", address ?? null, config.deploymentId] as const;
  },
  currentCredentialSet(config: RuntimeConfig) {
    return ["current-credential-set", config.rootRegistryAddress, config.deploymentId] as const;
  },
  credentialSetPublishHistory(config: RuntimeConfig) {
    return ["credential-set-publish-history", config.rootRegistryAddress, config.deploymentId] as const;
  },
  program(config: RuntimeConfig) {
    return ["benefit-program", config.benefitDistributorAddress, config.deploymentId] as const;
  },
  claimHistoryPrefix() {
    return ["claim-history"] as const;
  },
  claimHistory(config: RuntimeConfig, address?: Address) {
    return ["claim-history", address ?? "all", config.benefitDistributorAddress, config.deploymentId] as const;
  },
  hasClaimed(config: RuntimeConfig, address?: Address) {
    return ["has-claimed", address ?? null, config.benefitDistributorAddress, config.deploymentId] as const;
  },
  sampleCredentialSet(version: number) {
    return ["sample-credential-set", version] as const;
  }
};
