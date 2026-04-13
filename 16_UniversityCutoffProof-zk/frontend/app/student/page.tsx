"use client";

import { ChangeEvent, useMemo } from "react";
import { GraduationCap } from "lucide-react";
import { buttonClassName } from "@/components/shared/Button";
import { RoleGate } from "@/components/shared/RoleGate";
import { AdmissionInfoCard } from "@/components/student/AdmissionInfoCard";
import { ApplicationRecordList } from "@/components/student/ApplicationRecordList";
import { StudentScorePanel } from "@/components/student/StudentScorePanel";
import { UniversityEligibilityList } from "@/components/student/UniversityEligibilityList";
import { ChainGuardNotice } from "@/components/wallet/ChainGuardNotice";
import { EmptyState, ErrorState, InfoNotice } from "@/components/shared/StatePanels";
import { useCredentialParser } from "@/hooks/useCredentialParser";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useStudentWorkbench } from "@/hooks/useStudentWorkbench";
import { useWalletStatus } from "@/hooks/useWalletStatus";

// 学生工作台主页面。
// 这页只展示三类真相：当前成绩凭证、后端 workbench 返回的规则/申请状态、辅助记录。
function StudentPageContent() {
  const { config } = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const { credential, fileName, error, isParsing, importFile, importFromUrl, resetCredential } =
    useCredentialParser(config);
  const workbench = useStudentWorkbench({
    walletAddress: wallet.address,
    enabled: wallet.isConnected
  });

  const currentFrozenVersions = useMemo(
    () =>
      [workbench.currentFrozenVersions.pku, workbench.currentFrozenVersions.jiatingdun].filter(
        (version): version is NonNullable<typeof version> => Boolean(version)
      ),
    [workbench.currentFrozenVersions]
  );

  // 成绩凭证仍然是学生本地持有的离线材料，导入入口在学生页顶部统一收口。
  function handleCredentialImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void importFile(file);
    event.target.value = "";
  }

  function handleLoadDemoCredential() {
    void importFromUrl("/examples/sample-credential.json", "sample-credential.json");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">学生工作台</h1>
              <p className="mt-1 text-sm text-slate-500">查看成绩、可申请学校和申请记录。</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className={buttonClassName("outline", "md")}>
              导入成绩凭证
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleCredentialImport}
              />
            </label>
            <button
              type="button"
              className={buttonClassName("outline", "md")}
              onClick={handleLoadDemoCredential}
              disabled={isParsing}
            >
              {isParsing ? "导入中..." : "导入演示凭证"}
            </button>
            <button
              type="button"
              className={buttonClassName("ghost", "md")}
              onClick={resetCredential}
            >
              清除当前成绩凭证
            </button>
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
          description="你仍可查看成绩和学校信息；连接钱包后才能读取申请记录并完成申请。"
        />
      ) : null}

      {error ? <ErrorState title="凭证读取失败" description={error} /> : null}
      {workbench.isError ? (
        <ErrorState title="学生工作台读取失败" description="当前无法读取学生侧聚合数据。" />
      ) : null}
      {workbench.syncStatus.stale && workbench.syncStatus.partialErrors.length ? (
        <InfoNotice
          title="链上状态部分滞后"
          description={workbench.syncStatus.partialErrors.join(" ")}
          tone="warning"
        />
      ) : null}
      {!workbench.isLoading && !workbench.latestActiveSource ? (
        <InfoNotice
          title="考试院尚未发布本届成绩源"
          description="请先等待考试院上传并发布本届成绩，之后再导入成绩凭证和查看申请资格。"
          tone="warning"
        />
      ) : null}
      {!workbench.isLoading && workbench.latestActiveSource && !currentFrozenVersions.length ? (
        <InfoNotice
          title="大学尚未开放申请"
          description="考试院已经发布本届成绩，但大学还没有发布可用的申请规则。"
          tone="warning"
        />
      ) : null}

      <StudentScorePanel
        credential={credential}
        publishedSourceTitle={workbench.latestActiveSource?.sourceTitle ?? null}
        fileName={fileName}
      />

      <AdmissionInfoCard application={workbench.currentApplication} />

      {!credential ? (
        <EmptyState
          title="请先导入成绩凭证"
          description="请导入考试院发放的成绩凭证后，再查看自己的申请资格和申请记录。"
        />
      ) : null}

      {credential ? (
        // 可申请学校只来自“已开放且已冻结”的规则，不会把草稿或同步中的规则提前展示给学生。
        <UniversityEligibilityList
          score={credential.score}
          versions={currentFrozenVersions}
          currentApplication={workbench.currentApplication}
        />
      ) : null}

      <ApplicationRecordList
        onchainRecords={workbench.onchainRecords}
        localBlockedRecords={workbench.localBlockedRecords}
      />
    </div>
  );
}

export default function StudentPage() {
  return <RoleGate expectedRole="student">{() => <StudentPageContent />}</RoleGate>;
}
