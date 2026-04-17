"use client";

import { useEffect, useRef, useState } from "react";
import type { Address } from "@/types/contract-config";
import type { BenefitProgram, LocalUnemploymentCredential, UnemploymentCredentialSet } from "@/types/domain";
import type { ProofPackage, ProofStatus, ProofWorkerProgress } from "@/types/proof";

/**
 * 产证 Worker 的前端包装层。
 *
 * 页面不直接接触 Worker message 协议，而是通过这个 Hook 获得统一的状态、进度、错误和
 * `generateProof` 调用入口。
 */
type WorkerMessage =
  | { type: "PROVE_PROGRESS"; payload: ProofWorkerProgress }
  | { type: "ARTIFACTS_READY" }
  | { type: "PROVE_SUCCESS"; payload: { proofPackage: ProofPackage } }
  | { type: "PROVE_ERROR"; payload: { message: string } };

/** 管理 zk 产证流程的生命周期。 */
export function useProofGenerator() {
  const workerRef = useRef<Worker | null>(null);
  const pendingResolver = useRef<{
    resolve: (value: ProofPackage) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const [status, setStatus] = useState<ProofStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("等待提交资格核验");
  const [proofPackage, setProofPackage] = useState<ProofPackage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Worker 在组件生命周期内只创建一次；页面卸载时必须终止，避免后台继续占用内存和 CPU。
    const worker = new Worker(new URL("../workers/prove.worker.ts", import.meta.url), {
      type: "module"
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "PROVE_PROGRESS") {
        setProgress(message.payload.progress);
        setLabel(message.payload.label);
        setStatus(
          message.payload.progress >= 25 && message.payload.progress < 100
            ? "generating-proof"
            : "loading-artifacts"
        );
        return;
      }

      if (message.type === "ARTIFACTS_READY") {
        setStatus("idle");
        setProgress(18);
        setLabel("核验材料已准备");
        setError(null);
        return;
      }

      if (message.type === "PROVE_SUCCESS") {
        setStatus("proof-ready");
        setProgress(100);
        setLabel("核验材料已准备");
        setProofPackage(message.payload.proofPackage);
        pendingResolver.current?.resolve(message.payload.proofPackage);
        pendingResolver.current = null;
        return;
      }

      if (message.type === "PROVE_ERROR") {
        setStatus("error");
        setError(message.payload.message);
        setLabel("资格核验失败");
        pendingResolver.current?.reject(new Error(message.payload.message));
        pendingResolver.current = null;
      }
    };

    worker.postMessage({ type: "LOAD_ARTIFACTS" });

    return () => {
      worker.terminate();
    };
  }, []);

  /** 把产证状态机重置回初始态，供用户重新发起核验。 */
  function reset() {
    setStatus("idle");
    setProgress(0);
    setLabel("等待提交资格核验");
    setProofPackage(null);
    setError(null);
  }

  /** 请求 Worker 生成一份可直接提交给发放合约的 proof package。 */
  function generateProof(args: {
    credential: LocalUnemploymentCredential;
    credentialSet: UnemploymentCredentialSet;
    program: BenefitProgram;
    recipientAddress: Address;
  }) {
    setStatus("loading-artifacts");
    setProgress(0);
    setLabel("核对资格信息");
    setProofPackage(null);
    setError(null);

    return new Promise<ProofPackage>((resolve, reject) => {
      pendingResolver.current = { resolve, reject };
      workerRef.current?.postMessage({
        type: "START_PROVE",
        payload: args
      });
    });
  }

  return {
    status,
    progress,
    label,
    proofPackage,
    error,
    reset,
    generateProof
  };
}
