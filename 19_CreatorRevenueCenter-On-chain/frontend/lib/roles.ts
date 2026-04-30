import type { DemoAddresses } from "@/types/contract-config";
import type { FrontendRole, WorkspaceAccessState } from "@/types/domain";

export type ExpectedWorkspaceRole = Exclude<FrontendRole, "guest">;

export type RoleIdentity = {
  role: FrontendRole;
  label: string;
  collaboratorLabel: string | null;
  defaultHref: string;
  isRecognized: boolean;
};

function isSameAddress(left?: string | null, right?: string | null) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

export function getRoleLabel(role: FrontendRole, collaboratorLabel?: string | null) {
  if (role === "platform") return "平台";
  if (role === "creator") return "创作者";
  if (role === "collaborator") return collaboratorLabel ?? "协作者";
  return "游客";
}

export function getRoleHomeHref(role: FrontendRole) {
  if (role === "platform") return "/platform";
  if (role === "creator") return "/creator";
  if (role === "collaborator") return "/collaborator";
  return "/";
}

export function resolveRoleIdentity(walletAddress: string | undefined, demoAddresses: DemoAddresses): RoleIdentity {
  if (!walletAddress) {
    return {
      role: "guest",
      label: "游客",
      collaboratorLabel: null,
      defaultHref: "/",
      isRecognized: false
    };
  }

  if (isSameAddress(walletAddress, demoAddresses.platform)) {
    return {
      role: "platform",
      label: "平台",
      collaboratorLabel: null,
      defaultHref: "/platform",
      isRecognized: true
    };
  }

  if (isSameAddress(walletAddress, demoAddresses.creator)) {
    return {
      role: "creator",
      label: "创作者",
      collaboratorLabel: null,
      defaultHref: "/creator",
      isRecognized: true
    };
  }

  if (isSameAddress(walletAddress, demoAddresses.collaboratorA)) {
    return {
      role: "collaborator",
      label: "编导",
      collaboratorLabel: "编导",
      defaultHref: "/collaborator",
      isRecognized: true
    };
  }

  if (isSameAddress(walletAddress, demoAddresses.collaboratorB)) {
    return {
      role: "collaborator",
      label: "摄影",
      collaboratorLabel: "摄影",
      defaultHref: "/collaborator",
      isRecognized: true
    };
  }

  return {
    role: "guest",
    label: "未识别账户",
    collaboratorLabel: null,
    defaultHref: "/",
    isRecognized: false
  };
}

export function getRoleEntryDisabledReason(args: {
  isHydrated: boolean;
  isConnected: boolean;
  currentRole: FrontendRole;
  currentRoleLabel: string;
  expectedRole: ExpectedWorkspaceRole;
  isRecognized: boolean;
}) {
  const { isHydrated, isConnected, currentRole, currentRoleLabel, expectedRole, isRecognized } = args;

  if (!isHydrated) {
    return "正在读取当前钱包状态。";
  }

  if (!isConnected) {
    return "请先连接钱包。";
  }

  if (!isRecognized) {
    return "当前钱包未被分配到项目角色。";
  }

  if (currentRole !== expectedRole) {
    return `当前钱包身份是${currentRoleLabel}，不能进入这个工作台。`;
  }

  return null;
}

export function getRoleEntryActionReason(args: {
  isHydrated: boolean;
  isConnected: boolean;
  currentRole: FrontendRole;
  currentRoleLabel: string;
  expectedRole: ExpectedWorkspaceRole;
  isRecognized: boolean;
}) {
  const { isHydrated, isConnected, currentRole, currentRoleLabel, expectedRole, isRecognized } = args;
  const expectedRoleLabel = getRoleLabel(expectedRole);

  if (!isHydrated) {
    return `正在确认钱包状态，请稍后进入${expectedRoleLabel}工作台。`;
  }

  if (!isConnected) {
    return `连接钱包后即可进入${expectedRoleLabel}工作台。`;
  }

  if (!isRecognized) {
    return `当前钱包未分配项目角色，请切换${expectedRoleLabel}钱包。`;
  }

  if (currentRole !== expectedRole) {
    return `当前是${currentRoleLabel}钱包，请切换为${expectedRoleLabel}钱包。`;
  }

  return null;
}

export function buildWorkspaceAccessState(args: {
  isHydrated: boolean;
  isConnected: boolean;
  role: FrontendRole;
  roleLabel: string;
  expectedRole: ExpectedWorkspaceRole;
  isRecognized: boolean;
}): WorkspaceAccessState {
  const reason = getRoleEntryDisabledReason({
    isHydrated: args.isHydrated,
    isConnected: args.isConnected,
    currentRole: args.role,
    currentRoleLabel: args.roleLabel,
    expectedRole: args.expectedRole,
    isRecognized: args.isRecognized
  });

  return {
    role: args.role,
    expectedRole: args.expectedRole,
    allowed: reason == null,
    reason
  };
}
