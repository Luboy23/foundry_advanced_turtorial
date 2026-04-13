"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { universityAdmissionVerifierAbi } from "@/lib/contracts/university-admission-verifier";
import { useReadClient } from "@/hooks/useReadClient";
import { assertSuccessfulTransactionReceipt } from "@/lib/blockchain/tx-receipt";
import { hasConfiguredContracts } from "@/lib/runtime-config";
import type { Address, ContractConfig } from "@/types/contract-config";

type ReviewActionKey = `${"approve" | "reject"}:${string}:${string}`;

export function useApplicationReviewActions(config: ContractConfig) {
  const [pendingKey, setPendingKey] = useState<ReviewActionKey | null>(null);
  const readClientState = useReadClient(config);
  const publicClient = readClientState.client;
  const { writeContractAsync } = useWriteContract();

  async function reviewApplication(args: {
    action: "approve" | "reject";
    schoolId: `0x${string}`;
    applicant: Address;
  }) {
    const { action, schoolId, applicant } = args;
    if (!hasConfiguredContracts(config)) {
      throw new Error("系统配置未完成，暂时无法审批申请。");
    }
    if (!readClientState.isReady || !publicClient) {
      throw new Error("系统尚未准备好，请稍后重试。");
    }

    const key = `${action}:${schoolId}:${applicant}` as ReviewActionKey;
    if (pendingKey) {
      throw new Error("当前已有审批交易正在处理中，请等待确认完成。");
    }

    setPendingKey(key);

    try {
      const hash = await writeContractAsync({
        abi: universityAdmissionVerifierAbi,
        address: config.universityAdmissionVerifierAddress,
        functionName: action === "approve" ? "approveApplication" : "rejectApplication",
        args: [schoolId, applicant]
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assertSuccessfulTransactionReceipt(receipt, action === "approve" ? "批准申请" : "拒绝申请");
      return hash;
    } finally {
      setPendingKey(null);
    }
  }

  return {
    pendingKey,
    approveApplication(args: { schoolId: `0x${string}`; applicant: Address }) {
      return reviewApplication({ ...args, action: "approve" });
    },
    rejectApplication(args: { schoolId: `0x${string}`; applicant: Address }) {
      return reviewApplication({ ...args, action: "reject" });
    }
  };
}
