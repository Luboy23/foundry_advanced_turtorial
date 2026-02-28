// 合约 ABI 与地址的统一出口（支持自动同步与环境变量覆盖）。
import flappyScoreAbi from "./flappyScore.abi.json";
import addressJson from "./flappyScore.address.json";

// 地址优先级：环境变量 > 自动同步文件 > 空字符串
export const flappyScoreAddress =
  import.meta.env.VITE_FLAPPY_SCORE_ADDRESS || addressJson?.address || "";

// 导出 ABI 供 viem 读写合约
export { flappyScoreAbi };
