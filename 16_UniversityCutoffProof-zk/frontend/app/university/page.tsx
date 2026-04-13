"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWriteContract } from "wagmi";
import { School } from "lucide-react";
import { ChainGuardNotice } from "@/components/wallet/ChainGuardNotice";
import { UniversityScopeGate } from "@/components/shared/UniversityScopeGate";
import { CurrentFrozenRulePanel } from "@/components/university/CurrentFrozenRulePanel";
import { RuleVersionList } from "@/components/university/RuleVersionList";
import { AdmittedStudentList } from "@/components/university/AdmittedStudentList";
import { UniversityApplicationReviewPanel } from "@/components/university/UniversityApplicationReviewPanel";
import { UniversityRuleDraftPanel } from "@/components/university/UniversityRuleDraftPanel";
import { useDialog } from "@/components/shared/DialogProvider";
import { ErrorState, InfoNotice } from "@/components/shared/StatePanels";
import { UNIVERSITY_KEY_BYTES32 } from "@/lib/contracts/admission-role-registry";
import { universityAdmissionVerifierAbi } from "@/lib/contracts/university-admission-verifier";
import { assertSuccessfulTransactionReceipt } from "@/lib/blockchain/tx-receipt";
import {
  asciiToBytes32Hex,
  buildSchoolIdLabelForVersion,
  getCutoffValidationError,
  getSchoolNameByFamily
} from "@/lib/admission/rule-version";
import { waitForStudentWorkbench, waitForUniversityWorkbench } from "@/lib/workbench-sync";
import { useApplicationReviewActions } from "@/hooks/useApplicationReviewActions";
import { useChainConsistency } from "@/hooks/useChainConsistency";
import { useDialogAction } from "@/hooks/useDialogAction";
import { useReadClient } from "@/hooks/useReadClient";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useUniversityWorkbench } from "@/hooks/useUniversityWorkbench";
import { useUniversityWorkflowState } from "@/hooks/useUniversityWorkflowState";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import type { UniversityApplicationStatus } from "@/types/history";
import type { SchoolFamilyKey } from "@/types/admission";
import { formatAddress, toReadableError } from "@/lib/utils";

