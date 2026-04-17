"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PlusCircle, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { useWalletClient } from "wagmi";
import { RoleAccessStateCard } from "@/components/shared/RoleAccessStateCard";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useDialog } from "@/components/shared/DialogProvider";
import { governmentCopy } from "@/lib/copy";
import {
  useCredentialSetPublishHistoryQuery,
  useGovernmentCredentialSetStateQuery
} from "@/hooks/useBenefitQueries";
import { useGovernmentDraftManager } from "@/hooks/useGovernmentDraftManager";
import { useGovernmentSession } from "@/hooks/useGovernmentSession";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useVisibilityOnce } from "@/hooks/useVisibilityOnce";
import { useWalletActionFeedback } from "@/hooks/useWalletActionFeedback";
import {
  parseReferenceDateInput,
  referenceDateToInputValue
} from "@/lib/credential-set-management.shared";
import { markGovernmentCredentialSetPublished } from "@/lib/government-credential-sets.client";
import { benefitRoleRegistryAbi, unemploymentCredentialRootRegistryAbi } from "@/lib/contracts/abis";
import { getErrorDetails, getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { queryKeys } from "@/lib/query-keys";
import type { GeneratedCredentialSetSnapshot } from "@/types/domain";
import { formatDateTime } from "@/lib/utils";

const GovernmentHistorySection = dynamic(
  () => import("@/components/government/GovernmentHistorySection").then((mod) => mod.GovernmentHistorySection)
);

/** 根据当前草稿是否被修改，决定发布按钮显示“继续发布”还是“生成并发布”。 */
function resolvePublishButtonLabel(isDirty: boolean, latestDraftSnapshot: GeneratedCredentialSetSnapshot | null) {
  if (!isDirty && latestDraftSnapshot) {
    return governmentCopy.publishButton.continueLabel;
  }

  return governmentCopy.publishButton.createLabel;
}

/** 政府端资格审核管理页。 */
export default function GovernmentPage() {
  const applicantAddressInputRef = useRef<HTMLInputElement | null>(null);
  const { config, wallet, publicClient, accessByRole, isConfigured } = useRoleAccess();
  const { data: walletClient } = useWalletClient();
  const { connectWallet, switchToExpectedChain, walletError } = useWalletActionFeedback(wallet);
  const governmentSession = useGovernmentSession(wallet.address, accessByRole.government.allowed && Boolean(wallet.address));
  const queryClient = useQueryClient();
  const dialog = useDialog();
  const { ref: historySectionRef, isVisible: historyVisible } = useVisibilityOnce<HTMLElement>();
  const governmentAccess = accessByRole.government;

  const historyQuery = useCredentialSetPublishHistoryQuery({
    config,
    enabled: Boolean(isConfigured && historyVisible)
  });
  const managementStateQuery = useGovernmentCredentialSetStateQuery({
    config,
    walletAddress: wallet.address,
    enabled: governmentAccess.allowed
  });

  const currentSet = managementStateQuery.data?.currentChainSet ?? null;
  const history = historyQuery.data ?? [];
  const managementState = managementStateQuery.data;
  const draftManager = useGovernmentDraftManager({
    managementState,
    governmentSession,
    queryClient,
    config,
    walletAddress: wallet.address
  });
  const hasManagementData = Boolean(managementState && draftManager.draft);
  const publishButtonLabel = resolvePublishButtonLabel(
    draftManager.isDirty,
    draftManager.preparedSnapshot ?? managementState?.latestDraftSnapshot ?? null
  );

  /** 执行完整的发布流程：确认 -> 补开 applicant 权限 -> 发布名单 -> 回写本地快照。 */
  async function handlePublish() {
    if (!wallet.address || !walletClient || !publicClient || !draftManager.draft || draftManager.isPublishing) {
      return;
    }

    draftManager.setDraftError(null);

    try {
      const prepared = await draftManager.prepareSnapshotForPublish();
      const confirmation = await dialog.confirm({
        title: governmentCopy.publishDialog.confirmTitle(Boolean(prepared.snapshot.publishedAt)),
        description: governmentCopy.publishDialog.confirmDescription,
        details: [
          `${governmentCopy.publishDialog.versionLabel}：v${prepared.snapshot.set.version}`,
          `${governmentCopy.publishDialog.referenceDateLabel}：${formatDateTime(prepared.snapshot.set.referenceDate)}`,
          `${governmentCopy.publishDialog.eligibleCountLabel}：${prepared.snapshot.set.eligibleCount}`,
          `${governmentCopy.publishDialog.pendingApplicantsLabel}：${prepared.pendingApplicantAddresses.length}`,
          `${governmentCopy.publishDialog.summaryHashLabel}：${prepared.snapshot.set.merkleRoot}`
        ].join("\n")
      });

      if (!confirmation) {
        return;
      }

      draftManager.setPublishing(true);
      const progress = dialog.showInfo({
        title: governmentCopy.publishDialog.preparingTitle,
        description: governmentCopy.publishDialog.preparingDescription,
        busy: true,
        dismissible: false
      });

      let roleSyncTxHash: `0x${string}` | undefined;

      if (prepared.pendingApplicantAddresses.length > 0) {
        progress.update({
          title: governmentCopy.publishDialog.syncingRoleTitle,
          description: governmentCopy.publishDialog.syncingRoleDescription(prepared.pendingApplicantAddresses.length)
        });

        roleSyncTxHash = await walletClient.writeContract({
          account: wallet.address,
          abi: benefitRoleRegistryAbi,
          address: config.roleRegistryAddress,
          functionName: "setApplicants",
          args: [prepared.pendingApplicantAddresses, true]
        });

        await publicClient.waitForTransactionReceipt({ hash: roleSyncTxHash });
      }

      progress.update({
        title: governmentCopy.publishDialog.publishingTitle,
        description: governmentCopy.publishDialog.publishingDescription
      });

      const publishTxHash = await walletClient.writeContract({
        account: wallet.address,
        abi: unemploymentCredentialRootRegistryAbi,
        address: config.rootRegistryAddress,
        functionName: "publishCredentialSet",
        args: [
          prepared.snapshot.set.setIdBytes32,
          BigInt(prepared.snapshot.set.merkleRoot),
          prepared.snapshot.set.version,
          prepared.snapshot.set.referenceDate,
          prepared.snapshot.set.eligibleCount
        ]
      });

      await publicClient.waitForTransactionReceipt({ hash: publishTxHash });
      const token = await governmentSession.ensureSession();
      await markGovernmentCredentialSetPublished({
        token,
        version: prepared.snapshot.set.version,
        publishedTxHash: publishTxHash,
        roleSyncTxHash
      });

      progress.close();
      await dialog.showSuccess({
        title: governmentCopy.publishDialog.successTitle,
        description: governmentCopy.publishDialog.successDescription,
        details: [
          `${governmentCopy.publishDialog.publishedVersionLabel}：v${prepared.snapshot.set.version}`,
          `${governmentCopy.publishDialog.publishTxHashLabel}：${publishTxHash}`,
          roleSyncTxHash ? `${governmentCopy.publishDialog.roleSyncTxHashLabel}：${roleSyncTxHash}` : null
        ]
          .filter(Boolean)
          .join("\n")
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.currentCredentialSet(config) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.credentialSetPublishHistory(config) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.governmentCredentialSetState(config, wallet.address) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.roleStatus(config, wallet.address) }),
        ...prepared.pendingApplicantAddresses.map((address) =>
          queryClient.invalidateQueries({ queryKey: queryKeys.roleStatus(config, address) })
        )
      ]);
    } catch (error) {
      const message = getFriendlyErrorMessage(error, "publish-credential-set");
      draftManager.setDraftError(message);
      if (/管理会话/.test(message)) {
        governmentSession.clearSession();
      }
      await dialog.showError({
        title: governmentCopy.publishDialog.errorTitle,
        description: governmentCopy.publishDialog.errorDescription,
        details: getErrorDetails(error, `${governmentCopy.publishDialog.errorTitle}。`)
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.governmentCredentialSetState(config, wallet.address) });
    } finally {
      draftManager.setPublishing(false);
    }
  }

  if (!governmentAccess.allowed) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-12 sm:px-6 lg:px-8">
        <RoleAccessStateCard
          access={governmentAccess}
          wallet={wallet}
          onConnect={connectWallet}
          onSwitch={switchToExpectedChain}
        />
        {walletError ? <p className="text-sm text-brand-seal">{walletError}</p> : null}
      </div>
    );
  }

  if (!hasManagementData) {
    return (
      <div className="bg-bg-paper py-12">
        <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-ink text-surface">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{governmentCopy.pageTitle}</h1>
              <p className="text-sm text-text-muted">{governmentCopy.loadingState.pageSubtitle}</p>
            </div>
          </div>

          <div className="card space-y-4">
            <div className="text-sm font-medium">
              {managementStateQuery.isPending
                ? governmentCopy.loadingState.loadingMessage
                : governmentCopy.loadingState.errorMessage}
            </div>
            <div className="text-sm text-text-muted">{governmentCopy.loadingState.helperText}</div>
            {managementStateQuery.error ? (
              <div className="text-sm text-brand-seal">
                {getFriendlyErrorMessage(managementStateQuery.error, "publish-credential-set")}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void managementStateQuery.refetch()}
              disabled={managementStateQuery.isFetching}
              className="btn-primary flex items-center gap-2"
            >
              <RefreshCw size={18} className={managementStateQuery.isFetching ? "animate-spin" : ""} />
              <span>{managementStateQuery.isFetching ? "刷新中..." : governmentCopy.loadingState.reloadButton}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const resolvedManagementState = managementState!;
  const latestDraftSnapshot = draftManager.preparedSnapshot ?? resolvedManagementState.latestDraftSnapshot;
  const latestDraftPendingApplicantCount = draftManager.preparedSnapshot
    ? draftManager.preparedPendingApplicantAddresses.length
    : resolvedManagementState.draftPendingApplicantAddresses.length;
  const publishedRecordCount = resolvedManagementState.currentPublishedSnapshot?.input.records.length ?? 0;
  const draftNewRecordCount = Math.max((draftManager.draft?.records.length ?? 0) - publishedRecordCount, 0);

  return (
    <div className="bg-bg-paper py-12">
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-ink text-surface">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{governmentCopy.pageTitle}</h1>
              <p className="text-sm text-text-muted">{governmentCopy.pageSubtitle}</p>
            </div>
          </div>
          <div className="rounded-full bg-brand-ink/5 px-3 py-1 text-xs font-semibold text-brand-ink">
            {currentSet ? governmentCopy.currentSet.versionBadge(currentSet.version) : governmentCopy.currentSet.unpublishedBadge}
          </div>
        </div>

        <section className="card space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{governmentCopy.currentSet.sectionTitle}</h2>
              <p className="text-sm text-text-muted">{governmentCopy.currentSet.description}</p>
            </div>
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={draftManager.isPublishing || !draftManager.draft}
              aria-busy={draftManager.isPublishing}
              className="btn-primary flex min-w-[12.5rem] items-center justify-center gap-2"
            >
              <RefreshCw size={18} className={draftManager.isPublishing ? "animate-spin" : ""} />
              <span>{draftManager.isPublishing ? governmentCopy.publishButton.loadingLabel : publishButtonLabel}</span>
            </button>
          </div>

          <div className="grid gap-4 rounded-2xl border border-line-soft bg-bg-paper p-5 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-2">
              <div className="text-sm font-medium">{currentSet ? governmentCopy.currentSet.published : governmentCopy.currentSet.unpublished}</div>
              <div className="text-xs text-text-muted">
                {currentSet
                  ? governmentCopy.currentSet.updatedAtLabel(formatDateTime(currentSet.updatedAt))
                  : governmentCopy.currentSet.afterPublishHint}
              </div>
            </div>
            <div className="rounded-xl border border-line-soft bg-surface px-4 py-3 text-xs text-text-muted">
              {latestDraftSnapshot
                ? governmentCopy.currentSet.latestDraftLabel(
                    latestDraftSnapshot.version,
                    latestDraftPendingApplicantCount
                  )
                : governmentCopy.currentSet.noDraft}
            </div>
          </div>
        </section>

        <div className="grid items-start gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-8">
            <section className="space-y-4">
              <h3 className="text-base font-semibold">{governmentCopy.draft.sectionTitle}</h3>
              <div className="card overflow-hidden p-0">
                <div className="border-b border-line-soft bg-[linear-gradient(180deg,rgba(246,241,232,0.84),rgba(246,241,232,0.4))] px-5 py-3.5 md:px-6">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-surface/80 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-text-muted uppercase">
                          {governmentCopy.draft.entryBadge}
                        </div>
                        <div className="rounded-2xl border border-line-soft bg-surface/90 px-4 py-2 shadow-[0_14px_28px_-26px_rgba(34,50,74,0.5)]">
                          <label htmlFor="reference-date" className="text-xs font-semibold tracking-[0.14em] text-text-muted uppercase">
                            {governmentCopy.draft.referenceDateLabel}
                          </label>
                          <input
                            id="reference-date"
                            type="date"
                            value={draftManager.draft ? referenceDateToInputValue(draftManager.draft.referenceDate) : ""}
                            onChange={(event) => {
                              if (!draftManager.draft) {
                                return;
                              }

                              const referenceDate = parseReferenceDateInput(event.target.value);
                              draftManager.updateDraft({
                                ...draftManager.draft,
                                referenceDate: referenceDate ?? 0
                              });
                            }}
                            className="mt-1 w-full border-0 bg-transparent px-0 py-0 text-sm font-semibold text-brand-ink outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-brand-ink/10 bg-brand-ink/[0.05] px-3 py-1 text-xs text-brand-ink">
                          <span className="h-2 w-2 rounded-full bg-brand-ink" />
                          <span>{governmentCopy.draft.publishedCountLabel(publishedRecordCount)}</span>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-brand-seal/10 bg-brand-seal/[0.08] px-3 py-1 text-xs text-brand-seal">
                          <span className="h-2 w-2 rounded-full bg-brand-seal" />
                          <span>{governmentCopy.draft.pendingCountLabel(draftNewRecordCount)}</span>
                        </div>
                        <button type="button" onClick={draftManager.handleResetDraft} className="btn-outline flex items-center gap-2 px-4 py-2 text-sm">
                          <RotateCcw size={16} />
                          <span>{governmentCopy.draft.resetButton}</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs leading-5 text-text-muted">{governmentCopy.draft.helperText}</p>
                    {draftManager.referenceDateError ? <p className="text-xs text-brand-seal">{draftManager.referenceDateError}</p> : null}
                    {draftManager.draftError ? <div className="rounded-xl border border-[#F2C7C3] bg-[#FFF2F1] px-4 py-3 text-sm text-brand-seal">{draftManager.draftError}</div> : null}
                  </div>
                </div>

                <div className="px-5 py-4 md:px-6 md:py-5">
                  <div className="rounded-[26px] border border-line-soft bg-[#FCFAF6] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_20px_40px_-40px_rgba(34,50,74,0.35)]">
                    <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-2 text-[11px] text-text-muted md:px-5">
                      <span className="rounded-full bg-brand-ink/6 px-2.5 py-1 font-medium text-brand-ink">
                        {governmentCopy.draft.targetVersionLabel(draftManager.draft?.version)}
                      </span>
                      <span className="rounded-full bg-surface px-2.5 py-1">{governmentCopy.draft.totalCountLabel(draftManager.draft?.records.length ?? 0)}</span>
                      <span className="rounded-full bg-surface px-2.5 py-1">{governmentCopy.draft.grantAccessLabel}</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] table-fixed">
                        <thead>
                          <tr className="text-left">
                            <th className="w-16 px-5 py-2.5 text-xs font-semibold tracking-[0.16em] text-text-muted uppercase">{governmentCopy.draft.indexColumn}</th>
                            <th className="w-[44%] px-5 py-2.5 text-xs font-semibold tracking-[0.16em] text-text-muted uppercase">{governmentCopy.draft.addressColumn}</th>
                            <th className="w-[28%] px-5 py-2.5 text-xs font-semibold tracking-[0.16em] text-text-muted uppercase">{governmentCopy.draft.applicantLabelColumn}</th>
                            <th className="w-[18%] px-5 py-2.5 text-xs font-semibold tracking-[0.16em] text-text-muted uppercase">{governmentCopy.draft.statusColumn}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {draftManager.draft?.records.length ? (
                            draftManager.draft.records.map((record, index) => {
                              const isPublishedRecord = index < publishedRecordCount;

                              return (
                                <tr
                                  key={`${record.applicantAddress}-${index}`}
                                  className={isPublishedRecord ? "border-t border-line-soft bg-surface/70" : "border-t border-line-soft bg-brand-seal/[0.025]"}
                                >
                                  <td className="px-5 py-2.5 align-middle text-sm font-semibold text-brand-ink">
                                    {index + 1}
                                  </td>
                                  <td className="px-5 py-2.5 align-middle">
                                    <div
                                      title={record.applicantAddress}
                                      className="truncate font-mono text-[12px] leading-5 text-brand-ink"
                                    >
                                      {record.applicantAddress}
                                    </div>
                                    {draftManager.rowErrors[index]?.applicantAddress ? (
                                      <div className="mt-1 text-[11px] text-brand-seal">{draftManager.rowErrors[index]?.applicantAddress}</div>
                                    ) : null}
                                  </td>
                                  <td className="px-5 py-2.5 align-middle text-sm text-brand-ink">
                                    {record.applicantLabel ? (
                                      <div title={record.applicantLabel} className="truncate leading-5">
                                        {record.applicantLabel}
                                      </div>
                                    ) : (
                                      <span className="text-text-muted">{governmentCopy.draft.emptyLabel}</span>
                                    )}
                                  </td>
                                  <td className="px-5 py-2.5 align-middle">
                                    <span
                                      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                        isPublishedRecord
                                          ? "border-brand-ink/10 bg-brand-ink/[0.05] text-brand-ink"
                                          : "border-brand-seal/10 bg-brand-seal/[0.08] text-brand-seal"
                                      }`}
                                    >
                                      <span className={`h-1.5 w-1.5 rounded-full ${isPublishedRecord ? "bg-brand-ink" : "bg-brand-seal"}`} />
                                      <span>{isPublishedRecord ? governmentCopy.draft.publishedLabel : governmentCopy.draft.pendingLabel}</span>
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr className="border-t border-line-soft">
                              <td colSpan={4} className="px-5 py-8 text-center text-sm text-text-muted">
                                {governmentCopy.draft.emptyState}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="border-t border-dashed border-line-soft bg-[linear-gradient(180deg,rgba(246,241,232,0.75),rgba(255,253,252,0.92))] px-4 py-3 md:px-5">
                      <div className="grid gap-3 md:grid-cols-[92px_minmax(0,1.45fr)_minmax(0,1fr)_148px] md:items-center">
                        <div className="inline-flex w-fit items-center rounded-full border border-brand-seal/10 bg-brand-seal/[0.08] px-3 py-1 text-xs font-semibold text-brand-seal">
                          {governmentCopy.draft.newRecordBadge}
                        </div>
                        <input
                          ref={applicantAddressInputRef}
                          type="text"
                          value={draftManager.entryDraft.applicantAddress}
                          onChange={(event) => draftManager.handleEntryChange("applicantAddress", event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              if (draftManager.handleAddRecord()) {
                                requestAnimationFrame(() => applicantAddressInputRef.current?.focus());
                              }
                            }
                          }}
                          className="field-input h-10 rounded-2xl bg-surface/95 py-2 text-sm shadow-[0_14px_28px_-28px_rgba(34,50,74,0.55)]"
                          placeholder={governmentCopy.draft.addressPlaceholder}
                        />
                        <input
                          type="text"
                          value={draftManager.entryDraft.applicantLabel ?? ""}
                          onChange={(event) => draftManager.handleEntryChange("applicantLabel", event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              if (draftManager.handleAddRecord()) {
                                requestAnimationFrame(() => applicantAddressInputRef.current?.focus());
                              }
                            }
                          }}
                          className="field-input h-10 rounded-2xl bg-surface/95 py-2 text-sm shadow-[0_14px_28px_-28px_rgba(34,50,74,0.55)]"
                          placeholder={governmentCopy.draft.labelPlaceholder}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (draftManager.handleAddRecord()) {
                              requestAnimationFrame(() => applicantAddressInputRef.current?.focus());
                            }
                          }}
                          className="btn-outline inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm shadow-[0_16px_30px_-28px_rgba(34,50,74,0.7)]"
                        >
                          <PlusCircle size={16} />
                          <span>{governmentCopy.draft.addButton}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {draftManager.entryError ? <div className="mt-3 rounded-xl border border-[#F2C7C3] bg-[#FFF2F1] px-4 py-3 text-sm text-brand-seal">{draftManager.entryError}</div> : null}
                </div>
              </div>
            </section>

            <div ref={historySectionRef}>
              {historyVisible ? (
                <GovernmentHistorySection
                  records={history}
                  isPending={historyQuery.isPending}
                  isError={historyQuery.isError}
                  errorMessage={getFriendlyErrorMessage(historyQuery.error, "generic")}
                  isRetrying={historyQuery.isFetching}
                  onRetry={() => void historyQuery.refetch()}
                />
              ) : (
                <SectionSkeleton title={governmentCopy.history.sectionTitle} rows={4} />
              )}
            </div>
          </div>

          <div className="space-y-8">
            <section className="space-y-4">
              <h3 className="text-base font-semibold">{governmentCopy.summary.sectionTitle}</h3>
              <div className="card space-y-4">
                <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3 text-sm">
                  <span className="text-text-muted">{governmentCopy.summary.versionLabel}</span>
                  <span className="justify-self-end text-right font-medium">
                    {currentSet ? `v${currentSet.version}` : governmentCopy.currentSet.unpublishedBadge}
                  </span>
                </div>
                <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3 text-sm">
                  <span className="text-text-muted">{governmentCopy.summary.eligibleCountLabel}</span>
                  <span className="justify-self-end text-right font-medium">{currentSet?.eligibleCount ?? 0}</span>
                </div>
                <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-3 text-sm">
                  <span className="text-text-muted">{governmentCopy.summary.summaryHashLabel}</span>
                  <span className="min-w-0 justify-self-end break-all text-right font-mono text-xs leading-5">
                    {currentSet ? currentSet.merkleRoot.toString() : governmentCopy.summary.emptyValue}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
