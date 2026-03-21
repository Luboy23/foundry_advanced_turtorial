"use client";

import { useEffect, useMemo, useState } from "react";
import type { Abi, Hex } from "viem";
import {
  decodeFunctionDataWithAbi,
  decodeLogWithAbi,
  formatDecodedValue,
} from "@/lib/decode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import HashValue from "@/components/explorer/HashValue";

const STORAGE_KEY = "anvil-explorer:custom-abi";

type ClientLog = {
  address: string;
  data: string;
  topics: string[];
};

/**
 * 解析 ABI 文本：
 * - 兼容 `[...]`；
 * - 兼容 `{ abi: [...] }`。
 */
const parseAbi = (text: string): Abi => {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) {
    return parsed as Abi;
  }
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.abi)) {
    return parsed.abi as Abi;
  }
  throw new Error("ABI 格式不正确，应为 ABI 数组或包含 abi 字段的对象");
};

/**
 * 自定义 ABI 解码器：
 * - 允许用户粘贴 ABI；
 * - 本地缓存；
 * - 解码当前交易 input 与日志。
 */
export default function CustomAbiDecoder({
  input,
  logs,
}: {
  input: string;
  logs: ClientLog[];
}) {
  const [text, setText] = useState("");
  const [abi, setAbi] = useState<Abi | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 首次加载时恢复本地缓存 ABI。
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    setText(saved);
    try {
      const parsed = parseAbi(saved);
      setAbi(parsed);
      setError(null);
    } catch (err) {
      setAbi(null);
      setError(err instanceof Error ? err.message : "无法解析 ABI");
    }
  }, []);

  // 当 ABI 或 input 变化时重算函数解码。
  const decodedFunction = useMemo(() => {
    if (!abi) return null;
    return decodeFunctionDataWithAbi(input as Hex, abi);
  }, [abi, input]);

  // 当 ABI 或日志变化时重算可解码日志列表。
  const decodedLogs = useMemo(() => {
    if (!abi) return [];
    return logs
      .map((log) => ({
        log,
        decoded: decodeLogWithAbi(
          { data: log.data as Hex, topics: log.topics as Hex[] },
          abi
        ),
      }))
      .filter((item) => item.decoded !== null);
  }, [abi, logs]);

  /**
   * 应用 ABI：解析后写入 localStorage 并刷新解码结果。
   */
  const handleApply = () => {
    try {
      const parsed = parseAbi(text);
      window.localStorage.setItem(STORAGE_KEY, text);
      setAbi(parsed);
      setError(null);
    } catch (err) {
      setAbi(null);
      setError(err instanceof Error ? err.message : "无法解析 ABI");
    }
  };

  /**
   * 清空 ABI 缓存与当前解码状态。
   */
  const handleClear = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setText("");
    setAbi(null);
    setError(null);
  };

  return (
    <Card className="data-shell gap-4 py-4">
      <CardHeader className="px-4 md:px-5">
        <p className="section-kicker">Custom ABI Toolkit</p>
        <CardTitle className="font-display text-lg text-slate-900">自定义 ABI 解码</CardTitle>
        <CardDescription className="text-slate-600">
          粘贴 ABI 后可尝试解码 Input 与日志（本地保存）。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 md:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={handleApply}
            className="border border-zinc-700/55 bg-gradient-to-r from-zinc-900 to-zinc-700 text-white hover:from-zinc-800 hover:to-zinc-600"
          >
            应用 ABI
          </Button>
          <Button type="button" variant="outline" onClick={handleClear} className="border-white/80 bg-white/85">
            清除缓存
          </Button>
        </div>

        <Textarea
          rows={8}
          placeholder='支持粘贴 ABI 数组或 { "abi": [...] }'
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="border-white/75 bg-white/85 font-mono text-xs"
        />

        {error ? <div className="notice">{error}</div> : null}

        {abi && decodedFunction ? (
          <div className="rounded-xl border border-white/70 bg-white/75 p-3">
            <p className="mb-2 text-sm font-medium">方法解析</p>
            <div className="space-y-1">
              <Badge variant="outline" className="border-zinc-300 bg-zinc-100 text-zinc-700">
                {decodedFunction.functionName}
              </Badge>
              <pre className="code-block">
                {formatDecodedValue(decodedFunction.args)}
              </pre>
            </div>
          </div>
        ) : null}

        {abi && decodedLogs.length > 0 ? (
          <div className="space-y-2 rounded-xl border border-white/70 bg-white/75 p-3">
            <p className="text-sm font-medium">日志解析</p>
            {decodedLogs.map((item, index) => (
              <div
                key={`${item.decoded?.eventName}-${index}`}
                className="rounded-lg border border-white/75 bg-white/90 p-2"
              >
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="outline" className="border-zinc-300 bg-zinc-100 text-zinc-700">
                    {item.decoded?.eventName}
                  </Badge>
                </div>
                <HashValue value={item.log.address} short={false} />
                <pre className="code-block mt-2">
                  {formatDecodedValue(item.decoded?.args)}
                </pre>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
