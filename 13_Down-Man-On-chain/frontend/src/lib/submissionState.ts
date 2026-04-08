/**
 * 成绩提交状态机常量。
 * 把 UI 可见阶段和 pending watchdog 时间都集中在这里管理。
 */
export type SubmitStage =
  | 'idle'
  | 'signing'
  | 'pending'
  | 'retriable_error'
  | 'zero_score_skipped'
  | 'success'

// watchdog 用来兜底 receipt 长时间无响应的情况。
export const SUBMIT_PENDING_WATCHDOG_MS = 45_000
// pending 阶段的主动复查节奏稍慢于 UI 刷新，避免给 RPC 施加无意义压力。
export const SUBMIT_PENDING_RECHECK_MS = 6_000

// 这里输出的是 UI 文案，不是状态机本身；真正的状态判断仍由 stage 驱动。
export const resolveSubmitStatusText = (stage: SubmitStage): string => {
  if (stage === 'idle') {
    return '等待自动上链...'
  }
  if (stage === 'signing') {
    return '请在钱包中签名确认'
  }
  if (stage === 'pending') {
    return '交易已发出，等待链上确认'
  }
  if (stage === 'success') {
    return '成绩已成功上链'
  }
  if (stage === 'zero_score_skipped') {
    return '零分局已跳过链上提交'
  }
  return '上链失败，请重试（成功上链后可继续）'
}
