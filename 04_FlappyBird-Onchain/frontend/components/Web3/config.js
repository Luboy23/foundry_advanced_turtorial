// wagmi 配置：指定链与传输方式。
import { http, createConfig } from "wagmi";
import { anvil } from "wagmi/chains";

// 统一 RPC 来源：与 viem 客户端保持一致
const RPC_URL = import.meta.env.VITE_ANVIL_RPC_URL || "http://127.0.0.1:8545";

export const config = createConfig({
  // 仅连接本地 anvil 链
  chains: [anvil],
  transports: {
    // 配置 RPC 传输（默认本地 8545）
    [anvil.id]: http(RPC_URL),
  },
  // 关闭 SSR，避免浏览器 API 在服务端被访问
  ssr: false,
});
