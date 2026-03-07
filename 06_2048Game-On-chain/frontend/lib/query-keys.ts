// 排行榜按合约地址隔离缓存，便于本地链重部署后快速切换数据空间。
export const leaderboardKey = (contract: string) =>
  ["leaderboard", contract] as const;

// 玩家历史缓存粒度：合约地址 + 玩家地址。
export const historyKey = (contract: string, player?: string) =>
  ["history", contract, player ?? ""] as const;

export const historyCountKey = (contract: string, player?: string) =>
  ["history-count", contract, player ?? ""] as const;

// 基础 key 用于批量失效（例如一笔成绩上链后刷新全部历史分页）。
export const historyBaseKey = (contract: string) =>
  ["history", contract] as const;

export const historyCountBaseKey = (contract: string) =>
  ["history-count", contract] as const;
