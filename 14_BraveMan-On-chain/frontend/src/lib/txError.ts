/**
 * 统一提取交易错误文案。
 * 优先读取 viem/wagmi 的 `shortMessage`，其次读取通用 `message`。
 */
export const formatTxError = (error: unknown): string => {
  // viem/wagmi 常见短报错字段：适合直接展示给玩家。
  if (typeof error === 'object' && error && 'shortMessage' in error && typeof error.shortMessage === 'string') {
    return error.shortMessage
  }
  // 回退到标准 message，覆盖常规 Error 与后端封装异常。
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  // 最后兜底，避免 UI 出现空白报错文本。
  return '交易失败，请检查钱包签名或本地链状态。'
}
