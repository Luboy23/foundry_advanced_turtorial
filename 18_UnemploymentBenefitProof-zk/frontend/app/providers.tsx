"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { DialogProvider } from "@/components/shared/DialogProvider";

/**
 * 应用级 Provider 组合层。
 *
 * 这里统一挂载 wagmi、React Query 和全局 Dialog，避免页面层重复包裹。
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            gcTime: 5 * 60 * 1000
          }
        }
      })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <DialogProvider>{children}</DialogProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
