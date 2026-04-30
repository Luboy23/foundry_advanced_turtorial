"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { DialogProvider } from "@/components/ui/DialogProvider";
import { AppSessionProvider } from "@/components/providers/AppSessionProvider";
import { RuntimeConfigProvider } from "@/components/providers/RuntimeConfigProvider";
import { wagmiConfig } from "@/lib/wagmi";
import type { RuntimeConfig } from "@/types/contract-config";

export function Providers({
  children,
  initialRuntimeConfig
}: {
  children: ReactNode;
  initialRuntimeConfig: RuntimeConfig;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            gcTime: 5 * 60 * 1_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: 1
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <RuntimeConfigProvider value={initialRuntimeConfig}>
          <AppSessionProvider
            demoAddresses={initialRuntimeConfig.demoAddresses}
            expectedChainId={initialRuntimeConfig.chainId}
          >
            <DialogProvider>{children}</DialogProvider>
          </AppSessionProvider>
        </RuntimeConfigProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
