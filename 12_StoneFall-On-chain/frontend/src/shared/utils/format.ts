/**
 * 模块职责：提供 shared/utils/format.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

export const formatDuration = (survivalMs: number): string => {
  return `${(survivalMs / 1000).toFixed(1)}s`
}

/**
 * formatTimestamp：将数据格式化为可展示文本。
 */
export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`
}

/**
 * formatScore：将数据格式化为可展示文本。
 */
export const formatScore = (score: number): string => {
  return score.toLocaleString('zh-CN')
}
