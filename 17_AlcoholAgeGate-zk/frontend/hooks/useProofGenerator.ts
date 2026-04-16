"use client";

import { useEffect, useRef, useState } from "react";
import type { ProofPackage, ProofStatus, ProofWorkerProgress } from "@/types/proof";
import type { Address } from "@/types/contract-config";
import type { AgeCredentialSet, LocalAgeCredential } from "@/types/domain";

type ProofArtifactConfig = {
  wasmUrl: string;
  zkeyUrl: string;
  artifactVersion: string;
};

type WorkerMessage =
  | { type: "PROVE_PROGRESS"; payload: ProofWorkerProgress }
  | { type: "ARTIFACTS_READY" }
  | { type: "PROVE_SUCCESS"; payload: { proofPackage: ProofPackage } }
  | { type: "PROVE_ERROR"; payload: { message: string } };

let sharedProofWorker: Worker | null = null;
const sharedWorkerListeners = new Set<(message: WorkerMessage) => void>();

// 证明 worker 做成共享单例，是为了避免每次进入验证页都重新创建一个重型 worker。
function getSharedProofWorker() {
  if (!sharedProofWorker) {
    sharedProofWorker = new Worker(new URL("../workers/prove.worker.ts", import.meta.url), {
      type: "module"
    });
    sharedProofWorker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      for (const listener of sharedWorkerListeners) {
        listener(message);
      }
    };
  }

  return sharedProofWorker;
}

function postLoadArtifactsMessage(artifacts: ProofArtifactConfig) {
  getSharedProofWorker().postMessage({
    type: "LOAD_ARTIFACTS",
    payload: {
      wasmUrl: artifacts.wasmUrl,
      zkeyUrl: artifacts.zkeyUrl,
      artifactVersion: artifacts.artifactVersion
    }
  });
}

// 预热 proving 工件不会立刻生成 proof，
// 但可以让后续真正点击“开始验证”时少掉最重的准备阶段。
export function warmProofArtifacts(artifacts: ProofArtifactConfig) {
  postLoadArtifactsMessage(artifacts);
}

export function useProofGenerator(artifacts: ProofArtifactConfig) {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<ProofStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("等待开始验证");
  const [proofPackage, setProofPackage] = useState<ProofPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const artifactVersion = artifacts.artifactVersion;
  const wasmUrl = artifacts.wasmUrl;
  const zkeyUrl = artifacts.zkeyUrl;

  useEffect(() => {
    const worker = getSharedProofWorker();
    workerRef.current = worker;

    const handleMessage = (message: WorkerMessage) => {
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
        // 18% 是一个约定的“资料已经就绪”基线，
        // 后面的进度才真正代表这次 proving 在往前推进。
        setStatus("idle");
        setProgress(18);
        setLabel("验证资料已准备");
        setProofPackage(null);
        setError(null);
        return;
      }

      if (message.type === "PROVE_SUCCESS") {
        setStatus("proof-ready");
        setProgress(100);
        setLabel("验证资料已准备");
        setProofPackage(message.payload.proofPackage);
        return;
      }

      if (message.type === "PROVE_ERROR") {
        setStatus("error");
        setError(message.payload.message);
        setLabel("资格验证失败");
      }
    };
    sharedWorkerListeners.add(handleMessage);

    return () => {
      sharedWorkerListeners.delete(handleMessage);
    };
  }, []);

  useEffect(() => {
    postLoadArtifactsMessage({
      wasmUrl,
      zkeyUrl,
      artifactVersion
    });
  }, [artifactVersion, wasmUrl, zkeyUrl]);

  function loadArtifacts() {
    setStatus("loading-artifacts");
    setProgress(0);
    setError(null);
    setLabel("准备验证资料");
    postLoadArtifactsMessage({
      wasmUrl,
      zkeyUrl,
      artifactVersion
    });
  }

  function reset() {
    setStatus("idle");
    setProgress(0);
    setLabel("等待开始验证");
    setProofPackage(null);
    setError(null);
  }

  function generateProof(args: {
    credential: LocalAgeCredential;
    credentialSet: AgeCredentialSet;
    recipientAddress: Address;
    verificationDateYmd: number;
  }) {
    // 真正开始 proving 前先清空上一次结果，
    // 否则页面可能会把旧的 proofPackage 误认为这次还能继续提交。
    setStatus("loading-artifacts");
    setProgress(0);
    setLabel("核对账户与凭证");
    setProofPackage(null);
    setError(null);
    workerRef.current?.postMessage({
      type: "START_PROVE",
      payload: {
        ...args,
        artifacts: {
          wasmUrl,
          zkeyUrl,
          artifactVersion
        }
      }
    });
  }

  return {
    status,
    progress,
    label,
    proofPackage,
    error,
    loadArtifacts,
    reset,
    generateProof
  };
}
