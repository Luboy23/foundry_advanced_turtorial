export function shortenAddress(address: string, size = 4) {
  if (!address) return "";
  const prefix = address.slice(0, 2 + size);
  const suffix = address.slice(-size);
  return `${prefix}...${suffix}`;
}

export function formatTimestamp(timestamp: number) {
  if (!timestamp) return "-";
  const date = new Date(timestamp * 1000);
  return date.toLocaleString("zh-CN");
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "00:00";
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(minutes)}:${pad(remaining)}`;
}

export function formatUpdatedAt(timestampMs: number) {
  if (!timestampMs) {
    return "-";
  }
  const date = new Date(timestampMs);
  return date.toLocaleString("zh-CN");
}
