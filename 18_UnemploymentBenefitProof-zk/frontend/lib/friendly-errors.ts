/**
 * 统一把底层异常映射成用户可理解的错误文案。
 *
 * 页面和 Hook 不直接暴露 wagmi / viem / 自定义服务端异常，而是通过这里把常见错误归一化成
 * 面向业务用户的中文提示。
 */
export type FriendlyErrorContext =
  | "wallet-connect"
  | "wallet-switch"
  | "credential-claim"
  | "credential-storage"
  | "verify-proof"
  | "verify-submit"
  | "publish-credential-set"
  | "fund-program"
  | "toggle-program"
  | "generic";

/** 各业务场景的兜底文案。 */
const fallbackMessages: Record<FriendlyErrorContext, string> = {
  "wallet-connect": "当前未能完成账户连接，请稍后重试。",
  "wallet-switch": "当前未能切换到服务网络，请稍后重试。",
  "credential-claim": "当前未能领取资格凭证，请稍后重试。",
  "credential-storage": "当前未能读取资格凭证，请稍后重试。",
  "verify-proof": "当前未能完成资格核验准备，请稍后重试。",
  "verify-submit": "当前未能完成补助领取，请稍后重试。",
  "publish-credential-set": "当前未能更新资格名单，请稍后重试。",
  "fund-program": "当前未能补充资金，请稍后重试。",
  "toggle-program": "当前未能更新发放状态，请稍后重试。",
  generic: "当前操作未能完成，请稍后重试。"
};

/** 用户主动取消动作时使用的文案。 */
const cancelMessages: Record<FriendlyErrorContext, string> = {
  "wallet-connect": "你已取消本次账户连接。",
  "wallet-switch": "你已取消本次网络切换。",
  "credential-claim": "你已取消本次资格凭证申请。",
  "credential-storage": "你已取消本次资格凭证处理。",
  "verify-proof": "你已取消本次资格核验准备。",
  "verify-submit": "你已取消本次补助领取。",
  "publish-credential-set": "你已取消本次资格名单更新。",
  "fund-program": "你已取消本次补充资金。",
  "toggle-program": "你已取消本次发放状态更新。",
  generic: "你已取消本次操作。"
};

/** 判断原始错误文本里是否包含任一关键字。 */
function includesAny(target: string, keywords: string[]) {
  return keywords.some((keyword) => target.includes(keyword));
}

/** 尽可能从不同错误对象结构中提取原始错误文本。 */
function extractErrorMessage(error: unknown): string {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object") {
    const candidate = error as {
      shortMessage?: unknown;
      details?: unknown;
      message?: unknown;
      cause?: unknown;
    };

    if (typeof candidate.shortMessage === "string" && candidate.shortMessage.trim()) {
      return candidate.shortMessage;
    }
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message;
    }
    if (typeof candidate.details === "string" && candidate.details.trim()) {
      return candidate.details;
    }
    if (candidate.cause) {
      return extractErrorMessage(candidate.cause);
    }
  }

  return "";
}

/** 返回更适合展示在“查看详情”里的原始错误摘要。 */
export function getErrorDetails(error: unknown, fallback = "暂无额外错误详情。") {
  const raw = extractErrorMessage(error).replace(/^Error:\s*/i, "").trim();
  return raw || fallback;
}

/**
 * 把底层错误映射成用户可理解的中文提示。
 *
 * 映射顺序优先考虑：
 * 1. 用户主动取消；
 * 2. 钱包/网络常见错误；
 * 3. 合约与服务端业务错误；
 * 4. 已经是简短中文错误时直接透传；
 * 5. 最终回退到场景兜底文案。
 */
export function getFriendlyErrorMessage(error: unknown, context: FriendlyErrorContext) {
  const raw = extractErrorMessage(error).replace(/^Error:\s*/i, "").trim();
  const normalized = raw.toLowerCase();

  if (!raw) {
    return fallbackMessages[context];
  }

  if (
    includesAny(normalized, [
      "user rejected",
      "user denied",
      "rejected the request",
      "rejected request",
      "rejected action",
      "用户取消",
      "交易已拒绝"
    ])
  ) {
    return cancelMessages[context];
  }

  if (includesAny(normalized, ["connector", "walletconnect", "no wallet"])) {
    return "未检测到可用的账户连接方式，请先打开并完成账户授权。";
  }

  if (includesAny(normalized, ["wrong chain", "switch chain", "chain mismatch", "network", "chain"])) {
    return "当前网络不正确，请切换到服务网络后再试。";
  }

  if (includesAny(normalized, ["insufficient funds", "余额不足"])) {
    return "当前账户余额不足，请补充余额后再试。";
  }

  if (includesAny(normalized, ["challenge expired", "challenge mismatch", "challenge not found", "签名"])) {
    return "当前资格凭证申请已失效，请重新发起申请。";
  }

  if (includesAny(normalized, ["当前账户暂不支持领取", "未找到对应的资格凭证", "private credential"])) {
    return "当前账户暂无申请资格。";
  }

  if (includesAny(normalized, ["credentialsetmismatch", "credentialsetinactive"])) {
    return "资格名单已经更新，请先更新资格凭证。";
  }

  if (includesAny(normalized, ["programinactive"])) {
    return "当前发放尚未开启，请稍后再试。";
  }

  if (includesAny(normalized, ["insufficientpoolbalance"])) {
    return "当前补助池余额不足，请等待发放机构充值后再继续。";
  }

  if (includesAny(normalized, ["benefitalreadyclaimed", "nullifieralreadyused"])) {
    return "当前补助已领取完成，无需重复提交。";
  }

  if (includesAny(normalized, ["recipientmismatch"])) {
    return "当前账户与资格凭证不一致，请切换到申请资格凭证时使用的账户。";
  }

  if (includesAny(normalized, ["invalidproof"])) {
    return "当前资格核验未通过，请更新资格凭证后重试。";
  }

  if (includesAny(normalized, ["unauthorized"])) {
    if (context === "publish-credential-set") {
      return "当前账户暂无审核管理权限。";
    }
    if (context === "fund-program" || context === "toggle-program") {
      return "当前账户暂无发放管理权限。";
    }
    if (context === "verify-submit") {
      return "当前账户暂无申请资格。";
    }
  }

  if (/[\u4e00-\u9fff]/.test(raw) && raw.length <= 90) {
    return raw;
  }

  return fallbackMessages[context];
}
