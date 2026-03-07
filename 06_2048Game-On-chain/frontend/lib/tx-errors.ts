export function formatTxError(error: unknown) {
  const fallback = "交易失败，请稍后重试或检查钱包提示。";
  if (typeof error !== "object" || error === null) {
    return fallback;
  }

  const name =
    "name" in error && typeof error.name === "string" ? error.name : "";
  const shortMessage =
    "shortMessage" in error && typeof error.shortMessage === "string"
      ? error.shortMessage
      : "";
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  const text = `${shortMessage} ${message}`.toLowerCase();

  if (
    name.includes("UserRejected") ||
    text.includes("user rejected") ||
    text.includes("user denied") ||
    text.includes("用户拒绝")
  ) {
    return "你已取消签名，未发送交易。";
  }
  if (
    text.includes("insufficient funds") ||
    text.includes("insufficient balance") ||
    text.includes("gas required exceeds allowance")
  ) {
    return "余额不足，无法支付 gas。";
  }
  if (
    name.includes("ChainMismatch") ||
    text.includes("chain") ||
    text.includes("network")
  ) {
    return "网络不匹配，请切换到本地 Anvil 网络（Chain ID 31337）。";
  }
  if (
    text.includes("failed to fetch") ||
    text.includes("networkerror") ||
    text.includes("econnrefused")
  ) {
    return "无法连接本地 RPC，请确认 Anvil 正在运行。";
  }
  if (text.includes("score=0")) {
    return "分数为 0，无法提交。";
  }

  return shortMessage || message || fallback;
}
