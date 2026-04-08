import { LeaderboardRecord } from "@/types/types";
import { Address } from "viem";

// 地址归一化为小写字符串，确保排序比较稳定可重复。
const normalize = (address?: Address) => address?.toLowerCase() || "";

// 排行榜排序规则：总分降序 -> 对局数降序 -> 展示地址升序 -> 原地址升序。
export const compareLeaderboardRecords = (
  a: LeaderboardRecord,
  b: LeaderboardRecord
): number => {
  if (a.totalScore !== b.totalScore) {
    return a.totalScore > b.totalScore ? -1 : 1;
  }
  if (a.gamesPlayed !== b.gamesPlayed) {
    return a.gamesPlayed > b.gamesPlayed ? -1 : 1;
  }

  const displayAddressCompare = normalize(a.displayAddress).localeCompare(
    normalize(b.displayAddress)
  );
  if (displayAddressCompare !== 0) {
    return displayAddressCompare;
  }

  return normalize(a.player).localeCompare(normalize(b.player));
};
