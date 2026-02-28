// 将秒数格式化为 mm:ss
export const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// 将地址缩略显示
export const formatAddress = (value?: string) => {
  if (!value) return '--'
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

// 将 Unix 秒时间戳格式化为 yyyy-MM-dd HH:mm
export const formatRelativeTime = (timestampSec: number) => {
  if (!timestampSec) return '--'
  const date = new Date(timestampSec * 1000)
  // 内部补零工具
  const pad = (value: number) => value.toString().padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hour = pad(date.getHours())
  const minute = pad(date.getMinutes())
  return `${year}-${month}-${day} ${hour}:${minute}`
}

// 将交易哈希缩略显示
export const formatTxHash = (hash?: string) => {
  if (!hash) return ''
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}
