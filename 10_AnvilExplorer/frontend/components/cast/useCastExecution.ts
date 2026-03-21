"use client";

import { useState } from "react";
import { toResultString } from "@/lib/cast-utils";

/**
 * Cast 执行 Hook：
 * - 管理每个模块的输出与加载态；
 * - 提供在线调用与离线执行统一入口。
 */
export function useCastExecution() {
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  /**
   * 格式化 Chain ID 展示：
   * - 输入如 `0x7a69`；
   * - 输出 `0x7a69 (31337)`。
   */
  const formatChainId = (result: unknown) => {
    if (typeof result !== "string") return toResultString(result);
    const value = result.trim();
    if (!/^0x[0-9a-fA-F]+$/.test(value)) return toResultString(result);
    try {
      const decimal = BigInt(value).toString(10);
      return `${value} (${decimal})`;
    } catch {
      return toResultString(result);
    }
  };

  /**
   * 写入某个模块的输出文本。
   */
  const setOutput = (key: string, value: string) => {
    setOutputs((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * 写入某个模块的加载状态。
   */
  const setLoadingFlag = (key: string, value: boolean) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * 调用 `/api/cast` 并回写结果。
   */
  const callApi = async (key: string, payload: Record<string, unknown>) => {
    setLoadingFlag(key, true);
    try {
      const response = await fetch("/api/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.ok) {
        setOutput(key, `Error: ${data.error ?? "请求失败"}`);
      } else {
        const output = key === "chainId" ? formatChainId(data.result) : toResultString(data.result);
        setOutput(key, output);
      }
    } catch (err) {
      setOutput(key, `Error: ${err instanceof Error ? err.message : "请求失败"}`);
    } finally {
      setLoadingFlag(key, false);
    }
  };

  /**
   * 安全调用在线 API：builder 抛错也能回写错误文本。
   */
  const safeCallApi = (key: string, builder: () => Record<string, unknown>) => {
    try {
      void callApi(key, builder());
    } catch (err) {
      setOutput(key, `Error: ${err instanceof Error ? err.message : "请求失败"}`);
    }
  };

  /**
   * 执行离线计算函数并统一输出结果文本。
   */
  const handleOffline = (key: string, fn: () => unknown) => {
    try {
      const result = fn();
      setOutput(key, toResultString(result));
    } catch (err) {
      setOutput(key, `Error: ${err instanceof Error ? err.message : "操作失败"}`);
    }
  };

  return {
    outputs,
    loading,
    callApi,
    safeCallApi,
    handleOffline,
  };
}
