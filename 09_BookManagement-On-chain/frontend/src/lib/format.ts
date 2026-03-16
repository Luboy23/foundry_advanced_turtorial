// 将地址/哈希缩短显示（保留首尾）
export const shortenHex = (value: string, head = 6, tail = 4) =>
  value.length > head + tail ? `${value.slice(0, head)}...${value.slice(-tail)}` : value;
