/**
 * 交易错误格式化。
 * 把底层钱包/RPC 抛出的英文错误尽量翻译成用户可读文案。
 */
export const formatTxError = (error: unknown): string => {
  // viem / wagmi / 钱包扩展的错误结构不完全一致，先尽量宽松提取 message。
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  // 多数钱包对用户取消会给出不同措辞，这里统一折叠成一个中文提示。
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
  // 未命中已知模式时保留原始消息，方便开发环境排查链路问题。
  if (message.trim().length > 0) {
    return message;
  }
  return "交易提交失败，请稍后重试";
};
