"use client";

import { useEffect, useState } from "react";
import {
  getInitialRuntimeConfig,
  getInjectedRuntimeConfig,
  hasConfiguredContracts,
  resolveRuntimeConfig
} from "@/lib/runtime-config";
import type { ContractConfig } from "@/types/contract-config";

export function useRuntimeConfig() {
  // 首屏统一使用服务端安全快照，避免 SSR 和客户端 hydration 首帧读到不同配置。
  const [config, setConfig] = useState<ContractConfig>(() => getInitialRuntimeConfig());

  useEffect(() => {
    let cancelled = false;

    async function hydrateLatestRuntimeConfig() {
      try {
        const injectedConfig = getInjectedRuntimeConfig();
        if (!cancelled) {
          setConfig((current) =>
            JSON.stringify(current) === JSON.stringify(injectedConfig) ? current : injectedConfig
          );
        }

        const response = await fetch(`/contract-config.json?ts=${Date.now()}`, {
          cache: "no-store"
        });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as Partial<ContractConfig>;
        if (cancelled) {
          return;
        }

        setConfig((current) => {
          const next = resolveRuntimeConfig(payload);
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
      } catch {
        // 保持首屏注入的运行时配置，避免配置文件短暂不可读时打断页面。
      }
    }

    void hydrateLatestRuntimeConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    config,
    isConfigured: hasConfiguredContracts(config)
  };
}
