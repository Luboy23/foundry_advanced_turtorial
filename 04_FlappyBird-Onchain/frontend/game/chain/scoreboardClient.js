// 链上排行榜客户端：读写 FlappyScoreboard 合约。
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { anvil } from "viem/chains";
import { flappyScoreAbi, flappyScoreAddress } from "../../components/Web3/flappyScore";

// 零地址用于合约未配置时的安全判断
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
// RPC 地址可通过环境变量覆盖
const RPC_URL = import.meta.env.VITE_ANVIL_RPC_URL || "http://127.0.0.1:8545";

// 合约地址是否可用
export const isContractReady =
  Boolean(flappyScoreAddress) && flappyScoreAddress !== ZERO_ADDRESS;

// 公共客户端：只读请求
const publicClient = createPublicClient({
  chain: anvil,
  transport: http(RPC_URL),
});

// 获取链上 Top10 排行榜
export const fetchLeaderboard = async () => {
  if (!isContractReady) return [];
  const [players, scores, timestamps] = await publicClient.readContract({
    address: flappyScoreAddress,
    abi: flappyScoreAbi,
    functionName: "getLeaderboard",
  });

  // 将三数组结构整合成对象数组
  return players.map((player, index) => ({
    player,
    score: scores[index],
    timestamp: timestamps[index],
  }));
};

// 提交分数（需要钱包签名）
export const submitScore = async (score) => {
  if (!isContractReady) return { status: "disabled" };
  if (typeof window === "undefined" || !window.ethereum) {
    return { status: "no_wallet" };
  }

  // 确认已有连接账户
  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) {
    return { status: "no_account" };
  }

  // 钱包客户端：写交易
  const walletClient = createWalletClient({
    chain: anvil,
    transport: custom(window.ethereum),
  });

  // 校验链 ID 是否为 Anvil
  const walletChainId = await walletClient.getChainId();
  if (walletChainId !== anvil.id) {
    return { status: "wrong_network", expected: anvil.id, actual: walletChainId };
  }

  // 发送交易并返回 hash
  const hash = await walletClient.writeContract({
    address: flappyScoreAddress,
    abi: flappyScoreAbi,
    functionName: "submitScore",
    args: [BigInt(score)],
    account: accounts[0],
  });

  return { status: "submitted", hash };
};

// 等待交易上链
export const waitForReceipt = (hash) =>
  publicClient.waitForTransactionReceipt({ hash });
