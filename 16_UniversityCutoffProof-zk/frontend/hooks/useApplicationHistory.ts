"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  applicationApprovedEvent,
  applicationRejectedEvent,
  applicationSubmittedEvent,
  getStudentApplicationRecord
} from "@/lib/contracts/university-admission-verifier";
import { useReadClient } from "@/hooks/useReadClient";
import { mergeApplicationHistory } from "@/lib/history/history-merge";
import { readLocalFailureHistory } from "@/lib/history/local-failures";
import type { Address, ContractConfig } from "@/types/contract-config";
import type {
  ApplicationHistoryRecord,
  LocalFailureHistoryItem,
  OnchainApplicationRecord,
  StudentApplicationSummary
} from "@/types/history";
import type { SchoolRuleVersion } from "@/types/admission";

// 日志查询失败时统一回退为空数组。
// 申请历史主真相来自链上结构化读取，日志在这里主要用于补交易哈希和时间线细节。
async function safeGetLogs<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

// 聚合当前钱包地址的申请历史。
// hook 内部仍会生成一份合并结果，方便兼容已有调用方；
// 但对学生工作台主 UI，会显式拆成“链上申请记录”和“本地阻断记录”两个分区数据源。
export function useApplicationHistory(args: {
  walletAddress?: Address;
  config: ContractConfig;
  versionsBySchoolId: Map<string, SchoolRuleVersion>;
  enabled?: boolean;
}) {
  const { walletAddress, config, versionsBySchoolId, enabled = true } = args;
  const readClientState = useReadClient(config);
  const publicClient = readClientState.client;

  const localFailures = useMemo<LocalFailureHistoryItem[]>(
    () => (walletAddress ? readLocalFailureHistory(walletAddress, config) : []),
    [config, walletAddress]
  );

  const onchainStateQuery = useQuery({
    queryKey: [
      "application-history",
      walletAddress,
      config.universityAdmissionVerifierAddress,
      readClientState.sourceKey
    ],
    enabled: Boolean(enabled && walletAddress && readClientState.isReady && publicClient),
    queryFn: async () => {
      // 当前版本采用“首次提交即永久锁定”，因此一个学生在链上只会有一条主申请记录。
      const studentApplication = await getStudentApplicationRecord(
        publicClient!,
        config.universityAdmissionVerifierAddress,
        walletAddress!
      );

      if (!studentApplication.exists || !studentApplication.application) {
        return {
          applications: [] as OnchainApplicationRecord[]
        };
      }

      const application = studentApplication.application;
      const [submittedLogs, approvedLogs, rejectedLogs] = await Promise.all([
        safeGetLogs(() =>
          publicClient!.getLogs({
            address: config.universityAdmissionVerifierAddress,
            event: applicationSubmittedEvent,
            args: {
              schoolId: application.schoolId,
              applicant: walletAddress!
            },
            fromBlock: 0n
          })
        ),
        safeGetLogs(() =>
          publicClient!.getLogs({
            address: config.universityAdmissionVerifierAddress,
            event: applicationApprovedEvent,
            args: {
              schoolId: application.schoolId,
              applicant: walletAddress!
            },
            fromBlock: 0n
          })
        ),
        safeGetLogs(() =>
          publicClient!.getLogs({
            address: config.universityAdmissionVerifierAddress,
            event: applicationRejectedEvent,
            args: {
              schoolId: application.schoolId,
              applicant: walletAddress!
            },
            fromBlock: 0n
          })
        )
      ]);

      const latestSubmittedLog =
        submittedLogs.sort((left, right) => Number(right.blockNumber! - left.blockNumber!))[0] ?? null;
      const latestApprovedLog =
        approvedLogs.sort((left, right) => Number(right.blockNumber! - left.blockNumber!))[0] ?? null;
      const latestRejectedLog =
        rejectedLogs.sort((left, right) => Number(right.blockNumber! - left.blockNumber!))[0] ?? null;

      const record: OnchainApplicationRecord = {
        schoolId: application.schoolId,
        applicant: application.applicant,
        nullifierHash: application.nullifierHash,
        submittedAt: application.submittedAt * 1000,
        submittedTxHash: latestSubmittedLog?.transactionHash,
        submittedBlockNumber: latestSubmittedLog?.blockNumber,
        status:
          application.status === 3
            ? "APPROVED"
            : application.status === 2
              ? "REJECTED"
              : "PENDING",
        decidedAt: application.decidedAt ? application.decidedAt * 1000 : undefined,
        decisionTxHash: latestApprovedLog?.transactionHash ?? latestRejectedLog?.transactionHash,
        decisionBlockNumber: latestApprovedLog?.blockNumber ?? latestRejectedLog?.blockNumber
      };

      return {
        applications: [record]
      };
    }
  });

  // 统一把 query 的 undefined 收敛成空数组，方便后续 merge 保持纯函数结构。
  const applications = useMemo(
    () => onchainStateQuery.data?.applications ?? [],
    [onchainStateQuery.data?.applications]
  );

  // mergeApplicationHistory 负责把“链上待审批/已拒绝/已录取”和“后端托管的未达线辅助记录”整合到同一条时间线上。
  const records = useMemo<ApplicationHistoryRecord[]>(() => {
    return mergeApplicationHistory({
      applications,
      localFailures,
      versionsBySchoolId
    });
  }, [applications, localFailures, versionsBySchoolId]);

  const onchainRecords = useMemo(
    () => records.filter((record) => record.source === "onchain"),
    [records]
  );

  const localBlockedRecords = useMemo(
    () => records.filter((record) => record.source === "auxiliary"),
    [records]
  );

  // 学生页和申请页都需要一个“当前主申请摘要”，用于锁定按钮和顶部状态卡。
  const currentApplication = useMemo<StudentApplicationSummary | null>(() => {
    const application = applications[0] ?? null;
    if (!application) {
      return null;
    }

    const version = versionsBySchoolId.get(application.schoolId.toLowerCase());
    return {
      schoolId: application.schoolId,
      schoolName: version?.schoolName ?? application.schoolId,
      versionId: version?.versionId ?? "unknown",
      versionNumber: version?.versionNumber ?? null,
      status: application.status,
      submittedAt: application.submittedAt,
      decidedAt: application.decidedAt,
      submittedTxHash: application.submittedTxHash,
      decisionTxHash: application.decisionTxHash
    };
  }, [applications, versionsBySchoolId]);

  return {
    records,
    onchainRecords,
    localBlockedRecords,
    applications,
    currentApplication,
    localFailures,
    isLoading:
      Boolean(onchainStateQuery.isLoading) ||
      Boolean(enabled && walletAddress && !readClientState.isReady && !readClientState.isWrongChain),
    isError: onchainStateQuery.isError,
    error: onchainStateQuery.error,
    readSourceKey: readClientState.sourceKey
  };
}
