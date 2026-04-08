/**
 * UI 格式化工具。
 * 统一分数、时长和时间戳的展示规则，避免各组件各写一套。
 */
export const formatDuration = (survivalMs: number): string => {
  return `${(survivalMs / 1000).toFixed(1)}s`
}

// 时间戳统一按中文本地化输出，避免排行榜和历史列表出现多套格式。
export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`
}

// 分数使用千分位，兼容整数展示需求。
export const formatScore = (score: number): string => {
  return score.toLocaleString('zh-CN')
}