// 大学工作台主页面。
// 页面只依赖 university workbench 提供的规则、审批和摘要快照，
// 不再自己从链上拼“当前生效规则”或“当前成绩源可否创建草稿”。
function UniversityPageContent({ activeFamily }: { activeFamily: SchoolFamilyKey }) {
  const { config, isConfigured } = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const readClientState = useReadClient(config);
  const publicClient = readClientState.client;
  const chainConsistency = useChainConsistency({
    config,
    enabled: wallet.isConnected && !wallet.wrongChain && isConfigured
  });
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const dialog = useDialog();
  const runDialogAction = useDialogAction();
  const workbench = useUniversityWorkbench({
    familyKey: activeFamily,
    enabled: isConfigured
  });

  const [draftCutoff, setDraftCutoff] = useState("");
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [freezingDraft, setFreezingDraft] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<UniversityApplicationStatus>("PENDING");
  const reviewActions = useApplicationReviewActions(config);

  const activeScoreSource = workbench.latestActiveSource;
  const familyVersions = workbench.rules;
  const currentFrozenVersion = workbench.currentFrozenVersion;
  const currentSourceRule = workbench.currentSourceRule;
  const nextVersionNumber = workbench.nextVersionNumber;
  const currentSourceMaxScore = activeScoreSource?.maxScore ?? null;
  const admittedStudents = useMemo(
    () =>
      workbench.applications
        .filter((record) => record.status === "APPROVED")
        .sort((left, right) => right.updatedAt - left.updatedAt),
    [workbench.applications]
  );
  const schoolName = getSchoolNameByFamily(activeFamily);
  const currentAdmin = currentSourceRule?.admin ?? currentFrozenVersion?.admin ?? null;

  // workflow hook 负责把钱包、链一致性、后台 workbench 和业务守卫收口成统一禁用原因。
  const workflow = useUniversityWorkflowState({
    isConnected: wallet.isConnected,
    wrongChain: wallet.wrongChain,
    chainConsistencyChecking: chainConsistency.isChecking,
    chainConsistencyError: Boolean(chainConsistency.isError),
    chainConsistent: chainConsistency.isConsistent,
    chainConsistencyMessage: chainConsistency.message ?? null,
    isWorkbenchLoading: workbench.isLoading,
    isWorkbenchError: workbench.isError,
    walletAddress: wallet.address,
    currentAdmin,
    createDraftGuardReason: workbench.createDraftGuardReason,
    backendCanCreateDraft: workbench.canCreateDraft
  });

  const managementGuardReason = workflow.managementGuardReason;
  const canEdit = workflow.canEdit;
  const cutoffValidationError = getCutoffValidationError(draftCutoff, currentSourceMaxScore);
  const createDraftDisabledReason = workflow.createDraftDisabledReason ?? cutoffValidationError;
  const canCreateDraft = !cutoffValidationError && workflow.canCreateDraft;

  async function refreshWorkbench() {
    await queryClient.invalidateQueries({ queryKey: ["university-workbench", activeFamily] });
    await queryClient.invalidateQueries({ queryKey: ["student-workbench"] });
  }

  // 新建草稿时，receipt 成功并不代表页面状态已经追平。
  // 必须等当前成绩源对应规则真正出现在 workbench 里，页面才算完成这一动作。
  async function handleCreateDraft() {
    if (!publicClient || !wallet.address || !activeScoreSource) return;
    const cutoffError = getCutoffValidationError(draftCutoff, activeScoreSource.maxScore);
    if (cutoffError) {
      await dialog.showError({
        title: "当前不能创建规则草稿",
        description: cutoffError
      });
      return;
    }

    const cutoff = Number(draftCutoff);
    const schoolIdLabel = buildSchoolIdLabelForVersion(activeFamily, nextVersionNumber);
    const expectedSchoolId = asciiToBytes32Hex(schoolIdLabel);

    await runDialogAction({
      confirm: {
        title: "确认新建规则草稿",
        description: `将为 ${schoolName} 基于当前成绩批次创建一条新的申请规则。`,
        details: `成绩批次：${activeScoreSource.sourceTitle}\n录取线：${cutoff} 分`
      },
      progress: {
        title: "正在创建规则草稿",
        description: "系统正在提交链上交易并同步工作台状态，请稍候。"
      },
      success: (hash) => ({
        title: "规则草稿创建成功",
        description: "当前成绩源的申请规则已经创建，下一步可以直接开放申请。",
        details: `交易哈希：${hash}`
      }),
      error: (error) => ({
        title: "规则草稿创建失败",
        description: "当前没有完成规则创建，请稍后重试。",
        details: toReadableError(error, "创建规则草稿失败。")
      }),
      run: async () => {
        setCreatingDraft(true);
        try {
          const hash = await writeContractAsync({
            abi: universityAdmissionVerifierAbi,
            address: config.universityAdmissionVerifierAddress,
            functionName: "createSchool",
            args: [
              UNIVERSITY_KEY_BYTES32[activeFamily],
              asciiToBytes32Hex(schoolIdLabel),
              schoolName,
              activeScoreSource.scoreSourceId,
              cutoff
            ]
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          assertSuccessfulTransactionReceipt(receipt, "创建申请规则");
          setDraftCutoff("");
          await waitForUniversityWorkbench({
            queryClient,
            familyKey: activeFamily,
            timeoutMessage: "链上交易已经确认，但规则草稿尚未同步到大学工作台，请稍后刷新页面确认。",
            predicate: (data) =>
              Boolean(
                data.currentSourceRule &&
                  data.currentSourceRule.schoolId.toLowerCase() ===
                    expectedSchoolId.toLowerCase()
              )
          });
          await refreshWorkbench();
          return hash;
        } finally {
          setCreatingDraft(false);
        }
      }
    });
  }

  // 开放申请这一步会把规则切成“active=true + cutoffFrozen=true”。
  // 当前页面只在 workbench 真正反映出这个状态后，才结束成功链路。
  async function handleFreezeDraft() {
    if (!publicClient || !currentSourceRule || currentSourceRule.cutoffFrozen) return;

    const closeOldRule = Boolean(
      currentFrozenVersion && currentFrozenVersion.schoolId !== currentSourceRule.schoolId
    );

    await runDialogAction({
      confirm: {
        title: "确认开放申请",
        description: closeOldRule
          ? "开放后学生即可提交申请，同时系统会关闭当前正在使用的旧规则。"
          : "开放后学生即可根据这条规则提交申请。",
        details: `学校：${schoolName}\n当前规则：第 ${currentSourceRule.versionNumber} 轮\n录取线：${currentSourceRule.cutoffScore} 分`
      },
      progress: {
        title: "正在开放申请",
        description: "系统正在提交链上交易并同步工作台状态，请稍候。"
      },
      success: (hashes) => ({
        title: "申请规则已开放",
        description: "学生现在可以根据当前规则提交申请。",
        details: hashes.join("\n")
      }),
      error: (error) => ({
        title: "开放申请失败",
        description: "当前规则还没有成功开放，请稍后重试。",
        details: toReadableError(error, "开放申请失败。")
      }),
      run: async () => {
        setFreezingDraft(true);
        try {
          const details: string[] = [];
          const openHash = await writeContractAsync({
            abi: universityAdmissionVerifierAbi,
            address: config.universityAdmissionVerifierAddress,
            functionName: "setSchoolStatus",
            args: [currentSourceRule.schoolId, true]
          });
          const openReceipt = await publicClient.waitForTransactionReceipt({ hash: openHash });
          assertSuccessfulTransactionReceipt(openReceipt, "开放申请规则");
          details.push(`开放申请交易：${openHash}`);

          if (currentFrozenVersion && currentFrozenVersion.schoolId !== currentSourceRule.schoolId) {
            const deactivateHash = await writeContractAsync({
              abi: universityAdmissionVerifierAbi,
              address: config.universityAdmissionVerifierAddress,
              functionName: "setSchoolStatus",
              args: [currentFrozenVersion.schoolId, false]
            });
            const deactivateReceipt = await publicClient.waitForTransactionReceipt({
              hash: deactivateHash
            });
            assertSuccessfulTransactionReceipt(deactivateReceipt, "关闭旧申请规则");
            details.push(`关闭旧规则交易：${deactivateHash}`);
          }

          await waitForUniversityWorkbench({
            queryClient,
            familyKey: activeFamily,
            timeoutMessage: "链上交易已经确认，但大学工作台中的规则状态尚未同步为已开放，请稍后刷新页面确认。",
            predicate: (data) =>
              Boolean(
                data.currentSourceRule &&
                  data.currentSourceRule.schoolId.toLowerCase() ===
                    currentSourceRule.schoolId.toLowerCase() &&
                  data.currentSourceRule.active &&
                  data.currentSourceRule.cutoffFrozen
              )
          });
          await refreshWorkbench();
          return details;
        } finally {
          setFreezingDraft(false);
        }
      }
    });
  }

  // 批准学生后，需要同时等大学审批列表和学生当前申请状态都同步成 APPROVED。
  async function handleApprove(record: typeof workbench.applications[number]) {
    await runDialogAction({
      confirm: {
        title: "确认批准申请",
        description: `批准后，${record.schoolName} 将录取该学生，当前申请结果会写入链上。`,
        details: `申请人：${formatAddress(record.applicant, 8)}\n学校：${record.schoolName}`
      },
      progress: {
        title: "正在批准申请",
        description: "系统正在提交链上交易并同步工作台状态，请稍候。"
      },
      success: (hash) => ({
        title: "申请已批准",
        description: "该学生已经进入已录取名单。",
        details: `交易哈希：${hash}`
      }),
      error: (error) => ({
        title: "批准申请失败",
        description: "当前没有完成批准操作，请稍后重试。",
        details: toReadableError(error, "批准申请失败。")
      }),
      run: async () => {
        const hash = await reviewActions.approveApplication({
          schoolId: record.schoolId,
          applicant: record.applicant
        });
        await waitForUniversityWorkbench({
          queryClient,
          familyKey: activeFamily,
          timeoutMessage: "链上交易已经确认，但大学工作台中的审批结果尚未同步，请稍后刷新页面确认。",
          predicate: (data) =>
            Boolean(
              data.applications.find(
                (item) =>
                  item.schoolId.toLowerCase() === record.schoolId.toLowerCase() &&
                  item.applicant.toLowerCase() === record.applicant.toLowerCase() &&
                  item.status === "APPROVED"
              )
            )
        });
        await waitForStudentWorkbench({
          queryClient,
          walletAddress: record.applicant,
          timeoutMessage: "链上交易已经确认，但学生侧申请状态尚未同步，请稍后刷新页面确认。",
          predicate: (data) =>
            Boolean(
              data.currentApplication &&
                data.currentApplication.schoolId.toLowerCase() === record.schoolId.toLowerCase() &&
                data.currentApplication.status === "APPROVED"
            )
        });
        await refreshWorkbench();
        return hash;
      }
    });
  }

  // 拒绝学生时同样等待两侧 workbench 一致，避免大学页和学生页短时间出现相互矛盾的结果。
  async function handleReject(record: typeof workbench.applications[number]) {
    await runDialogAction({
      confirm: {
        title: "确认拒绝申请",
        description: `拒绝后，该学生在当前账户下将保持申请锁定状态。`,
        details: `申请人：${formatAddress(record.applicant, 8)}\n学校：${record.schoolName}`
      },
      progress: {
        title: "正在拒绝申请",
        description: "系统正在提交链上交易并同步工作台状态，请稍候。"
      },
      success: (hash) => ({
        title: "申请已拒绝",
        description: "链上状态已经更新为已拒绝。",
        details: `交易哈希：${hash}`
      }),
      error: (error) => ({
        title: "拒绝申请失败",
        description: "当前没有完成拒绝操作，请稍后重试。",
        details: toReadableError(error, "拒绝申请失败。")
      }),
      run: async () => {
        const hash = await reviewActions.rejectApplication({
          schoolId: record.schoolId,
          applicant: record.applicant
        });
        await waitForUniversityWorkbench({
          queryClient,
          familyKey: activeFamily,
          timeoutMessage: "链上交易已经确认，但大学工作台中的审批结果尚未同步，请稍后刷新页面确认。",
          predicate: (data) =>
            Boolean(
              data.applications.find(
                (item) =>
                  item.schoolId.toLowerCase() === record.schoolId.toLowerCase() &&
                  item.applicant.toLowerCase() === record.applicant.toLowerCase() &&
                  item.status === "REJECTED"
              )
            )
        });
        await waitForStudentWorkbench({
          queryClient,
          walletAddress: record.applicant,
          timeoutMessage: "链上交易已经确认，但学生侧申请状态尚未同步，请稍后刷新页面确认。",
          predicate: (data) =>
            Boolean(
              data.currentApplication &&
                data.currentApplication.schoolId.toLowerCase() === record.schoolId.toLowerCase() &&
                data.currentApplication.status === "REJECTED"
            )
        });
        await refreshWorkbench();
        return hash;
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
              <School className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">大学工作台</h1>
              <p className="mt-1 text-sm text-slate-500">管理本校申请规则与开放状态。</p>
            </div>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
            当前管理学校：{schoolName}
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

      {!wallet.isConnected ? (
        <InfoNotice
          title="当前未连接钱包"
          description="连接学校管理员账户后，才能新建规则、调整录取线并审批学生申请。"
          tone="warning"
        />
      ) : null}

      {currentAdmin &&
      wallet.address &&
      wallet.address.toLowerCase() !== currentAdmin.toLowerCase() ? (
        <InfoNotice
          title="当前账户不是该校管理员"
          description="当前账户只能查看本校规则，不能执行管理操作。"
          tone="warning"
        />
      ) : null}

      {wallet.isConnected &&
      !wallet.wrongChain &&
      (chainConsistency.isError || !chainConsistency.isConsistent) ? (
        <ErrorState
          title="本地链连接异常"
          description={chainConsistency.message ?? "当前钱包连接的链与项目运行链不一致。"}
        />
      ) : null}
      {workbench.isError ? (
        <ErrorState title="大学工作台读取失败" description="当前无法读取大学侧聚合数据。" />
      ) : null}
      {workbench.syncStatus.stale && workbench.syncStatus.partialErrors.length ? (
        <InfoNotice
          title="链上状态部分滞后"
          description={workbench.syncStatus.partialErrors.join(" ")}
          tone="warning"
        />
      ) : null}
      {!workbench.isLoading && !activeScoreSource ? (
        <InfoNotice
          title="考试院尚未发布本届成绩"
          description="请先等待考试院上传并发布本届成绩，之后大学才能设置录取线并开放申请。"
          tone="warning"
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          {/* 摘要卡和当前生效规则都只解释已经追平到投影库的状态。 */}
          {workbench.summary ? (
            <section className="grid gap-4 md:grid-cols-3">
              <SummaryCard label="待审批" value={workbench.summary.pendingApplicationCount} />
              <SummaryCard label="已录取" value={workbench.summary.approvedApplicationCount} />
              <SummaryCard label="已拒绝" value={workbench.summary.rejectedApplicationCount} />
            </section>
          ) : null}
          <CurrentFrozenRulePanel version={currentFrozenVersion} />
          <RuleVersionList versions={familyVersions} />
        </div>

        <div className="space-y-6">
          {/* 草稿卡只处理“当前成绩源对应的这一条规则”，不再允许在同一成绩源下反复创建多条规则。 */}
          <UniversityRuleDraftPanel
            schoolName={schoolName}
            currentSourceTitle={activeScoreSource?.sourceTitle ?? null}
            draftCutoff={draftCutoff}
            onDraftCutoffChange={setDraftCutoff}
            currentSourceMaxScore={currentSourceMaxScore}
            onCreateDraft={() => void handleCreateDraft()}
            onFreezeDraft={() => void handleFreezeDraft()}
            creatingDraft={creatingDraft}
            freezingDraft={freezingDraft}
            currentSourceRule={currentSourceRule}
            canEdit={canEdit}
            canCreateDraft={canCreateDraft}
            createDisabledReason={createDraftDisabledReason}
          />
          <InfoNotice
            title="规则管理说明"
            description="每次考试院发布一版成绩后，本校只能提交一条申请规则；如需下一条规则，请等待新的成绩版本。"
          />
        </div>
      </div>

      {chainConsistency.isChecking || workbench.isLoading ? (
        <InfoNotice
          title="正在读取申请列表"
          description="正在同步当前学校的成绩批次、申请规则和学生申请记录。"
        />
      ) : null}

      {chainConsistency.isError || !chainConsistency.isConsistent ? null : workbench.isError ? (
        <ErrorState title="申请列表读取失败" description="无法读取当前学校对应的申请记录。" />
      ) : (
        <div className="space-y-6">
          <UniversityApplicationReviewPanel
            records={workbench.applications}
            activeFilter={reviewFilter}
            onFilterChange={setReviewFilter}
            pendingKey={reviewActions.pendingKey}
            canReview={canEdit}
            onApprove={(record) => void handleApprove(record)}
            onReject={(record) => void handleReject(record)}
          />
          <AdmittedStudentList records={admittedStudents} />
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default function UniversityPage() {
  return (
    <UniversityScopeGate>{(familyKey) => <UniversityPageContent activeFamily={familyKey} />}</UniversityScopeGate>
  );
}
