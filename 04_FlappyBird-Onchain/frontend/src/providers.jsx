
// 全局 Provider：统一注入 wagmi 与 React Query。
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// wagmi 配置（包含链、transport、连接器等）
import { config } from "../components/Web3/config";

// import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
// 创建全局 QueryClient，用于缓存链上读数据
const queryClient = new QueryClient();
export default function Provider({ children }) {
  return (
    // wagmi Provider 提供钱包连接与链交互能力
    <WagmiProvider config={config}>
      {/* React Query Provider 负责请求缓存与状态管理 */}
      <QueryClientProvider client={queryClient}>
        {/* <RainbowKitProvider> */}
          {children}
        {/* </RainbowKitProvider> */}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
