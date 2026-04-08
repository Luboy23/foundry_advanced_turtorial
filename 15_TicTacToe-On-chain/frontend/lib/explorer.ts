import { Address } from "viem";

// 常见链的地址浏览器前缀；本地链无映射时返回 undefined。
const ADDRESS_EXPLORER_PREFIX: Record<number, string> = {
  1: "https://etherscan.io/address/",
  10: "https://optimistic.etherscan.io/address/",
  56: "https://bscscan.com/address/",
  137: "https://polygonscan.com/address/",
  42161: "https://arbiscan.io/address/",
  8453: "https://basescan.org/address/",
  11155111: "https://sepolia.etherscan.io/address/",
  84532: "https://sepolia.basescan.org/address/",
};

// 根据 chainId 生成地址浏览器链接，未配置链直接返回 undefined。
export const getAddressExplorerUrl = (
  chainId: number,
  address: Address
): string | undefined => {
  const prefix = ADDRESS_EXPLORER_PREFIX[chainId];
  if (!prefix) return undefined;
  return `${prefix}${address}`;
};
