// 生存时长格式化（毫秒 -> 秒，保留一位小数）。
export const formatDuration = (survivalMs: number): string => `${(survivalMs / 1000).toFixed(1)}s`
// 数值格式化：统一使用中文地区分组。
export const formatNumber = (value: number): string => value.toLocaleString('zh-CN')
// 时间戳格式化：输出“日期 + 24 小时制时间”。
export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`
}
