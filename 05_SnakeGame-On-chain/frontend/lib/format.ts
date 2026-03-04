// 将秒数格式化为 mm:ss（入参按秒，负值不做额外处理）
export const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// 将地址缩略显示；空值统一返回占位符 --
export const formatAddress = (value?: string) => {
  if (!value) return '--'
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

// 将 Unix 秒级时间戳格式化为 yyyy-MM-dd HH:mm；0/空值返回 --
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

// 将交易哈希缩略显示；空值返回空字符串（用于条件渲染）
export const formatTxHash = (hash?: string) => {
  if (!hash) return ''
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}
