"use client";

import { PropsWithChildren } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";

// React Query 客户端：缓存链上读请求结果
const queryClient = new QueryClient();

export function Web3Provider({ children }: PropsWithChildren) {
  return (
    // 注入 wagmi 配置，提供钱包连接与合约读写能力
    <WagmiProvider config={wagmiConfig}>
      {/* 为 wagmi hooks 提供查询缓存与状态管理 */}
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
