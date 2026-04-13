"use client";

import Link from "next/link";
import { Suspense, useEffect, useEffectEvent, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { ApplicationActionPanel } from "@/components/student/ApplicationActionPanel";
import { ApplicationVersionSummary } from "@/components/student/ApplicationVersionSummary";
import { RoleGate } from "@/components/shared/RoleGate";
import { ChainGuardNotice } from "@/components/wallet/ChainGuardNotice";
import { ErrorState, InfoNotice } from "@/components/shared/StatePanels";
import {
  getApplicationGuardReason,
  getHistoryReadGuardReason,
  getRuleReadGuardReason,
  isEligibleForApplication
} from "@/lib/admission/eligibility";
import { createStudentAuxiliaryRecord } from "@/lib/api/student";
import { waitForStudentWorkbench, waitForUniversityWorkbench } from "@/lib/workbench-sync";
import { useChainConsistency } from "@/hooks/useChainConsistency";
import { useCredentialParser } from "@/hooks/useCredentialParser";
import { useDialogAction } from "@/hooks/useDialogAction";
import { useProofGenerator } from "@/hooks/useProofGenerator";
import { useProofSubmit } from "@/hooks/useProofSubmit";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useStudentWorkbench } from "@/hooks/useStudentWorkbench";
import { useStudentApplyWorkflowState } from "@/hooks/useStudentApplyWorkflowState";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import type { SchoolConfig, SchoolRuleVersion } from "@/types/admission";
import { toReadableError } from "@/lib/utils";

