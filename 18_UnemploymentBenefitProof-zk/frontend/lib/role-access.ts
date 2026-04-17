import type { DemoAddresses } from "@/types/contract-config";
import type { RoleStatus } from "@/types/domain";
import { roleCopy, sharedCopy } from "@/lib/copy";
import { formatAddress } from "@/lib/utils";

/**
 * 角色访问解析器。
 *
 * 这一层把钱包连接状态、链状态、链上角色查询结果和教学演示账号提示合并成统一的
 * `RoleAccessState`，供导航、首页入口和工作台阻塞卡片共享使用。
 */
export const roleDefinitions = {
  government: {
    key: "government",
    title: roleCopy.government.title,
    desc: roleCopy.government.desc,
    path: roleCopy.government.path,
    recommendedAccountLabel: roleCopy.government.recommendedAccountLabel
  },
  applicant: {
    key: "applicant",
    title: roleCopy.applicant.title,
    desc: roleCopy.applicant.desc,
    path: roleCopy.applicant.path,
    recommendedAccountLabel: roleCopy.applicant.recommendedAccountLabel
  },
  agency: {
    key: "agency",
    title: roleCopy.agency.title,
    desc: roleCopy.agency.desc,
    path: roleCopy.agency.path,
    recommendedAccountLabel: roleCopy.agency.recommendedAccountLabel
  }
} as const;

export const roleKeys = Object.keys(roleDefinitions) as RoleKey[];

export type RoleKey = keyof typeof roleDefinitions;

export type BlockedReason =
  | "wallet-disconnected"
  | "wrong-chain"
  | "checking-role"
  | "role-query-failed"
  | "missing-role";

export type RoleAccessState = {
  role: RoleKey;
  allowed: boolean;
  reason: BlockedReason | null;
  reasonTitle: string;
  reasonBody: string;
  recommendedAccount?: string;
  recommendedAccountLabel?: string;
};

type ResolveRoleAccessArgs = {
  role: RoleKey;
  walletConnected: boolean;
  wrongChain: boolean;
  roleStatus?: RoleStatus;
  roleStatusLoading: boolean;
  roleStatusError?: boolean;
  demoAddresses: DemoAddresses;
};

/** 从链上角色查询结果中挑出当前页面真正关心的那一位。 */
function getRolePermission(role: RoleKey, roleStatus: RoleStatus) {
  if (role === "government") {
    return roleStatus.isGovernment;
  }
  if (role === "agency") {
    return roleStatus.isAgency;
  }
  return roleStatus.isApplicant;
}

/** 返回某个角色推荐使用的演示地址。 */
export function getRecommendedDemoAddress(role: RoleKey, demoAddresses: DemoAddresses) {
  return demoAddresses[role];
}

/** 返回带有缩略格式的钱包地址提示文案。 */
export function getRecommendedDemoAddressLabel(role: RoleKey, demoAddresses: DemoAddresses) {
  return `${roleDefinitions[role].recommendedAccountLabel} ${formatAddress(getRecommendedDemoAddress(role, demoAddresses))}`;
}

/** 根据钱包、链和角色状态计算某个工作台入口是否可访问，以及需要给用户展示什么阻塞原因。 */
export function resolveRoleAccess({
  role,
  walletConnected,
  wrongChain,
  roleStatus,
  roleStatusLoading,
  roleStatusError = false,
  demoAddresses
}: ResolveRoleAccessArgs): RoleAccessState {
  if (!walletConnected) {
    return {
      role,
      allowed: false,
      reason: "wallet-disconnected",
      reasonTitle: sharedCopy.connectAccountRequiredTitle,
      reasonBody: sharedCopy.connectAccountRequiredBody
    };
  }

  if (wrongChain) {
    return {
      role,
      allowed: false,
      reason: "wrong-chain",
      reasonTitle: sharedCopy.switchNetworkRequiredTitle,
      reasonBody: sharedCopy.switchNetworkRequiredBody
    };
  }

  if (roleStatusLoading || !roleStatus) {
    if (roleStatusError) {
      return {
        role,
        allowed: false,
        reason: "role-query-failed",
        reasonTitle: sharedCopy.roleQueryFailedTitle,
        reasonBody: sharedCopy.roleQueryFailedBody
      };
    }

    return {
      role,
      allowed: false,
      reason: "checking-role",
      reasonTitle: sharedCopy.checkingAccessTitle,
      reasonBody: sharedCopy.checkingAccessBody
    };
  }

  if (getRolePermission(role, roleStatus)) {
    return {
      role,
      allowed: true,
      reason: null,
      reasonTitle: "",
      reasonBody: ""
    };
  }

  const recommendedAccount = formatAddress(getRecommendedDemoAddress(role, demoAddresses));
  return {
    role,
    allowed: false,
    reason: "missing-role",
    reasonTitle:
      role === "government"
        ? "当前账户暂无审核管理权限"
        : role === "agency"
          ? "当前账户暂无发放管理权限"
          : "当前账户暂无申请资格",
    reasonBody:
      role === "government"
        ? `请切换到 ${getRecommendedDemoAddressLabel(role, demoAddresses)} 后，再继续发布或更新资格名单。`
        : role === "agency"
          ? `请切换到 ${getRecommendedDemoAddressLabel(role, demoAddresses)} 后，再继续管理补助资金和发放状态。`
          : `请切换到 ${getRecommendedDemoAddressLabel(role, demoAddresses)} 后，再继续申请补助或提交资格核验。`,
    recommendedAccount,
    recommendedAccountLabel: roleDefinitions[role].recommendedAccountLabel
  };
}
