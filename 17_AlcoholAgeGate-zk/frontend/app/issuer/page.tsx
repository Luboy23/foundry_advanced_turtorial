"use client";

import { type ChangeEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileUp, Loader2, Search, ShieldCheck, Users, X } from "lucide-react";
import { getAddress, isAddress } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { CredentialSetCard } from "@/components/issuer/CredentialSetCard";
import { AccessGuardHero } from "@/components/shared/AccessGuardHero";
import { StatePanel } from "@/components/shared/StatePanel";
import { useActionFeedback } from "@/hooks/useActionFeedback";
import { useCurrentCredentialSetQuery, useRoleStatusQuery } from "@/hooks/useAppQueries";
import { usePendingActionStore } from "@/hooks/usePendingActionStore";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { getDemoRoleAccessState } from "@/lib/access";
import { ageCredentialRootRegistryAbi, alcoholRoleRegistryAbi } from "@/lib/contracts/abis";
import { formatYmdDate } from "@/lib/domain/age-eligibility";
import { loadSampleIssuerUserListCsv } from "@/lib/domain/examples";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import {
  activateIssuerPendingSet,
  fetchIssuerBuyerStatus,
  fetchIssuerSetSnapshot,
  uploadIssuerBuyerCsv
} from "@/lib/issuer.client";
import { cn, formatAddress, formatDateTime } from "@/lib/utils";
import type { Address } from "@/types/contract-config";

const SAMPLE_ISSUER_CSV_FILE_NAME = "issuer-user-list-demo.csv";

function getDefaultReferenceDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

type CompactMetricProps = {
  label: string;
  value: ReactNode;
  className?: string;
  valueClassName?: string;
};

function CompactMetric({ label, value, className, valueClassName }: CompactMetricProps) {
  return (
    <div className={cn("min-h-[6.25rem] rounded-[1.5rem] bg-bg-ivory p-4", className)}>
      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">{label}</p>
      <div className={cn("mt-3 text-sm font-medium leading-6 text-brand-green", valueClassName)}>{value}</div>
    </div>
  );
}

type CsvExampleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  lines: string[];
  isLoading: boolean;
  isError: boolean;
};