// 学生申请页主逻辑。
// 这页把“资格判断、浏览器 proving、链上提交、投影追平”四段链路串在一起，
// 目的是确保学生看到的禁用原因和最终可提交状态始终来自同一套 workbench 真相。
function StudentApplyPageContent() {
  const searchParams = useSearchParams();
  const schoolFamily = searchParams.get("school");
  const versionId = searchParams.get("version");
  const { config, isConfigured } = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const chainConsistency = useChainConsistency({
    config,
    enabled: wallet.isConnected && !wallet.wrongChain && isConfigured
  });
  const queryClient = useQueryClient();
  const failureRecordRef = useRef<string | null>(null);
  const runDialogAction = useDialogAction();

  const { credential, error: credentialError, isParsing } = useCredentialParser(config);
  const proofGenerator = useProofGenerator();
  const proofSubmit = useProofSubmit(config);
  const workbench = useStudentWorkbench({
    walletAddress: wallet.address,
    enabled: wallet.isConnected && isConfigured
  });

  // 申请页只允许从学生工作台已经暴露出来的规则中选目标学校，
  // 不再自行扫描链上规则，避免首页和申请页出现两套资格判断。
  const targetVersion = useMemo(() => {
    if (!schoolFamily || !versionId) return null;
    if (schoolFamily === "pku") {
      return (
        workbench.groupedVersions.pku.find(
          (version: SchoolRuleVersion) => version.versionId === versionId
        ) ?? null
      );
    }
    if (schoolFamily === "jiatingdun") {
      return (
        workbench.groupedVersions.jiatingdun.find(
          (version: SchoolRuleVersion) => version.versionId === versionId
        ) ?? null
      );
    }
    return null;
  }, [schoolFamily, versionId, workbench.groupedVersions]);

  const schoolConfigForProof = useMemo<SchoolConfig | null>(() => {
    if (!targetVersion) return null;
    return {
      schoolId: targetVersion.schoolId,
      universityKey: targetVersion.universityKey,
      schoolName: targetVersion.schoolName,
      scoreSourceId: targetVersion.scoreSourceId,
      cutoffScore: targetVersion.cutoffScore,
      updatedAt: targetVersion.updatedAt,
      admin: targetVersion.admin,
      active: targetVersion.active,
      cutoffFrozen: targetVersion.cutoffFrozen
    };
  }, [targetVersion]);

  const syncCredentialState = useEffectEvent(() => {
    proofGenerator.resetProof();
    proofSubmit.reset();
  });

  const invalidateStaleProof = useEffectEvent(() => {
    if (!proofGenerator.proofPackage || !wallet.address) return;
    if (proofGenerator.proofPackage.recipient.toLowerCase() === wallet.address.toLowerCase()) return;
    proofGenerator.invalidateProof("钱包地址已变化，之前生成的资格证明已失效。");
    proofSubmit.reset();
  });

  const invalidateSubmittedProof = useEffectEvent(() => {
    if (!proofGenerator.proofPackage || !workbench.currentApplication) return;
    proofGenerator.invalidateProof("申请已提交，当前账户申请资格已锁定。");
  });

  const invalidateNoLongerEligibleProof = useEffectEvent(() => {
    if (!proofGenerator.proofPackage || !generateDisabledReason || workbench.currentApplication) return;
    proofGenerator.invalidateProof(generateDisabledReason);
    proofSubmit.reset();
  });

  useEffect(() => {
    syncCredentialState();
  }, [credential]);

  useEffect(() => {
    invalidateStaleProof();
  }, [wallet.address, proofGenerator.proofPackage]);

  useEffect(() => {
    invalidateSubmittedProof();
  }, [workbench.currentApplication, proofGenerator.proofPackage]);

  const eligible = isEligibleForApplication(credential, targetVersion);
  const scoreSourceMismatch =
    workbench.latestActiveSource && credential && targetVersion
      ? workbench.latestActiveSource.scoreSourceId.toLowerCase() !==
          targetVersion.scoreSourceId.toLowerCase() ||
        BigInt(workbench.latestActiveSource.merkleRoot) !== BigInt(credential.merkleRoot)
      : false;

  useEffect(() => {
    if (!wallet.address || !credential || !targetVersion || eligible) {
      return;
    }

    const dedupeKey = `${wallet.address}:${targetVersion.schoolId}:${credential.score}:${targetVersion.cutoffScore}:${targetVersion.versionId}`;
    if (failureRecordRef.current === dedupeKey) {
      return;
    }

    // 未达线阻断仍然会留下一条辅助记录，方便学生回看“为什么当时不能申请”。
    // 但这条记录不参与任何锁定和可申请判断，只是教学辅助信息。
    failureRecordRef.current = dedupeKey;
    void createStudentAuxiliaryRecord(wallet.address, {
      schoolId: targetVersion.schoolId,
      schoolName: targetVersion.schoolName,
      status: "LOCAL_BLOCKED",
      message: `${credential.score} 分未达到 ${targetVersion.schoolName} 当前录取线 ${targetVersion.cutoffScore} 分。`,
      versionId: targetVersion.versionId
    }).then(() => queryClient.invalidateQueries({ queryKey: ["student-workbench", wallet.address] }));
  }, [credential, eligible, queryClient, targetVersion, wallet.address]);

  const historyReadGuardReason = getHistoryReadGuardReason({
    configured: isConfigured,
    connected: wallet.isConnected,
    wrongChain: wallet.wrongChain,
    isLoading: workbench.isLoading,
    isError: workbench.isError
  });
  const ruleReadGuardReason = getRuleReadGuardReason({
    configured: isConfigured,
    connected: wallet.isConnected,
    wrongChain: wallet.wrongChain,
    isLoading: workbench.isLoading,
    isError: workbench.isError
  });
  const publishedSourceGuardReason =
    !isConfigured || !wallet.isConnected || wallet.wrongChain
      ? null
      : workbench.isLoading
        ? "正在读取本届成绩，请稍候。"
        : workbench.isError
          ? "当前无法确认考试院是否已经发布本届成绩，已阻止继续申请。"
          : !workbench.latestActiveSource
            ? "考试院尚未发布本届成绩，暂时不能申请。"
            : null;

  const chainConsistencyGuardReason =
    !isConfigured || !wallet.isConnected || wallet.wrongChain
      ? null
      : chainConsistency.isChecking
        ? "正在校验当前钱包连接的本地链，请稍候。"
        : chainConsistency.isError || !chainConsistency.isConsistent
          ? chainConsistency.message
          : null;

  const generateDisabledReason = getApplicationGuardReason({
    configured: isConfigured,
    connected: wallet.isConnected,
    wrongChain: wallet.wrongChain,
    credential,
    version: targetVersion,
    merkleRootMatches: !scoreSourceMismatch,
    currentApplication: workbench.currentApplication
  });

  const workflow = useStudentApplyWorkflowState({
    chainConsistencyGuardReason,
    publishedSourceGuardReason,
    ruleReadGuardReason,
    historyReadGuardReason,
    generateDisabledReason
  });
  const resolvedGenerateDisabledReason = workflow.resolvedGenerateDisabledReason;
  const resolvedSubmitDisabledReason = workflow.resolvedSubmitDisabledReason;

  useEffect(() => {
    invalidateNoLongerEligibleProof();
  }, [generateDisabledReason, workbench.currentApplication, proofGenerator.proofPackage]);

  // 生成证明仍然完全发生在浏览器 Worker 内。
  // 后端和链上都只认最终 proof/package，不接手 fullProve 的计算过程。
  async function handleGenerate() {
    if (
      !credential ||
      !wallet.address ||
      !schoolConfigForProof ||
      chainConsistency.isChecking ||
      chainConsistency.isError ||
      !chainConsistency.isConsistent ||
      workbench.isLoading ||
      workbench.isError ||
      !workbench.latestActiveSource ||
      workbench.currentApplication ||
      resolvedGenerateDisabledReason
    ) {
      return;
    }

    proofSubmit.reset();
    proofGenerator.generateProof({
      credential,
      school: schoolConfigForProof,
      recipientAddress: wallet.address
    });
  }

  // 提交申请的完成条件不是“拿到 receipt 就结束”，
  // 而是“链上成功 + 学生/大学两侧 workbench 都追平到待审批状态”。
  async function handleSubmit() {
    if (
      !targetVersion ||
      !proofGenerator.proofPackage ||
      chainConsistency.isChecking ||
      chainConsistency.isError ||
      !chainConsistency.isConsistent ||
      workbench.isLoading ||
      workbench.isError ||
      !workbench.latestActiveSource ||
      workbench.currentApplication ||
      resolvedSubmitDisabledReason
    ) {
      return;
    }

    const proofPackage = proofGenerator.proofPackage;
    const walletAddress = wallet.address;

    if (!walletAddress) {
      return;
    }

    await runDialogAction({
      confirm: {
        title: "确认提交申请",
        description: `提交后，你将正式向 ${targetVersion.schoolName} 发起申请，并进入大学审批流程。`,
        details: `学校：${targetVersion.schoolName}\n规则轮次：第 ${targetVersion.versionNumber} 轮\n录取线：${targetVersion.cutoffScore} 分\n说明：提交后当前账户的申请资格会锁定。`
      },
      progress: {
        title: "正在提交申请",
        description: "系统正在发送交易并等待链上确认，同时同步工作台状态，请稍候。"
      },
      success: (hash) => ({
        title: "申请提交成功",
        description: `你已向 ${targetVersion.schoolName} 提交申请，接下来请等待大学审批。`,
        details: `交易哈希：${hash}`
      }),
      error: (error) => ({
        title: "申请提交失败",
        description: "本次申请没有写入链上状态，请稍后重试。",
        details: toReadableError(error, "提交申请失败。")
      }),
      run: async () => {
        const hash = await proofSubmit.submitProof(proofPackage);
        // 先确认学生自己已经在后端 workbench 里看到当前主申请，
        // 再确认大学待审批列表已经同步到同一条申请，避免切页时仍看到旧状态。
        await waitForStudentWorkbench({
          queryClient,
          walletAddress,
          timeoutMessage: "链上交易已经确认，但学生工作台中的申请状态尚未同步，请稍后刷新页面确认。",
          predicate: (data) =>
            Boolean(
              data.currentApplication &&
                data.currentApplication.schoolId.toLowerCase() ===
                  proofPackage.schoolIdBytes32.toLowerCase() &&
                data.currentApplication.status === "PENDING"
            )
        });
        await waitForUniversityWorkbench({
          queryClient,
          familyKey: targetVersion.familyKey,
          timeoutMessage: "链上交易已经确认，但大学工作台中的待审批列表尚未同步，请稍后刷新页面确认。",
          predicate: (data) =>
            Boolean(
              data.applications.find(
                (item) =>
                  item.schoolId.toLowerCase() === proofPackage.schoolIdBytes32.toLowerCase() &&
                  item.applicant.toLowerCase() === walletAddress.toLowerCase() &&
                  item.status === "PENDING"
              )
            )
        });
        await queryClient.invalidateQueries({ queryKey: ["student-workbench", walletAddress] });
        await queryClient.invalidateQueries({ queryKey: ["university-workbench"] });
        return hash;
      }
    });
  }

  if (!schoolFamily || !versionId) {
    return <ErrorState title="缺少申请信息" description="请从学生工作台选择学校后再进入申请页。" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/student" className="inline-flex items-center gap-2 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          返回学生工作台
        </Link>
      </div>

      <ApplicationVersionSummary credential={credential} version={targetVersion} />

      {wallet.wrongChain ? (
        <ChainGuardNotice
          expectedChainId={config.chainId}
          onSwitch={wallet.switchToExpectedChain}
          switching={wallet.isSwitching}
        />
      ) : null}

      {targetVersion && (!targetVersion.active || !targetVersion.cutoffFrozen) ? (
        <InfoNotice
          title="当前暂不能申请"
          description="只有处于开放状态的申请规则，才能继续提交申请。"
          tone="warning"
        />
      ) : null}

      {!credential && !credentialError && !isParsing ? (
        <InfoNotice
          title="请先导入成绩凭证"
          description="请先回到学生工作台，导入考试院发放的成绩凭证后，再继续生成申请凭证。"
          tone="warning"
        />
      ) : null}

      {!workbench.isLoading && !workbench.isError && !workbench.latestActiveSource ? (
        <InfoNotice
          title="考试院尚未发布本届成绩"
          description="请先等待考试院发布本届成绩源，之后大学和学生才能继续后面的申请流程。"
          tone="warning"
        />
      ) : null}

      {!workbench.isLoading && !workbench.isError && !targetVersion ? (
        <InfoNotice
          title="当前规则暂不可用"
          description="该学校这一轮申请规则还没有准备好，请回到学生工作台重新选择。"
          tone="warning"
        />
      ) : null}

      {workbench.currentApplication ? (
        <InfoNotice
          title="当前账户申请资格已锁定"
          description={
            workbench.currentApplication.schoolId.toLowerCase() === targetVersion?.schoolId.toLowerCase()
              ? workbench.currentApplication.status === "APPROVED"
                ? `你已被 ${workbench.currentApplication.schoolName} 录取，无需再次申请。`
                : workbench.currentApplication.status === "REJECTED"
                  ? `你向 ${workbench.currentApplication.schoolName} 的申请已被拒绝，但当前账户申请资格已永久锁定。`
                  : `你已向 ${workbench.currentApplication.schoolName} 提交申请，正在等待大学审批。`
              : workbench.currentApplication.status === "APPROVED"
                ? `你已被 ${workbench.currentApplication.schoolName} 录取，当前不能再申请其他学校。`
                : workbench.currentApplication.status === "REJECTED"
                  ? `你向 ${workbench.currentApplication.schoolName} 的申请已被拒绝，但当前账户申请资格已永久锁定。`
                  : `你已向 ${workbench.currentApplication.schoolName} 提交申请，当前不能再申请其他学校。`
          }
          tone={workbench.currentApplication.status === "APPROVED" ? "success" : "warning"}
        />
      ) : null}

      {credentialError ? <ErrorState title="凭证读取失败" description={credentialError} /> : null}
      {chainConsistencyGuardReason && (chainConsistency.isError || !chainConsistency.isConsistent) ? (
        <ErrorState title="本地链连接异常" description={chainConsistencyGuardReason} />
      ) : null}
      {publishedSourceGuardReason && workbench.isError ? (
        <ErrorState title="本届成绩读取失败" description={publishedSourceGuardReason} />
      ) : null}
      {ruleReadGuardReason && workbench.isError ? (
        <ErrorState title="申请规则读取失败" description={ruleReadGuardReason} />
      ) : null}
      {historyReadGuardReason && workbench.isError ? (
        <ErrorState title="申请状态读取失败" description={historyReadGuardReason} />
      ) : null}

      <ApplicationActionPanel
        walletAddress={wallet.address}
        connectWallet={wallet.connectWallet}
        disconnectWallet={wallet.disconnectWallet}
        connecting={wallet.isConnecting}
        connected={wallet.isConnected}
        wrongChain={wallet.wrongChain}
        switchChain={wallet.switchToExpectedChain}
        switching={wallet.isSwitching}
        canGenerate={!resolvedGenerateDisabledReason}
        generateDisabledReason={resolvedGenerateDisabledReason}
        onGenerate={handleGenerate}
        proofStatus={proofGenerator.status}
        proofLabel={proofGenerator.label}
        proofProgress={proofGenerator.progress}
        proofError={proofGenerator.error}
        proofPackage={proofGenerator.proofPackage}
        isGenerating={proofGenerator.isGenerating}
        onSubmit={handleSubmit}
        canSubmit={!resolvedSubmitDisabledReason}
        submitDisabledReason={resolvedSubmitDisabledReason}
        submitStatus={proofSubmit.status}
      />
    </div>
  );
}

function StudentApplyPageContentWithSuspense() {
  return (
    <Suspense fallback={<InfoNotice title="正在加载申请信息" description="请稍候..." />}>
      <StudentApplyPageContent />
    </Suspense>
  );
}

export default function StudentApplyPageClient() {
  return <RoleGate expectedRole="student">{() => <StudentApplyPageContentWithSuspense />}</RoleGate>;
}
