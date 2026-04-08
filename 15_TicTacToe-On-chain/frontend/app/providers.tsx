"use client";

import { ReactNode, useEffect, useState } from "react";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { getAppConfig, initializeAppConfig } from "@/components/web3/config";
import { Toaster } from "@/components/ui/sonner";

// React Query 全局实例：用于 wagmi/rainbowkit 相关请求缓存。
const queryClient = new QueryClient();

interface ProvidersProps {
  children: ReactNode;
}

// 全局 Provider 组合：先加载运行时配置，再注入钱包与消息能力。
export default function Providers({ children }: ProvidersProps) {
  const [appConfig, setAppConfig] = useState<ReturnType<typeof getAppConfig> | null>(
    null
  );

  useEffect(() => {
    let active = true;

    // 页面启动阶段先锁定 runtime config，再创建 wagmi config。
    void initializeAppConfig().then((nextConfig) => {
      if (active) {
        setAppConfig(nextConfig);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (!appConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        正在加载链上配置...
      </div>
    );
  }

  return (
    <WagmiProvider config={appConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
          <Toaster richColors position="top-center" />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
