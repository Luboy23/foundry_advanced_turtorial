"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_ENABLED_KEY = "anvil-explorer:refresh:enabled";
const STORAGE_INTERVAL_KEY = "anvil-explorer:refresh:interval";
const INTERVAL_OPTIONS = [4000, 8000, 15000, 30000];

/**
 * 读取默认刷新间隔配置。
 */
const getDefaultInterval = () => {
  const raw = Number(process.env.NEXT_PUBLIC_REFRESH_MS ?? "8000");
  if (!Number.isFinite(raw) || raw <= 0) return 8000;
  return raw;
};

/**
 * 自动刷新控制器：
 * - 支持开关与间隔切换；
 * - 状态持久化到 localStorage；
 * - 页面不可见时暂停计时器。
 */
export default function RefreshControl() {
  const router = useRouter();
  const defaultInterval = useMemo(getDefaultInterval, []);
  const [enabled, setEnabled] = useState(defaultInterval > 0);
  const [intervalMs, setIntervalMs] = useState(defaultInterval);

  useEffect(() => {
    // 首次挂载时读取用户上次设置。
    const storedEnabled = window.localStorage.getItem(STORAGE_ENABLED_KEY);
    const storedInterval = window.localStorage.getItem(STORAGE_INTERVAL_KEY);

    if (storedEnabled !== null) {
      setEnabled(storedEnabled === "1");
    }

    if (storedInterval !== null) {
      const parsed = Number(storedInterval);
      if (Number.isFinite(parsed) && parsed > 0) {
        setIntervalMs(parsed);
      }
    }
  }, []);

  useEffect(() => {
    // 配置变化后持久化，保证刷新策略跨刷新保留。
    window.localStorage.setItem(STORAGE_ENABLED_KEY, enabled ? "1" : "0");
    window.localStorage.setItem(STORAGE_INTERVAL_KEY, String(intervalMs));
  }, [enabled, intervalMs]);

  useEffect(() => {
    if (!enabled) return;

    let timer: number | null = null;

    // 启动定时刷新。
    const start = () => {
      if (timer !== null) return;
      timer = window.setInterval(() => {
        router.refresh();
      }, intervalMs);
    };

    // 停止定时刷新。
    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    // 页面不可见时暂停，减少后台资源消耗。
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, intervalMs, router]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/75 bg-white/80 px-2 py-1.5">
      <Button
        type="button"
        variant={enabled ? "default" : "outline"}
        size="sm"
        className={cn(
          "h-8 gap-1.5 rounded-lg px-2.5 text-xs",
          enabled
            ? "border border-zinc-700/55 bg-gradient-to-r from-zinc-900 to-zinc-700 text-white hover:from-zinc-800 hover:to-zinc-600"
            : "border-white/80 bg-white/85 text-slate-700"
        )}
        onClick={() => setEnabled((prev) => !prev)}
      >
        <RefreshCw className={cn("size-3.5", enabled ? "animate-spin" : "")} />
        {enabled ? "自动刷新中" : "自动刷新关闭"}
      </Button>
      <select
        className="h-8 rounded-lg border border-white/75 bg-white/85 px-2 text-xs text-slate-700 interactive-ring"
        value={intervalMs}
        onChange={(event) => setIntervalMs(Number(event.target.value))}
      >
        {INTERVAL_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option / 1000}s
          </option>
        ))}
      </select>
    </div>
  );
}
