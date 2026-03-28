"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import { ChainEventIndexer } from "@/components/ChainEventIndexer";
import { wagmiConfig } from "@/lib/wagmi";

/** 全局 Provider 组合：Wagmi + React Query + 链上事件索引器。 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ChainEventIndexer />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
