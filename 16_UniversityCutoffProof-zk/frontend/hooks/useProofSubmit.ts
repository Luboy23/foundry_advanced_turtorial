"use client";

import { useRef, useState } from "react";
import { useWriteContract } from "wagmi";
import { universityAdmissionVerifierAbi } from "@/lib/contracts/university-admission-verifier";
import { useReadClient } from "@/hooks/useReadClient";
import { assertSuccessfulTransactionReceipt } from "@/lib/blockchain/tx-receipt";
import { hasConfiguredContracts } from "@/lib/runtime-config";
import { deserializeProofPackage } from "@/lib/zk/proof-package";
import type { ContractConfig } from "@/types/contract-config";
import type { SerializedProofPackage } from "@/types/proof";

type SubmitStatus = "idle" | "submitting" | "confirming" | "success" | "error";

// 学生提交申请的链上写入口。
// 这个 hook 只负责把已经生成好的 proof package 送进合约，不负责资格判断和 proving。
// 负责把已经生成好的申请凭证提交到链上，并把“发送中 / 确认中 / 成功 / 失败”统一映射成页面状态。
export function useProofSubmit(config: ContractConfig) {
  const isSubmittingRef = useRef(false);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const readClientState = useReadClient(config);
  const publicClient = readClientState.client;
  const { writeContractAsync } = useWriteContract();

  // 提交入口只接受已经整理好的 ProofPackage。
  // 这样组件层不需要了解 verifier calldata 拼装细节，只需要知道“拿到凭证后提交申请”。
  async function submitProof(proofPackage: SerializedProofPackage) {
    if (isSubmittingRef.current) {
      throw new Error("申请正在提交中，请勿重复点击。");
    }
    if (!hasConfiguredContracts(config)) {
      throw new Error("系统配置未完成，暂时无法提交申请。");
    }
    if (!readClientState.isReady || !publicClient) {
      throw new Error("系统尚未准备好，请稍后重试。");
    }

    // 进入链上提交前才把字符串安全结构恢复成 bigint 版本，
    // 这样页面状态和 React Query 缓存里不会残留不可序列化的 BigInt 对象。
    const resolvedProofPackage = deserializeProofPackage(proofPackage);
    isSubmittingRef.current = true;
    setStatus("submitting");
    setError(null);

    try {
      const hash = await writeContractAsync({
        abi: universityAdmissionVerifierAbi,
        address: config.universityAdmissionVerifierAddress,
        functionName: "submitApplication",
        args: [
          resolvedProofPackage.schoolIdBytes32,
          resolvedProofPackage.nullifierHash,
          [...resolvedProofPackage.calldata.a],
          [
            [...resolvedProofPackage.calldata.b[0]],
            [...resolvedProofPackage.calldata.b[1]]
          ],
          [...resolvedProofPackage.calldata.c]
        ]
      });

      setTxHash(hash);
      setStatus("confirming");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assertSuccessfulTransactionReceipt(receipt, "提交申请");
      setStatus("success");
      return hash;
    } catch (submitError) {
      // 这里保留原始错误继续抛出，方便调用方按需要做额外埋点或查询刷新。
      setStatus("error");
      setError(submitError instanceof Error ? submitError.message : "提交申请失败。");
      throw submitError;
    } finally {
      isSubmittingRef.current = false;
    }
  }

  // 页面切换学校、重新生成凭证或重新进入申请页时，需要显式把旧提交状态清空。
  function reset() {
    isSubmittingRef.current = false;
    setStatus("idle");
    setError(null);
    setTxHash(null);
  }

  return {
    status,
    error,
    txHash,
    submitProof,
    reset
  };
}
