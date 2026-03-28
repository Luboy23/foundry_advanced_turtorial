/**
 * 模块职责：把链上交易错误归一化为可读中文提示。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

/**
 * 交易错误格式化。
 * 优先识别常见钱包拒签、余额不足、合约自定义错误；其余回退原始 message。
 */
export const formatTxError = (error: unknown): string => {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  // 钱包拒签在不同钱包/客户端里可能出现不同文本，这里做宽匹配。
  if (message.toLowerCase().includes("user rejected")) {
    return "你已取消钱包签名";
  }
  if (message.toLowerCase().includes("rejected")) {
    return "你已取消钱包签名";
  }
  if (message.toLowerCase().includes("insufficient funds")) {
    return "账户余额不足，无法支付 Gas";
  }
  if (message.includes("ScoreMustBeGreaterThanZero")) {
    return "分数为 0，无法上链提交";
  }
  if (message.trim().length > 0) {
    return message;
  }
  return "交易提交失败，请稍后重试";
};
