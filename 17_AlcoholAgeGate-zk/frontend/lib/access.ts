import type { Address, RuntimeConfig } from "@/types/contract-config";

export type DemoRole = keyof RuntimeConfig["demoAddresses"];

export type RoleAccessState = {
  allowed: boolean;
  description: string | null;
};

export const demoRoleLabels: Record<DemoRole, string> = {
  buyer: "买家",
  seller: "卖家",
  issuer: "年龄验证方"
};

export function matchesDemoRoleAddress(
  address: Address | undefined,
  config: RuntimeConfig,
  role: DemoRole
) {
  if (!address) {
    return false;
  }

  return address.toLowerCase() === config.demoAddresses[role].toLowerCase();
}

export function getDemoRoleAccessState(args: {
  role: DemoRole;
  isConnected: boolean;
  wrongChain: boolean;
  address?: Address;
  config: RuntimeConfig;
}): RoleAccessState & { expectedAddress: Address } {
  const { role, isConnected, wrongChain, address, config } = args;
  const roleLabel = demoRoleLabels[role];
  const expectedAddress = config.demoAddresses[role];

  if (!isConnected) {
    return {
      allowed: false,
      description: `请先连接${roleLabel}账户后再进入。`,
      expectedAddress
    };
  }

  if (wrongChain) {
    return {
      allowed: false,
      description: `当前网络不正确，请先切换到项目网络后再进入${roleLabel}页面。`,
      expectedAddress
    };
  }

  if (!matchesDemoRoleAddress(address, config, role)) {
    return {
      allowed: false,
      description: `当前账户暂无${roleLabel}权限，请切换到对应账户后再进入。`,
      expectedAddress
    };
  }

  return {
    allowed: true,
    description: null,
    expectedAddress
  };
}

export function getBuyerRoleAccessState(args: {
  isConnected: boolean;
  wrongChain: boolean;
  isLoadingRole: boolean;
  roleError: boolean;
  hasBuyerRole: boolean;
}): RoleAccessState {
  const { isConnected, wrongChain, isLoadingRole, roleError, hasBuyerRole } = args;

  if (!isConnected) {
    return {
      allowed: false,
      description: "请先连接买家账户后再进入。"
    };
  }

  if (wrongChain) {
    return {
      allowed: false,
      description: "当前网络不正确，请先切换到项目网络后再进入买家页面。"
    };
  }

  if (isLoadingRole) {
    return {
      allowed: false,
      description: "正在确认当前账户是否具备买家权限。"
    };
  }

  if (roleError) {
    return {
      allowed: false,
      description: "当前暂时无法确认买家权限，请稍后重试。"
    };
  }

  if (!hasBuyerRole) {
    return {
      allowed: false,
      description: "当前账户暂无买家权限，请联系年龄验证方上传名单并发布后再试。"
    };
  }

  return {
    allowed: true,
    description: null
  };
}
