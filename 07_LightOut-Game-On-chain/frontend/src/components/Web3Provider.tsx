"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "@/lib/wagmi";

export const Web3Provider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // React Query：缓存链上读请求结果
  const [queryClient] = useState(() => new QueryClient());

  return (
    // 注入 wagmi 配置，提供钱包连接与合约读写能力
    <WagmiProvider config={wagmiConfig}>
      {/* 为 wagmi hooks 提供查询缓存与状态管理 */}
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
};
