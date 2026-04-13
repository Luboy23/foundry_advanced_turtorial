"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWriteContract } from "wagmi";
import { ShieldCheck } from "lucide-react";
import { AuthorityScoreSourcePanel } from "@/components/authority/AuthorityScoreSourcePanel";
import {
  AuthorityIssuanceRecordList,
  CredentialIssuancePanel
} from "@/components/authority/CredentialIssuancePanel";
import { PublishRecordList } from "@/components/authority/PublishRecordList";
import { StudentRecordImportPanel } from "@/components/authority/StudentRecordImportPanel";
import { useDialog } from "@/components/shared/DialogProvider";
import { Button } from "@/components/shared/Button";
import { RoleGate } from "@/components/shared/RoleGate";
import { ErrorState, InfoNotice } from "@/components/shared/StatePanels";
import { ChainGuardNotice } from "@/components/wallet/ChainGuardNotice";
import { assertSuccessfulTransactionReceipt } from "@/lib/blockchain/tx-receipt";
import { scoreRootRegistryAbi } from "@/lib/contracts/score-root-registry";
import { waitForAuthorityWorkbench } from "@/lib/workbench-sync";
import {
  createAuthorityDraft,
  getAuthorityDraftPreview,
  generateAuthorityDraftBatch
} from "@/lib/api/authority";
import {
  downloadJsonFile,
  parseAuthorityImportJson
} from "@/lib/credential/export";
import { useAuthorityWorkbench } from "@/hooks/useAuthorityWorkbench";
import { useBackendSession } from "@/hooks/useBackendSession";
import { DialogActionCancelledError, useDialogAction } from "@/hooks/useDialogAction";
import { useAuthorityWorkflowState } from "@/hooks/useAuthorityWorkflowState";
import { useReadClient } from "@/hooks/useReadClient";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import type { ScoreSourceDraft, SampleScoreSource } from "@/types/admission";
import type { AdmissionCredential } from "@/types/credential";
import { formatAddress, toReadableError } from "@/lib/utils";

