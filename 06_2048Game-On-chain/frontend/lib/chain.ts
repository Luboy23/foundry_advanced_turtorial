export const ANVIL_CHAIN_ID = 31337;
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

// 仅为具备公共浏览器的链生成交易跳转链接；本地 Anvil 默认返回 null。
const EXPLORER_BASE_URLS: Record<number, string> = {
  1: "https://etherscan.io",
  11155111: "https://sepolia.etherscan.io",
};

export function getExplorerTxUrl(
  chainId: number | undefined,
  hash: string
) {
  if (!chainId) {
    return null;
  }
  const baseUrl = EXPLORER_BASE_URLS[chainId];
  if (!baseUrl) {
    return null;
  }
  return `${baseUrl}/tx/${hash}`;
}
