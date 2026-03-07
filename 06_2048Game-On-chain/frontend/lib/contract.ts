// 未配置地址时回落到零地址，配合 isZeroAddress 在运行时阻止读写请求。
export const SCORE_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_SCORE_CONTRACT_ADDRESS ??
  "0x0000000000000000000000000000000000000000";

// 前端最小 ABI：仅保留本项目业务链路必需的方法与事件。
export const SCORE_CONTRACT_ABI = [
  {
    type: "function",
    name: "submitScore",
    inputs: [
      { name: "score", type: "uint64" },
      { name: "duration", type: "uint32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getLeaderboard",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "player", type: "address" },
          { name: "score", type: "uint64" },
          { name: "duration", type: "uint32" },
          { name: "timestamp", type: "uint64" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPlayerHistory",
    inputs: [
      { name: "player", type: "address" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "player", type: "address" },
          { name: "score", type: "uint64" },
          { name: "duration", type: "uint32" },
          { name: "timestamp", type: "uint64" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPlayerHistoryCount",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bestScores",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "leaderboardLength",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MAX_LEADERBOARD",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ScoreSubmitted",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "score", type: "uint64", indexed: false },
      { name: "duration", type: "uint32", indexed: false },
      { name: "previousBest", type: "uint64", indexed: false },
      { name: "isNewBest", type: "bool", indexed: false },
    ],
    anonymous: false,
  },
] as const;

export function isZeroAddress(address: string) {
  return /^0x0{40}$/.test(address);
}
