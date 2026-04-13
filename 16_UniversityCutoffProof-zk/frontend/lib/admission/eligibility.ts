import type { AdmissionCredential } from "@/types/credential";
import type { SchoolRuleVersion } from "@/types/admission";
import type { StudentApplicationSummary } from "@/types/history";

// 统一生成“关键链上数据尚未就绪时”的阻断原因。
// 申请页和学生页都复用这套顺序，确保用户总是先看到最需要处理的系统级问题。
function getCriticalReadGuardReason(args: {
  configured: boolean;
  connected: boolean;
  wrongChain: boolean;
  isLoading: boolean;
  isError: boolean;
  loadingMessage: string;
  errorMessage: string;
}) {
  const { configured, connected, wrongChain, isLoading, isError, loadingMessage, errorMessage } = args;

  if (!configured || !connected || wrongChain) {
    return null;
  }
  if (isLoading) {
    return loadingMessage;
  }
  if (isError) {
    return errorMessage;
  }
  return null;
}

// 判断学生是否真正满足“可以提交申请”的最小业务条件。
export function isEligibleForApplication(
  credential: AdmissionCredential | null,
  version: SchoolRuleVersion | null
) {
  return Boolean(
    credential &&
      version &&
      version.active &&
      version.cutoffFrozen &&
      credential.score >= version.cutoffScore
  );
}

export function getHistoryReadGuardReason(args: {
  configured: boolean;
  connected: boolean;
  wrongChain: boolean;
  isLoading: boolean;
  isError: boolean;
}) {
  // 历史状态决定“当前账户是否已经被永久锁定”，因此读取失败时必须 fail-closed。
  return getCriticalReadGuardReason({
    ...args,
    loadingMessage: "正在读取当前账户申请状态，请稍候。",
    errorMessage: "链上申请状态读取失败，已阻止重复申请。"
  });
}

export function getRuleReadGuardReason(args: {
  configured: boolean;
  connected: boolean;
  wrongChain: boolean;
  isLoading: boolean;
  isError: boolean;
}) {
  // 申请规则读取失败时，前端宁可阻断申请，也不能回退到不确定的旧规则。
  return getCriticalReadGuardReason({
    ...args,
    loadingMessage: "正在读取当前申请规则，请稍候。",
    errorMessage: "链上申请规则读取失败，已阻止重复申请。"
  });
}

// 给申请按钮生成“为什么现在还不能继续”的统一原因文案。
// 该顺序刻意从系统级问题 -> 学校规则状态 -> 钱包条件 -> 成绩凭证条件逐层收紧，
// 这样学生看到的总是最需要先解决的那个问题。
export function getApplicationGuardReason(args: {
  configured: boolean;
  connected: boolean;
  wrongChain: boolean;
  credential: AdmissionCredential | null;
  version: SchoolRuleVersion | null;
  merkleRootMatches: boolean;
  currentApplication?: StudentApplicationSummary | null;
}) {
  const {
    configured,
    connected,
    wrongChain,
    credential,
    version,
    merkleRootMatches,
    currentApplication
  } = args;

  if (!configured) {
    return "系统配置未完成，暂时无法提交申请。";
  }
  if (!connected) {
    return "请先连接学生账户。";
  }
  if (wrongChain) {
    return "请切换到项目链后再继续。";
  }
  if (currentApplication) {
    const sameSchool = version
      ? currentApplication.schoolId.toLowerCase() === version.schoolId.toLowerCase()
      : false;
    if (currentApplication.status === "APPROVED") {
      if (sameSchool) {
        return `你已被 ${currentApplication.schoolName} 录取，无需重复申请。`;
      }
      return `你已被 ${currentApplication.schoolName} 录取，无法再申请其他学校。`;
    }
    if (currentApplication.status === "REJECTED") {
      if (sameSchool) {
        return "该申请已被大学拒绝，但当前账户申请资格已永久锁定。";
      }
      return `你已向 ${currentApplication.schoolName} 提交申请且已被拒绝，当前账户申请资格已永久锁定。`;
    }
    if (sameSchool) {
      return "你已向该校提交申请，等待大学审批。";
    }
    return `你已向 ${currentApplication.schoolName} 提交申请，当前账户不能再申请其他学校。`;
  }
  if (!version) {
    return "未找到对应的申请规则，请从学生工作台重新进入。";
  }
  if (!version.cutoffFrozen || !version.active) {
    return "该校当前暂未开放这一轮申请。";
  }
  if (!credential) {
    return "请先导入考试院发放的成绩凭证。";
  }
  if (!merkleRootMatches) {
    return "当前成绩凭证与系统记录不一致。";
  }
  if (credential.score < version.cutoffScore) {
    return `当前成绩未达到 ${version.schoolName} 的录取线。`;
  }
  return null;
}