function CsvExampleModal({ isOpen, onClose, lines, isLoading, isError }: CsvExampleModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.36),_rgba(252,247,235,0.18)_48%,_rgba(245,238,220,0.24)_100%)] backdrop-blur-[8px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[2rem] border border-brand-green/12 bg-[linear-gradient(180deg,_rgba(255,253,248,0.98)_0%,_rgba(245,238,220,0.96)_100%)] shadow-2xl"
      >
        <button
          type="button"
          aria-label="关闭弹窗"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/88 text-text-muted transition hover:text-brand-green"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-5 p-6 sm:p-7">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-brand-amber">CSV Example</p>
            <h2 id={titleId} className="text-2xl font-semibold tracking-tight text-brand-green">
              内置 CSV 示例
            </h2>
            <p id={descriptionId} className="max-w-2xl text-sm leading-7 text-text-muted">
              这份示例名单会混合展示成年人和未成年人。上传后，所有格式合法的用户都会进入身份集合，是否满足购酒年龄会在买家验证时按当前 UTC 日期动态判断。
            </p>
          </div>

          {isLoading ? (
            <StatePanel
              title="示例名单正在加载"
              description="系统正在读取内置 CSV 内容，请稍候。"
              className="rounded-[1.5rem] p-5 shadow-none"
            />
          ) : isError ? (
            <StatePanel
              title="示例名单加载失败"
              description="当前未能读取内置 CSV 内容，请稍后刷新页面后重试。"
              tone="danger"
              className="rounded-[1.5rem] p-5 shadow-none"
            />
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <CompactMetric label="示例记录数" value={Math.max(lines.length - 1, 0)} valueClassName="text-2xl font-semibold" />
                <CompactMetric label="CSV 表头" value="walletAddress,birthDate" valueClassName="font-mono text-[11px] leading-5" />
              </div>

              <div className="max-h-[24rem] overflow-y-auto rounded-[1.5rem] bg-white/70 p-4 font-mono text-xs leading-6 text-brand-green">
                {lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IssuerPage() {
  const csvInputId = useId();
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const issuerAccess = getDemoRoleAccessState({
    role: "issuer",
    isConnected: wallet.isConnected,
    wrongChain: wallet.wrongChain,
    address: wallet.address,
    config
  });
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { showError, showSuccess } = useActionFeedback();
  const { upsert: upsertPendingAction, clear: clearPendingAction, findByKind } = usePendingActionStore();
  const [referenceDateInput, setReferenceDateInput] = useState(getDefaultReferenceDate);
  const [csvContent, setCsvContent] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading">("idle");
  const [publishStatus, setPublishStatus] = useState<"idle" | "publishing">("idle");
  const [lookupInput, setLookupInput] = useState("");
  const [lookupAddress, setLookupAddress] = useState<Address | null>(null);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);

  const roleQuery = useRoleStatusQuery(wallet.address, {
    enabled: issuerAccess.allowed
  });

  const currentSetQuery = useCurrentCredentialSetQuery({
    enabled: issuerAccess.allowed
  });

  const issuerSnapshotQuery = useQuery({
    queryKey: ["issuer-set-snapshot"],
    enabled: issuerAccess.allowed,
    queryFn: fetchIssuerSetSnapshot
  });
  const sampleCsvQuery = useQuery({
    queryKey: ["issuer-user-list-demo-csv"],
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: loadSampleIssuerUserListCsv
  });

  const lookupQuery = useQuery({
    queryKey: ["issuer-buyer-status", lookupAddress],
    enabled: Boolean(lookupAddress),
    queryFn: () => fetchIssuerBuyerStatus(lookupAddress!)
  });

  const pendingSummary = issuerSnapshotQuery.data?.pendingSummary ?? null;
  const activeSummary = issuerSnapshotQuery.data?.activeSummary ?? null;
  const pendingPublishAction = findByKind("publish");

  const blocked =
    !wallet.isConnected
      ? "请先连接年龄验证方钱包。"
      : wallet.wrongChain
        ? "当前网络不正确，请切换到项目链。"
        : !wallet.hasWalletClient
          ? "当前钱包尚未完成授权，请点击右上角重新连接钱包后再试。"
          : roleQuery.data && !roleQuery.data.isIssuer
            ? "当前钱包没有年龄验证方权限，无法管理资格集合。"
            : null;

  const publishMismatch = Boolean(
    pendingSummary &&
      currentSetQuery.data &&
      (pendingSummary.baseVersion !== currentSetQuery.data.version ||
        pendingSummary.setId.toLowerCase() !== currentSetQuery.data.setId.toLowerCase())
  );

  const publishBlockedReason =
    blocked ||
    (currentSetQuery.isLoading ? "正在读取当前链上资格集合，请稍候。" : null) ||
    (pendingSummary ? null : "请先上传所有用户名单并生成待发布集合。") ||
    (publishMismatch ? "当前待发布草稿已落后于链上版本，请重新上传名单后再发布。" : null);
  const sampleCsvPreviewLines = useMemo(
    () =>
      (sampleCsvQuery.data ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    [sampleCsvQuery.data]
  );

  const currentOverview = useMemo(
    () => ({
      version: currentSetQuery.data?.version ?? activeSummary?.version ?? null,
      referenceDate: currentSetQuery.data?.referenceDate ?? activeSummary?.referenceDate ?? null,
      updatedAt: currentSetQuery.data?.updatedAt ?? activeSummary?.updatedAt ?? null,
      activeBuyerCount: activeSummary?.memberCount ?? 0
    }),
    [activeSummary, currentSetQuery.data]
  );
  const refetchCurrentSet = currentSetQuery.refetch;
  const refetchIssuerSnapshot = issuerSnapshotQuery.refetch;

  const runPublishSequence = useCallback(async (options?: { skipGrantBuyers?: boolean }) => {
    if (!pendingSummary || publishBlockedReason) {
      return;
    }

    setPublishStatus("publishing");

    if (!walletClient) {
      throw new Error("当前钱包尚未完成授权，请点击右上角重新连接钱包后再试。");
    }
    if (!publicClient) {
      throw new Error("当前页面尚未准备好，请稍后再试。");
    }

    if (!options?.skipGrantBuyers && pendingSummary.newBuyerAddresses.length > 0) {
      const roleHash = await walletClient.writeContract({
        abi: alcoholRoleRegistryAbi,
        address: config.roleRegistryAddress,
        functionName: "setBuyers",
        args: [pendingSummary.newBuyerAddresses, true],
        account: walletClient.account
      });
      upsertPendingAction({
        kind: "publish",
        txHash: roleHash,
        startedAt: Date.now(),
        ownerAddress: wallet.address,
        stage: "grant-buyers",
        metadata: {
          version: pendingSummary.version
        }
      });
      await publicClient.waitForTransactionReceipt({ hash: roleHash });
      clearPendingAction("publish");
    }

    const publishHash = await walletClient.writeContract({
      abi: ageCredentialRootRegistryAbi,
      address: config.rootRegistryAddress,
      functionName: "publishCredentialSet",
      args: [
        pendingSummary.setId,
        BigInt(pendingSummary.merkleRoot),
        pendingSummary.version,
        pendingSummary.referenceDate
      ],
      account: walletClient.account
    });
    upsertPendingAction({
      kind: "publish",
      txHash: publishHash,
      startedAt: Date.now(),
      ownerAddress: wallet.address,
      stage: "publish-set",
      metadata: {
        version: pendingSummary.version
      }
    });

    await publicClient.waitForTransactionReceipt({ hash: publishHash });
    clearPendingAction("publish");
    await activateIssuerPendingSet();
    await Promise.all([refetchCurrentSet(), refetchIssuerSnapshot()]);
    showSuccess({
      title: "资格集合已发布",
      description: `第 ${pendingSummary.version} 版身份集合已经生效。名单中的用户现在都可以领取私有凭证；已满 18 岁的用户可立即验证，未满 18 岁的用户可在达到成年日后重新验证。`
    });
  }, [clearPendingAction, config.roleRegistryAddress, config.rootRegistryAddress, pendingSummary, publicClient, publishBlockedReason, refetchCurrentSet, refetchIssuerSnapshot, showSuccess, upsertPendingAction, wallet.address, walletClient]);

  async function handleCsvSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setCsvContent("");
      setSelectedFileName("");
      return;
    }

    const text = await file.text();
    setCsvContent(text);
    setSelectedFileName(file.name);
  }

  async function handleUploadCsv(args: {
    csvText: string;
    fileName: string;
    readErrorTitle?: string;
  }) {
    if (!args.csvText.trim()) {
      showError({
        title: "名单尚未上传",
        description: "请先选择包含 walletAddress,birthDate 表头的 CSV 文件。"
      });
      return;
    }

    try {
      setUploadStatus("uploading");
      setCsvContent(args.csvText);
      setSelectedFileName(args.fileName);

      const response = await uploadIssuerBuyerCsv({
        csv: args.csvText,
        referenceDate: referenceDateInput
      });

      if (response.pendingSummary) {
        await refetchIssuerSnapshot();
        showSuccess({
          title: "待发布集合已生成",
          description: `本次上传共收录 ${response.pendingSummary.memberCount} 位合法用户，其中当前已成年 ${response.pendingSummary.adultCountNow} 位、未成年 ${response.pendingSummary.minorCountNow} 位，并识别到 ${response.pendingSummary.invalidRows.length} 条格式错误记录。`
        });
        return;
      }

      showError({
        title: "没有生成可发布集合",
        description: response.invalidRows.length
          ? "当前上传文件中的记录均未通过校验，请先修正无效行后重新上传。"
          : "当前上传文件没有可用记录，请检查 CSV 内容后重试。"
      });
    } catch (error) {
      showError({
        title: args.readErrorTitle ?? "名单上传失败",
        description: getFriendlyErrorMessage(error, "generic")
      });
    } finally {
      setUploadStatus("idle");
    }
  }

  async function handleUpload() {
    await handleUploadCsv({
      csvText: csvContent,
      fileName: selectedFileName || "issuer-user-list.csv"
    });
  }

  async function handleUploadSampleCsv() {
    try {
      const sampleCsvText = sampleCsvQuery.data ?? (await loadSampleIssuerUserListCsv());
      await handleUploadCsv({
        csvText: sampleCsvText,
        fileName: SAMPLE_ISSUER_CSV_FILE_NAME
      });
    } catch (error) {
      showError({
        title: "示例文件读取失败",
        description: getFriendlyErrorMessage(error, "generic")
      });
    }
  }

  async function handlePublish() {
    try {
      await runPublishSequence();
    } catch (error) {
      clearPendingAction("publish");
      showError({
        title: "发布失败",
        description: getFriendlyErrorMessage(error, "publish-credential-set")
      });
    } finally {
      setPublishStatus("idle");
    }
  }

  useEffect(() => {
    if (
      !pendingPublishAction ||
      pendingPublishAction.ownerAddress?.toLowerCase() !== wallet.address?.toLowerCase() ||
      !publicClient
    ) {
      return;
    }

    let active = true;
    setPublishStatus("publishing");

    void (async () => {
      try {
        await publicClient.waitForTransactionReceipt({ hash: pendingPublishAction.txHash });
        clearPendingAction("publish");
        if (!active) {
          return;
        }

        if (pendingPublishAction.stage === "grant-buyers") {
          if (walletClient && pendingSummary) {
            await runPublishSequence({ skipGrantBuyers: true });
            return;
          }

          showSuccess({
            title: "买家白名单已同步",
            description: "上一笔白名单同步交易已经确认。请保持年龄验证方钱包连接后，再次点击发布按钮继续发布身份集合。"
          });
          setPublishStatus("idle");
          return;
        }

        await activateIssuerPendingSet();
        await Promise.all([refetchCurrentSet(), refetchIssuerSnapshot()]);
        showSuccess({
          title: "资格集合已发布",
          description: `第 ${pendingSummary?.version ?? ""} 版身份集合已经生效。`
        });
      } catch (error) {
        clearPendingAction("publish");
        if (!active) {
          return;
        }
        showError({
          title: "发布失败",
          description: getFriendlyErrorMessage(error, "publish-credential-set")
        });
        setPublishStatus("idle");
      }
    })();

    return () => {
      active = false;
    };
  }, [clearPendingAction, pendingPublishAction, pendingSummary, publicClient, refetchCurrentSet, refetchIssuerSnapshot, runPublishSequence, showError, showSuccess, wallet.address, walletClient]);

  function handleLookupSubmit() {
    if (!isAddress(lookupInput)) {
      showError({
        title: "查询地址无效",
        description: "请输入合法的 EVM 钱包地址后再查询买家状态。"
      });
      return;
    }

    setLookupAddress(getAddress(lookupInput));
  }

  if (!issuerAccess.allowed) {
    return (
      <AccessGuardHero
        pageLabel="年龄验证方管理"
        title="当前不能进入年龄验证方页面"
        reason={issuerAccess.description ?? "当前钱包没有进入年龄验证方页面的权限。"}
      />
    );
  }

  return (
    <div className="space-y-6 lg:space-y-7">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center rounded-full bg-brand-amber/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-amber">
            Issuer Console
          </div>
          <h1 className="text-3xl font-semibold text-brand-green">年龄验证方管理</h1>
          <p className="max-w-3xl text-sm leading-6 text-text-muted">
            上传全部合法用户名单后，系统会为每位用户生成身份凭证并构建待发布集合。是否达到购酒年龄会在买家验证时按当前 UTC 日期动态判断，而不是在上传阶段提前筛掉。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border border-brand-green/10 bg-surface/80 px-4 py-2 text-sm font-medium text-brand-green">
            当前链上版本 {currentOverview.version ?? "暂无"}
          </div>
          <div className="rounded-full border border-brand-green/10 bg-surface/80 px-4 py-2 text-sm font-medium text-brand-green">
            集合成员 {currentOverview.activeBuyerCount}
          </div>
        </div>
      </header>

      {blocked ? (
        <StatePanel
          title="当前不能执行年龄验证方操作"
          description={blocked}
          tone="warning"
          className="rounded-[1.75rem] p-5 shadow-none"
        />
      ) : null}

      <CredentialSetCard
        credentialSet={currentSetQuery.data ?? null}
        activeBuyerCount={currentOverview.activeBuyerCount}
      />

      <CsvExampleModal
        isOpen={sampleModalOpen}
        onClose={() => setSampleModalOpen(false)}
        lines={sampleCsvPreviewLines}
        isLoading={sampleCsvQuery.isLoading}
        isError={sampleCsvQuery.isError}
      />

      <section className="grid items-start gap-5 xl:grid-cols-2">
        <section className="glass-card space-y-4 p-5 lg:p-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-amber/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand-amber">
              <FileUp className="h-3.5 w-3.5" />
              名单上传
            </div>
            <h2 className="text-xl font-semibold text-brand-green">上传所有用户名单</h2>
            <p className="text-sm leading-6 text-text-muted">
              仅支持 CSV，表头固定为 <span className="font-mono text-brand-green">walletAddress,birthDate</span>，其中生日格式为
              <span className="font-mono text-brand-green"> YYYY-MM-DD</span>。系统会把所有格式合法的用户收录进身份集合，并为每位用户生成可领取的私有凭证；只有格式异常记录会进入无效行。
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-brand-green">参考日期</span>
              <input
                type="date"
                value={referenceDateInput}
                onChange={(event) => setReferenceDateInput(event.target.value)}
                className="w-full rounded-2xl border border-brand-green/12 bg-bg-ivory px-4 py-3 text-sm text-brand-green outline-none transition focus:border-brand-amber"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-brand-green">CSV 文件</span>
              <div className="relative flex min-h-[3rem] w-full items-center gap-3 rounded-2xl border border-brand-green/12 bg-bg-ivory px-4 py-2.5 text-sm text-brand-green transition focus-within:border-brand-amber">
                <input
                  id={csvInputId}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    void handleCsvSelect(event);
                  }}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <span className="pointer-events-none inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-brand-green px-4 text-[13px] font-semibold leading-none text-paper-white">
                  选择文件
                </span>
                <span className="min-w-0 truncate text-sm leading-5 text-brand-green">
                  {selectedFileName || "尚未选择文件"}
                </span>
              </div>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <CompactMetric label="当前链上版本" value={currentOverview.version ?? "暂无"} valueClassName="text-2xl font-semibold" />
            <CompactMetric label="下次待发布版本" value={(currentOverview.version ?? 0) + 1} valueClassName="text-2xl font-semibold" />
            <CompactMetric
              label="当前文件"
              value={selectedFileName || "尚未选择文件"}
              className="sm:col-span-2 xl:col-span-1"
              valueClassName="break-all text-sm leading-6"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              disabled={Boolean(blocked) || uploadStatus === "uploading"}
              onClick={() => {
                void handleUpload();
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-green px-2 text-[13px] font-semibold whitespace-nowrap text-paper-white transition hover:bg-brand-green/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadStatus === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "上传生成"}
            </button>
            <button
              type="button"
              disabled={Boolean(blocked) || uploadStatus === "uploading"}
              onClick={() => {
                void handleUploadSampleCsv();
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-brand-green px-2 text-[13px] font-semibold whitespace-nowrap text-brand-green transition hover:bg-brand-green hover:text-paper-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadStatus === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "示例上传"}
            </button>
            <button
              type="button"
              onClick={() => setSampleModalOpen(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-brand-green px-2 text-[13px] font-semibold whitespace-nowrap text-brand-green transition hover:bg-brand-green hover:text-paper-white"
            >
              查看示例
            </button>
            <button
              type="button"
              onClick={() => {
                setCsvContent("");
                setSelectedFileName("");
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-brand-green px-2 text-[13px] font-semibold whitespace-nowrap text-brand-green transition hover:bg-brand-green hover:text-paper-white"
            >
              清空
            </button>
          </div>
        </section>

        <section className="glass-card space-y-4 p-5 lg:p-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-green/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand-green">
              <Users className="h-3.5 w-3.5" />
              待发布集合
            </div>
            <h2 className="text-xl font-semibold text-brand-green">待发布集合预览</h2>
            <p className="text-sm leading-6 text-text-muted">上传名单后，会先在这里预览身份集合总人数、当前已成年 / 未成年人数、Merkle Root 和待新增的 buyer 地址数量。</p>
          </div>

          {pendingSummary ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <CompactMetric label="待发布版本" value={pendingSummary.version} valueClassName="text-2xl font-semibold" />
                <CompactMetric label="集合总人数" value={pendingSummary.memberCount} valueClassName="text-2xl font-semibold" />
                <CompactMetric label="当前已成年" value={pendingSummary.adultCountNow} valueClassName="text-2xl font-semibold" />
                <CompactMetric label="当前未成年" value={pendingSummary.minorCountNow} valueClassName="text-2xl font-semibold" />
                <CompactMetric label="格式错误行" value={pendingSummary.invalidRows.length} valueClassName="text-2xl font-semibold" />
                <CompactMetric label="待新增 buyer" value={pendingSummary.newBuyerCount} valueClassName="text-2xl font-semibold" />
              </div>

              <div className="rounded-[1.5rem] bg-bg-ivory p-4 text-sm text-text-muted">
                <p className="text-xs uppercase tracking-[0.22em] text-text-muted">待发布 Merkle Root</p>
                <p className="mt-3 break-all font-mono text-[11px] leading-6 text-brand-green">{pendingSummary.merkleRoot}</p>
                <p className="mt-3 text-sm leading-6 text-text-muted">参考日期：{formatDateTime(pendingSummary.referenceDate)}</p>
              </div>
            </div>
          ) : (
            <StatePanel
              title="当前还没有待发布集合"
              description="先上传所有用户名单，系统会先生成身份集合草稿，并在这里展示总人数、当前成年状态与待发布 Root 预览。"
              className="rounded-[1.5rem] p-5 shadow-none"
            />
          )}
        </section>
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-2">
        <section className="glass-card space-y-4 p-5 lg:p-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-amber/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand-amber">
              <ShieldCheck className="h-3.5 w-3.5" />
              发布操作
            </div>
            <h2 className="text-xl font-semibold text-brand-green">发布资格集合</h2>
            <p className="text-sm leading-6 text-text-muted">发布时会先把本次名单中的所有新地址加入 buyer 白名单，再把新的身份集合发布到链上并激活。年龄是否满足 18 岁，将在买家自己验证时动态判断。</p>
          </div>

          {pendingSummary ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <CompactMetric label="待发布版本" value={pendingSummary.version} valueClassName="text-2xl font-semibold" />
              <CompactMetric label="待新增 buyer" value={pendingSummary.newBuyerCount} valueClassName="text-2xl font-semibold" />
            </div>
          ) : null}

          {publishBlockedReason ? (
            <StatePanel
              title="当前还不能发布"
              description={publishBlockedReason}
              tone="warning"
              className="rounded-[1.5rem] p-5 shadow-none"
            />
          ) : (
            <div className="rounded-[1.5rem] border border-brand-green/10 bg-bg-ivory/55 p-4 text-sm leading-6 text-text-muted">
              当前待发布集合已准备完成，确认后系统会先同步 buyer 白名单，再把新的身份集合发布到链上。
            </div>
          )}

          <button
            type="button"
            disabled={Boolean(publishBlockedReason) || publishStatus === "publishing"}
            onClick={() => {
              void handlePublish();
            }}
            className="btn-primary w-full gap-2"
          >
            {publishStatus === "publishing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {publishStatus === "publishing" ? "正在发布..." : "发布当前待发布集合"}
          </button>
        </section>

        <section className="glass-card space-y-4 p-5 lg:p-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-green/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand-green">
              <Search className="h-3.5 w-3.5" />
              状态查询
            </div>
            <h2 className="text-xl font-semibold text-brand-green">买家资格查询</h2>
            <p className="text-sm leading-6 text-text-muted">按钱包地址查询该用户是否已纳入当前活跃集合、是否可领取凭证、当前是否已满足年龄条件以及链上资格状态。</p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-brand-green">买家钱包地址</span>
              <input
                type="text"
                value={lookupInput}
                onChange={(event) => setLookupInput(event.target.value.trim())}
                placeholder="输入买家钱包地址"
                className="min-w-0 w-full rounded-2xl border border-brand-green/12 bg-bg-ivory px-4 py-3 text-sm text-brand-green outline-none transition focus:border-brand-amber"
              />
            </label>
            <button type="button" onClick={handleLookupSubmit} className="btn-outline gap-2 md:self-end">
              <Search className="h-4 w-4" />
              查询
            </button>
          </div>

          {lookupQuery.isLoading ? (
            <StatePanel
              title="正在查询买家状态"
              description="系统正在读取该地址的资格信息，请稍候。"
              className="rounded-[1.5rem] p-5 shadow-none"
            />
          ) : lookupQuery.isError ? (
            <StatePanel
              title="查询失败"
              description="当前暂时无法读取该买家的资格状态，请稍后重试。"
              tone="danger"
              className="rounded-[1.5rem] p-5 shadow-none"
            />
          ) : lookupQuery.data ? (
            <div className="space-y-3 text-sm text-text-muted">
              <CompactMetric
                label="查询地址"
                value={formatAddress(lookupQuery.data.address)}
                className="min-h-0"
                valueClassName="font-mono text-xs break-all"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <CompactMetric label="在当前活跃集合内" value={lookupQuery.data.inActiveSet ? "是" : "否"} valueClassName="text-xl font-semibold" />
                <CompactMetric label="可领取私有凭证" value={lookupQuery.data.hasClaimableCredential ? "是" : "否"} valueClassName="text-xl font-semibold" />
                <CompactMetric label="链上 buyer 权限" value={lookupQuery.data.isBuyer ? "是" : "否"} valueClassName="text-xl font-semibold" />
                <CompactMetric label="链上资格当前有效" value={lookupQuery.data.eligibility?.isCurrent ? "是" : "否"} valueClassName="text-xl font-semibold" />
                <CompactMetric label="当前已满足年龄条件" value={lookupQuery.data.currentlyEligible ? "是" : "否"} valueClassName="text-xl font-semibold" />
                <CompactMetric
                  label="最早可验证日期"
                  value={lookupQuery.data.eligibleFromYmd ? formatYmdDate(lookupQuery.data.eligibleFromYmd) : "暂无"}
                  valueClassName="text-sm font-medium leading-6"
                />
              </div>

              <div className="rounded-[1.5rem] bg-bg-ivory p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">最近验证时间</p>
                <p className="mt-3 text-sm font-medium leading-6 text-brand-green">
                  {lookupQuery.data.eligibility?.verifiedAt
                    ? formatDateTime(lookupQuery.data.eligibility.verifiedAt)
                    : "暂无"}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-brand-green/10 bg-bg-ivory/55 p-4 text-sm leading-6 text-text-muted">
              输入钱包地址后，这里会展示该用户是否已在当前身份集合内、是否已满足年龄条件，以及最近一次年龄验证时间。
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
