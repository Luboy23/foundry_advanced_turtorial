"use client";

import { useEffect, useRef, useState } from "react";
import type { Address } from "@/types/contract-config";
import type { SchoolConfig } from "@/types/admission";
import type { AdmissionCredential } from "@/types/credential";
import type {
  ProofWorkerArtifactsReady,
  ProofStatus,
  ProofWorkerError,
  ProofWorkerProgress,
  ProofWorkerSuccess,
  SerializedProofPackage
} from "@/types/proof";

// 浏览器侧 proving hook。
// 这条链路刻意不走后端：学生的成绩凭证在本地解析，证明在本地 Worker 里生成，链上只接收最终证明。
// 该 hook 封装了“学生本地生成申请凭证”的整条浏览器侧链路。
// 之所以必须走 Worker，是因为 fullProve 会显著占用主线程，直接在 React 组件里跑会卡住整个页面。
export function useProofGenerator() {
  const workerRef = useRef<Worker | null>(null);
  const isGeneratingRef = useRef(false);
  const [status, setStatus] = useState<ProofStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("等待生成申请凭证");
  const [proofPackage, setProofPackage] = useState<SerializedProofPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Worker 生命周期跟随 hook 挂载状态，避免页面切换后后台仍持有旧任务。
    const worker = new Worker(new URL("../workers/prove.worker.ts", import.meta.url), {
      type: "module"
    });
    workerRef.current = worker;

    worker.onmessage = (
      event: MessageEvent<
        | { type: "ARTIFACTS_READY"; payload: ProofWorkerArtifactsReady }
        | { type: "PROVE_PROGRESS"; payload: ProofWorkerProgress }
        | { type: "PROVE_SUCCESS"; payload: ProofWorkerSuccess }
        | { type: "PROVE_ERROR"; payload: ProofWorkerError }
      >
    ) => {
      const message = event.data;
      if (message.type === "ARTIFACTS_READY") {
        // 如果此时已经进入正式生成阶段，就不再用预热消息覆盖当前进度条。
        if (isGeneratingRef.current) {
          return;
        }

        setProgress(message.payload.progress);
        setLabel(message.payload.label);
        setStatus("artifacts-ready");
        return;
      }

      if (message.type === "PROVE_PROGRESS") {
        setProgress(message.payload.progress);
        setLabel(message.payload.label);
        setStatus(
          message.payload.progress >= 20 && message.payload.progress < 100
            ? "generating-proof"
            : "loading-artifacts"
        );
        return;
      }

      if (message.type === "PROVE_SUCCESS") {
        isGeneratingRef.current = false;
        setIsGenerating(false);
        setStatus("proof-ready");
        setProgress(100);
        setLabel("申请凭证生成完成");
        setProofPackage(message.payload.proofPackage);
        return;
      }

      if (message.type === "PROVE_ERROR") {
        // Worker 内部失败统一映射成页面可直接展示的错误态，避免组件层理解底层 proving 细节。
        isGeneratingRef.current = false;
        setIsGenerating(false);
        setStatus("error");
        setLabel("申请凭证生成失败");
        setError(message.payload.message);
      }
    };

    // 首次挂载时先触发一次材料预加载，让真正点击“生成申请凭证”时更平滑。
    worker.postMessage({
      type: "LOAD_ARTIFACTS"
    });

    return () => {
      worker.terminate();
    };
  }, []);

  // 成功提交后或切换学校/成绩后，需要把旧生成结果彻底清空，避免学生误用上一轮材料。
  function resetProof() {
    setStatus("idle");
    setProgress(0);
    setLabel("等待生成申请凭证");
    setProofPackage(null);
    setError(null);
  }

  // 钱包或学校变化后，已经生成的证明不再可信，这里主动把它作废并给出原因。
  function invalidateProof(reason?: string) {
    if (!proofPackage) return;
    setStatus("idle");
    setProgress(0);
    setProofPackage(null);
    setLabel("账户或申请信息已变化，请重新生成申请凭证");
    setError(reason ?? null);
  }

  // 允许页面先单独触发材料预热，不必每次都等到点击生成时才开始拉取 wasm / zkey。
  function loadArtifacts() {
    setError(null);
    setStatus("loading-artifacts");
    setLabel("准备申请材料");
    workerRef.current?.postMessage({
      type: "LOAD_ARTIFACTS"
    });
  }

  // 真正开始生成申请凭证。
  // 这里不在主线程里做复杂计算，只负责重置 UI 状态并把参数发给 Worker。
  function generateProof(args: {
    credential: AdmissionCredential;
    school: SchoolConfig;
    recipientAddress: Address;
  }) {
    if (isGeneratingRef.current) {
      return;
    }

    isGeneratingRef.current = true;
    setIsGenerating(true);
    setError(null);
    setStatus("loading-artifacts");
    setProgress(0);
    setLabel("校验申请信息");
    setProofPackage(null);
    workerRef.current?.postMessage({
      type: "START_PROVE",
      payload: args
    });
  }

  return {
    status,
    progress,
    label,
    proofPackage,
    error,
    isGenerating,
    loadArtifacts,
    resetProof,
    invalidateProof,
    generateProof
  };
}
