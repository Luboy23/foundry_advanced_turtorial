"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { formatTimestamp, shortAddress } from "@/lib/format";

export type MintFlowDialogMode = "loading" | "success" | "error";

export type MintFlowLoadingInfo = {
  stageText?: string | null;
  imageDone: number;
  imageTotal: number;
  metaDone: number;
  metaTotal: number;
  chainStatusText: string;
  txHash?: `0x${string}`;
  canCancelUpload?: boolean;
  isCancelling?: boolean;
};

export type MintFlowResult = {
  txHash?: `0x${string}`;
  mintCount: number;
  tokenIds: string[];
  tokenUris: string[];
  requester?: string;
  chainLabel: string;
  completedAt: number;
  durationMs: number;
  error?: string;
  tokenIdNote?: string;
};

export const MintFlowDialog = ({
  open,
  mode,
  loadingInfo,
  result,
  onClose,
  onCancelUpload
}: {
  open: boolean;
  mode: MintFlowDialogMode;
  loadingInfo?: MintFlowLoadingInfo;
  result?: MintFlowResult | null;
  onClose: () => void;
  onCancelUpload?: () => void;
}) => {
  const [copied, setCopied] = useState<string | null>(null);
  const mounted = typeof document !== "undefined";

  if (!open || !mounted) return null;

  const copyText = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => {
        setCopied((prev) => (prev === key ? null : prev));
      }, 1500);
    } catch (error) {
      setCopied(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        {mode === "loading" ? (
          <div className="u-stack-4">
            <div className="flex items-center u-gap-3">
              <span className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500" />
              <div>
                <p className="u-text-mini font-semibold uppercase tracking-[0.28em] text-slate-400">
                  铸造处理中
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  正在执行铸造流程
                </h3>
              </div>
            </div>
            <div className="u-stack-2 rounded-xl bg-slate-50/70 p-3">
              <p className="u-text-meta text-slate-600">
                图片上传 {loadingInfo?.imageTotal ? `${loadingInfo.imageDone}/${loadingInfo.imageTotal}` : "—"}
              </p>
              <p className="u-text-meta text-slate-600">
                元数据上传 {loadingInfo?.metaTotal ? `${loadingInfo.metaDone}/${loadingInfo.metaTotal}` : "—"}
              </p>
              <p className="u-text-meta text-slate-600">
                链上确认 {loadingInfo?.chainStatusText ?? "未开始"}
              </p>
              {loadingInfo?.stageText ? (
                <p className="u-text-meta font-semibold text-slate-700">
                  {loadingInfo.stageText}
                </p>
              ) : null}
              {loadingInfo?.txHash ? (
                <p className="u-text-meta text-slate-500">
                  交易哈希 {shortAddress(loadingInfo.txHash)}
                </p>
              ) : null}
            </div>
            {loadingInfo?.canCancelUpload ? (
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onCancelUpload}
                  disabled={!onCancelUpload || loadingInfo.isCancelling}
                  className="u-text-mini h-8 rounded-full px-4"
                >
                  {loadingInfo.isCancelling ? "正在取消" : "取消上传"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "success" && result ? (
          <div className="u-stack-4">
            <div>
              <p className="u-text-mini font-semibold uppercase tracking-[0.28em] text-rose-400">
                铸造成功
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">
                本次铸造已完成
              </h3>
            </div>
            <div className="u-stack-2 rounded-xl bg-slate-50/70 p-3">
              <p className="u-text-meta text-slate-700">铸造数量 {result.mintCount}</p>
              <p className="u-text-meta text-slate-700">发起地址 {shortAddress(result.requester)}</p>
              <p className="u-text-meta text-slate-700">网络 {result.chainLabel}</p>
              <p className="u-text-meta text-slate-700">完成时间 {formatTimestamp(result.completedAt)}</p>
              <p className="u-text-meta text-slate-700">
                耗时 {(result.durationMs / 1000).toFixed(2)} 秒
              </p>
              {result.txHash ? (
                <div className="flex items-center justify-between u-gap-2">
                  <p className="u-text-meta truncate text-slate-700">
                    交易哈希 {shortAddress(result.txHash)}
                  </p>
                  <button
                    type="button"
                    onClick={() => copyText(result.txHash as string, "hash")}
                    className="u-text-mini rounded-full border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {copied === "hash" ? "已复制" : "复制"}
                  </button>
                </div>
              ) : null}
              <div className="u-stack-1">
                <p className="u-text-meta font-semibold text-slate-700">Token ID</p>
                {result.tokenIds.length > 0 ? (
                  <p className="u-text-meta text-slate-600">{result.tokenIds.join(", ")}</p>
                ) : (
                  <p className="u-text-meta text-slate-500">
                    {result.tokenIdNote ?? "解析失败/无"}
                  </p>
                )}
              </div>
              {result.tokenUris.length > 0 ? (
                <div className="u-stack-1">
                  <p className="u-text-meta font-semibold text-slate-700">TokenURI</p>
                  <ul className="u-stack-1">
                    {result.tokenUris.map((uri, index) => (
                      <li key={`${uri}-${index}`} className="u-text-meta truncate text-slate-600" title={uri}>
                        {uri}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={onClose}>
                完成
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "error" && result ? (
          <div className="u-stack-4">
            <div>
              <p className="u-text-mini font-semibold uppercase tracking-[0.28em] text-rose-500">
                铸造失败
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">
                本次流程未完成
              </h3>
            </div>
            <div className="u-stack-2 rounded-xl bg-rose-50/80 p-3">
              <p className="u-text-meta font-semibold text-rose-700">
                {result.error ?? "流程失败"}
              </p>
              <p className="u-text-meta text-rose-700">铸造数量 {result.mintCount}</p>
              <p className="u-text-meta text-rose-700">网络 {result.chainLabel}</p>
              <p className="u-text-meta text-rose-700">完成时间 {formatTimestamp(result.completedAt)}</p>
              {result.txHash ? (
                <p className="u-text-meta text-rose-700">
                  交易哈希 {shortAddress(result.txHash)}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={onClose}>
                关闭
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
};