// 考试院工作台主页面。
// 这页把“本地操作”和“链上状态”明确拆开：
// 上半部分围绕草稿、凭证和批次导出；
// 下半部分围绕成绩源发布和链上历史展示。
function AuthorityPageContent() {
  const { config, isConfigured } = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const readClientState = useReadClient(config);
  const publicClient = readClientState.client;
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const dialog = useDialog();
  const runDialogAction = useDialogAction();
  const backendSession = useBackendSession({
    walletAddress: wallet.address,
    enabled: wallet.isConnected && isConfigured && !wallet.wrongChain,
    autoSignIn: false
  });
  const workbench = useAuthorityWorkbench({
    enabled: isConfigured
  });

  const draft = workbench.draft;
  const [generatedScoreSource, setGeneratedScoreSource] = useState<SampleScoreSource | null>(null);
  const [generatedCredentials, setGeneratedCredentials] = useState<AdmissionCredential[]>([]);
  const [importing, setImporting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [draftPreviewError, setDraftPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // 只要当前草稿变化，就重新从后端拉一份预览。
    // 这一步的意义是把“已导入成绩”转换成“可发布的成绩源摘要 + 可导出的学生凭证预览”。
    async function hydrateDraft() {
      if (!draft || !workbench.draftId || !wallet.address) {
        setGeneratedScoreSource(null);
        setGeneratedCredentials([]);
        return;
      }

      try {
        const generated = await generateDraftPreview(workbench.draftId);
        if (cancelled) return;
        setGeneratedScoreSource(generated.scoreSource as SampleScoreSource);
        setGeneratedCredentials(generated.credentials as AdmissionCredential[]);
        setDraftPreviewError(null);
      } catch (error) {
        if (cancelled) return;
        setGeneratedScoreSource(null);
        setGeneratedCredentials([]);
        setDraftPreviewError(toReadableError(error, "当前无法根据导入成绩生成本地凭证预览。"));
      }
    }

    void hydrateDraft();

    return () => {
      cancelled = true;
    };
  }, [draft, wallet.address, workbench.draftId]);

  // 预览接口是 publish 按钮的直接前置条件。
  // 只有当后端能稳定生成 scoreSource 和 credentials，前端才认为“成绩数据校验已经完成”。
  async function generateDraftPreview(draftId: string) {
    const generated = await getAuthorityDraftPreview(draftId);
    setGeneratedScoreSource(generated.scoreSource as SampleScoreSource);
    setGeneratedCredentials(generated.credentials as AdmissionCredential[]);
    setDraftPreviewError(null);
    return generated;
  }

  async function refreshWorkbench() {
    await queryClient.invalidateQueries({ queryKey: ["authority-workbench"] });
    await queryClient.invalidateQueries({ queryKey: ["student-workbench"] });
    await queryClient.invalidateQueries({ queryKey: ["university-workbench"] });
  }

  // 进入考试院页面本身不需要签名；
  // 只有在导入成绩、生成批次等真正写后台记录时，才通过一次钱包签名建立 authority session。
  async function ensureAuthoritySession() {
    if (!wallet.address) {
      throw new Error("请先连接考试院钱包。");
    }
    if (backendSession.isAuthenticated) {
      return;
    }

    const confirmed = await dialog.confirm({
      title: "签名进入考试院后台",
      description: "导入成绩、生成本地批次和记录发放都需要一次钱包签名，以建立考试院后台会话。",
      confirmLabel: "继续签名"
    });
    if (!confirmed) {
      throw new DialogActionCancelledError();
    }

    const progress = dialog.showInfo({
      title: "正在请求钱包签名",
      description: "请在钱包中完成签名，以建立考试院后台会话。",
      busy: true,
      dismissible: false
    });

    try {
      await backendSession.authenticate();
      await backendSession.refetch();
    } catch (error) {
      progress.close();
      await dialog.showError({
        title: "后台会话建立失败",
        description: "这次没有成功进入考试院后台，当前操作未写入记录。",
        details: toReadableError(error, "后台会话建立失败。")
      });
      throw new DialogActionCancelledError();
    }

    progress.close();
  }

  // 把已经通过前端格式校验的成绩草稿正式写入后端。
  // 这里不直接留在浏览器本地，是为了让刷新页面和更换浏览器后仍能恢复考试院草稿。
  async function persistDraft(parsed: ScoreSourceDraft) {
    if (!wallet.address) {
      throw new Error("请先连接考试院钱包。");
    }
    const createdDraft = await createAuthorityDraft({
      createdBy: wallet.address,
      payload: {
        scoreSource: {
          scoreSourceIdLabel: parsed.scoreSourceIdLabel,
          sourceTitle: parsed.sourceTitle,
          maxScore: parsed.maxScore,
          merkleDepth: parsed.merkleDepth
        },
        records: parsed.records
      }
    });
    await refreshWorkbench();
    return createdDraft;
  }

  // 本地上传 JSON 的入口。
  // 流程顺序固定为：前端结构校验 -> 后台会话 -> 保存草稿 -> 生成预览。
  async function handleImportFile(file: File) {
    const raw = await file.text();
    let parsed: ScoreSourceDraft;
    try {
      parsed = parseAuthorityImportJson(raw);
    } catch (error) {
      await dialog.showError({
        title: "成绩导入失败",
        description: "当前文件没有通过成绩格式校验。",
        details: toReadableError(error, "导入本届成绩失败。")
      });
      return;
    }

    if (draft) {
      const confirmed = await dialog.confirm({
        title: "确认覆盖当前成绩草稿",
        description: "重新导入会覆盖当前已经载入的本届成绩草稿，是否继续？",
        confirmLabel: "继续覆盖"
      });
      if (!confirmed) {
        return;
      }
    }

    await runDialogAction({
      progress: {
        title: "正在导入成绩",
        description: "系统正在保存当前成绩草稿并生成本地凭证预览。"
      },
      success: {
        title: "成绩导入成功",
        description: "成绩已导入，可继续生成学生凭证和发布本届成绩源。"
      },
      error: (error) => ({
        title: "成绩导入失败",
        description: "当前没有完成成绩导入，请稍后重试。",
        details: toReadableError(error, "导入本届成绩失败。")
      }),
      run: async () => {
        setImporting(true);
        setDraftPreviewError(null);
        try {
          await ensureAuthoritySession();
          const createdDraft = await persistDraft(parsed);
          await generateDraftPreview(createdDraft.id);
          return createdDraft;
        } finally {
          setImporting(false);
        }
      }
    });
  }

  // 导入演示数据仍然复用和真实文件导入相同的后端链路，
  // 目的是保证“演示材料”和“用户手动上传材料”走的是同一套校验与预览逻辑。
  async function handleLoadDemoData() {
    if (draft) {
      const confirmed = await dialog.confirm({
        title: "确认覆盖当前成绩草稿",
        description: "重新导入演示数据会覆盖当前已经载入的成绩草稿，是否继续？",
        confirmLabel: "继续覆盖"
      });
      if (!confirmed) {
        return;
      }
    }

    await runDialogAction({
      progress: {
        title: "正在导入演示数据",
        description: "系统正在加载演示成绩并生成本地凭证预览。"
      },
      success: {
        title: "演示数据导入成功",
        description: "演示成绩已导入，可继续生成学生凭证和发布本届成绩源。"
      },
      error: (error) => ({
        title: "演示数据导入失败",
        description: "当前没有完成演示数据导入，请稍后重试。",
        details: toReadableError(error, "导入演示成绩失败。")
      }),
      run: async () => {
        setImporting(true);
        setDraftPreviewError(null);
        try {
          const response = await fetch("/examples/sample-results.json", { cache: "no-store" });
          if (!response.ok) {
            throw new Error("演示成绩文件暂不可用。");
          }
          const parsed = parseAuthorityImportJson(await response.text());
          await ensureAuthoritySession();
          const createdDraft = await persistDraft(parsed);
          await generateDraftPreview(createdDraft.id);
          return createdDraft;
        } finally {
          setImporting(false);
        }
      }
    });
  }

  // 发布动作只负责把成绩源写链；
  // 真正把按钮从“可发布”切成“已发布”的判断，仍以后端 workbench 追平到最新链上状态为准。
  async function handlePublishScoreSource() {
    if (!draft || !generatedScoreSource || !publicClient || !wallet.address) {
      return;
    }

    await runDialogAction({
      confirm: {
        title: "确认发布本届成绩源",
        description: "发布后，大学和学生将基于这版成绩继续后面的规则创建和申请流程。",
        details: `成绩批次：${generatedScoreSource.sourceTitle}\n成绩源编号：${generatedScoreSource.scoreSourceIdLabel}\n总分：${generatedScoreSource.maxScore} 分`
      },
      progress: {
        title: "正在发布成绩源",
        description: "系统正在提交链上交易并同步工作台状态，请稍候。"
      },
      success: (hash) => ({
        title: "成绩源发布成功",
        description: "本届成绩已经写入链上，大学和学生现在可以继续后面的流程。",
        details: `交易哈希：${hash}`
      }),
      error: (error) => ({
        title: "成绩源发布失败",
        description: "当前没有完成链上发布，请稍后重试。",
        details: toReadableError(error, "发布成绩源失败。")
      }),
      run: async () => {
        setPublishing(true);
        try {
          const hash = await writeContractAsync({
            abi: scoreRootRegistryAbi,
            address: config.scoreRootRegistryAddress,
            functionName: "createScoreSource",
            args: [
              generatedScoreSource.scoreSourceIdBytes32,
              generatedScoreSource.sourceTitle,
              generatedScoreSource.maxScore,
              BigInt(generatedScoreSource.merkleRoot)
            ]
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          assertSuccessfulTransactionReceipt(receipt, "发布成绩源");
          await waitForAuthorityWorkbench({
            queryClient,
            timeoutMessage: "链上交易已经确认，但考试院链上状态尚未同步到工作台，请稍后刷新页面确认。",
            predicate: (data) =>
              Boolean(
                data.latestActiveSource &&
                  data.latestActiveSource.scoreSourceId.toLowerCase() ===
                    generatedScoreSource.scoreSourceIdBytes32.toLowerCase()
              )
          });
          await refreshWorkbench();
          return hash;
        } finally {
          setPublishing(false);
        }
      }
    });
  }

  // 导出单个学生凭证会落一条发放记录，并把对应凭证下载到本地。
  async function handleIssueCredential(credential: AdmissionCredential) {
    if (!workbench.draftId || !wallet.address) {
      return;
    }

    try {
      await ensureAuthoritySession();

      const fileName = `${credential.candidateLabel}-credential.json`;
      const generated = await generateAuthorityDraftBatch({
        draftId: workbench.draftId,
        createdBy: wallet.address,
        mode: "single",
        fileName,
        records: [
          {
            candidateLabel: credential.candidateLabel,
            boundStudentAddress: credential.boundStudentAddress,
            score: credential.score
          }
        ]
      });
      downloadJsonFile(fileName, generated.credentials[0]);
      await refreshWorkbench();
    } catch (error) {
      if (error instanceof DialogActionCancelledError) {
        return;
      }
      await dialog.showError({
        title: "学生凭证导出失败",
        description: "当前没有完成该学生的凭证导出，请稍后重试。",
        details: toReadableError(error, "导出学生凭证失败。")
      });
    }
  }

  // 批量导出时，后端返回的是一整批凭证快照；
  // 前端只负责把这批 JSON 下载下来，不再自己重组批次结构。
  async function handleIssueAllCredentials() {
    if (!generatedCredentials.length || !generatedScoreSource || !workbench.draftId || !wallet.address) {
      return;
    }

    try {
      await ensureAuthoritySession();

      const exportedAt = Date.now();
      const fileName = `${generatedScoreSource.scoreSourceIdLabel}-all-student-credentials.json`;

      const generated = await generateAuthorityDraftBatch({
        draftId: workbench.draftId,
        createdBy: wallet.address,
        mode: "batch",
        fileName
      });

      downloadJsonFile(fileName, {
        exportedAt,
        scoreSource: generated.scoreSource,
        totalCredentials: generated.credentials.length,
        credentials: generated.credentials
      });
      await refreshWorkbench();
    } catch (error) {
      if (error instanceof DialogActionCancelledError) {
        return;
      }
      await dialog.showError({
        title: "批量凭证导出失败",
        description: "当前没有完成全部学生凭证导出，请稍后重试。",
        details: toReadableError(error, "导出全部学生凭证失败。")
      });
    }
  }

  // 链上区块里可能还没有最新发布记录，但只要本地预览已经生成，
  // 页面仍然会先展示“待发布的当前成绩源”，帮助考试院理解自己下一步将要写入什么。
  const currentSourceView = useMemo(() => {
    const latestSource = workbench.latestActiveSource ?? workbench.latestSource;
    if (latestSource) {
      return {
        sourceTitle: latestSource.sourceTitle,
        scoreSourceIdLabel: latestSource.scoreSourceIdLabel,
        maxScore: latestSource.maxScore,
        issuedAt: latestSource.issuedAt * 1000,
        isPublished: latestSource.active
      };
    }

    if (generatedScoreSource) {
      return {
        sourceTitle: generatedScoreSource.sourceTitle,
        scoreSourceIdLabel: generatedScoreSource.scoreSourceIdLabel,
        maxScore: generatedScoreSource.maxScore,
        isPublished: false
      };
    }

    return null;
  }, [generatedScoreSource, workbench.latestActiveSource, workbench.latestSource]);

  const authorityWorkflow = useAuthorityWorkflowState({
    isConfigured,
    isConnected: wallet.isConnected,
    wrongChain: wallet.wrongChain,
    isWorkbenchLoading: workbench.isLoading,
    isWorkbenchError: workbench.isError,
    draft,
    latestActiveSource: workbench.latestActiveSource
      ? {
          scoreSourceId: workbench.latestActiveSource.scoreSourceId
        }
      : null,
    generatedScoreSource
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">考试院工作台</h1>
              <p className="mt-1 text-sm text-slate-500">
                上传本届成绩、导出学生成绩凭证，并发布本届成绩源。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
              {wallet.address ? formatAddress(wallet.address, 6) : "未连接钱包"}
            </div>
            {!wallet.isConnected ? (
              <Button onClick={() => void wallet.connectWallet()} disabled={wallet.isConnecting}>
                {wallet.isConnecting ? "连接中..." : "连接钱包"}
              </Button>
            ) : (
              <Button variant="outline" onClick={wallet.disconnectWallet}>
                断开连接
              </Button>
            )}
          </div>
        </div>
      </section>

      {wallet.wrongChain ? (
        <ChainGuardNotice
          expectedChainId={config.chainId}
          onSwitch={wallet.switchToExpectedChain}
          switching={wallet.isSwitching}
        />
      ) : null}

      {!isConfigured ? (
        <InfoNotice
          title="系统配置未完成"
          description="当前尚未同步系统配置，暂时不能发布成绩源。"
          tone="warning"
        />
      ) : null}

      {workbench.isError ? (
        <ErrorState title="工作台数据读取失败" description="当前无法读取考试院工作台数据，请稍后重试。" />
      ) : null}
      {workbench.syncStatus.stale && workbench.syncStatus.partialErrors.length ? (
        <InfoNotice
          title="链上状态部分滞后"
          description={workbench.syncStatus.partialErrors.join(" ")}
          tone="warning"
        />
      ) : null}
      {!backendSession.isLoading && backendSession.isAuthenticated && !workbench.isLoading && !workbench.latestActiveSource ? (
        <InfoNotice
          title="当前还没有发布本届成绩"
          description="请先导入成绩文件并发布本届成绩源，大学和学生才能继续后面的流程。"
        />
      ) : null}

      <div className="space-y-8">
        <section className="space-y-6">
          {/* 本地操作区只展示草稿、凭证导出和批次记录，不把它们误导成链上真相。 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900">本地操作</h2>
            <p className="mt-1 text-sm text-slate-500">
              这里是考试院的草稿与导出流程，由后端托管记录，但不直接代表链上状态。
            </p>
          </div>
          {draftPreviewError ? (
            <InfoNotice
              title="本地凭证预览暂不可用"
              description={draftPreviewError}
              tone="warning"
            />
          ) : null}
          {wallet.isConnected && !wallet.wrongChain && !backendSession.isAuthenticated ? (
            <InfoNotice
              title="需要写入后台记录时才会请求签名"
              description="进入考试院工作台本身不需要签名。只有在导入成绩、生成本地批次等动作真正写入后台记录时，系统才会请求一次钱包签名。"
              tone="warning"
            />
          ) : null}
          <StudentRecordImportPanel
            draft={draft}
            importing={importing}
            onSelectFile={handleImportFile}
            onLoadDemo={() => void handleLoadDemoData()}
          />
          <CredentialIssuancePanel
            credentials={generatedCredentials}
            onIssue={(credential) => void handleIssueCredential(credential)}
            onIssueAll={() => void handleIssueAllCredentials()}
          />
          <AuthorityIssuanceRecordList records={workbench.issuanceRecords} />
        </section>

        <section className="space-y-6">
          {/* 链上状态区只认成绩源发布历史和当前启用成绩源。 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900">链上状态</h2>
            <p className="mt-1 text-sm text-slate-500">
              这里展示的是已经写入链上的本届成绩源和历史发布记录。
            </p>
          </div>
          <AuthorityScoreSourcePanel
            currentSource={currentSourceView}
            draft={draft}
            onPublish={() => void handlePublishScoreSource()}
            publishing={publishing}
            canPublish={authorityWorkflow.canPublish}
            publishDisabledReason={authorityWorkflow.publishDisabledReason}
          />
          <PublishRecordList records={workbench.publishHistory} />
        </section>
      </div>
    </div>
  );
}

export default function AuthorityPage() {
  return <RoleGate expectedRole="authority">{() => <AuthorityPageContent />}</RoleGate>;
}
