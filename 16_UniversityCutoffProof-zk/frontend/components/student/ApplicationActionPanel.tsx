import { Button } from "@/components/shared/Button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatAddress } from "@/lib/utils";
import type { Address } from "@/types/contract-config";
import type { ProofStatus, SerializedProofPackage } from "@/types/proof";

type SubmitStatus = "idle" | "submitting" | "confirming" | "success" | "error";

// 学生申请页的动作面板。
// 这里把“钱包连接、申请证明生成、申请提交”三段状态放到同一个区域，帮助学生按顺序完成操作。
export function ApplicationActionPanel({
  walletAddress,
  connectWallet,
  disconnectWallet,
  connecting,
  connected,
  wrongChain,
  switchChain,
  switching,
  canGenerate,
  generateDisabledReason,
  onGenerate,
  proofStatus,
  proofLabel,
  proofProgress,
  proofError,
  proofPackage,
  isGenerating,
  onSubmit,
  canSubmit,
  submitDisabledReason,
  submitStatus
}: {
  walletAddress?: Address;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  connecting: boolean;
  connected: boolean;
  wrongChain: boolean;
  switchChain: () => Promise<void>;
  switching: boolean;
  canGenerate: boolean;
  generateDisabledReason: string | null;
  onGenerate: () => void;
  proofStatus: ProofStatus;
  proofLabel: string;
  proofProgress: number;
  proofError: string | null;
  proofPackage: SerializedProofPackage | null;
  isGenerating: boolean;
  onSubmit: () => void;
  canSubmit: boolean;
  submitDisabledReason?: string | null;
  submitStatus: SubmitStatus;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">提交申请</h2>
          <p className="mt-1 text-sm text-slate-500">只有在达到录取线且申请规则已开放时，才能生成并提交申请。</p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {/* 先确认钱包和链环境，再允许进入证明生成与链上提交。 */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">账户状态</div>
              <div className="mt-1 text-xs text-slate-500">{connected && walletAddress ? formatAddress(walletAddress, 6) : "未连接"}</div>
            </div>
            <StatusBadge label={connected ? (wrongChain ? "链不匹配" : "已连接") : "未连接"} tone={connected ? (wrongChain ? "warning" : "success") : "neutral"} />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {!connected ? (
              <Button onClick={connectWallet} disabled={connecting}>
                {connecting ? "正在连接..." : "连接钱包"}
              </Button>
            ) : (
              <Button variant="outline" onClick={disconnectWallet}>
                断开钱包
              </Button>
            )}
            {wrongChain ? (
              <Button variant="outline" onClick={switchChain} disabled={switching}>
                {switching ? "切换中..." : "切换到目标链"}
              </Button>
            ) : null}
          </div>
        </div>

        {/* 证明生成阶段保留在页面内，是因为它有连续进度与阶段文案，不适合改成结果弹窗。 */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">申请凭证生成</div>
              <div className="mt-1 text-xs text-slate-500">{proofLabel}</div>
            </div>
            <StatusBadge
              label={
                proofStatus === "proof-ready"
                  ? "已生成"
                  : proofStatus === "artifacts-ready"
                    ? "已就绪"
                  : proofStatus === "error"
                    ? "生成失败"
                    : proofStatus === "idle"
                      ? "待生成"
                      : "生成中"
              }
              tone={
                proofStatus === "proof-ready"
                  ? "success"
                  : proofStatus === "artifacts-ready"
                    ? "info"
                  : proofStatus === "error"
                    ? "danger"
                    : proofStatus === "idle"
                      ? "neutral"
                      : "info"
              }
            />
          </div>
          <div className="mt-4 h-2 rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-slate-900 transition-all" style={{ width: `${proofProgress}%` }} />
          </div>
          {proofError ? <div className="mt-3 text-sm text-rose-600">{proofError}</div> : null}
          {generateDisabledReason ? <div className="mt-3 text-sm text-slate-500">{generateDisabledReason}</div> : null}
          <div className="mt-4">
            <Button onClick={onGenerate} disabled={!canGenerate || isGenerating}>
              {isGenerating ? "生成中..." : "生成申请凭证"}
            </Button>
          </div>
        </div>

        {/* 提交阶段只负责把已经生成好的证明送到链上，能否点击完全由上游资格判断控制。 */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">申请提交</div>
              <div className="mt-1 text-xs text-slate-500">生成申请凭证后即可提交，提交成功后等待大学审批。</div>
            </div>
            <StatusBadge
              label={
                submitStatus === "success"
                  ? "已提交"
                  : submitStatus === "error"
                    ? "提交失败"
                    : submitStatus === "confirming"
                      ? "确认中"
                      : submitStatus === "submitting"
                        ? "提交中"
                        : "等待提交"
              }
              tone={
                submitStatus === "success"
                  ? "success"
                  : submitStatus === "error"
                    ? "danger"
                    : submitStatus === "idle"
                      ? "neutral"
                      : "info"
              }
            />
          </div>
          {submitDisabledReason ? <div className="mt-3 text-sm text-slate-500">{submitDisabledReason}</div> : null}
          <div className="mt-4">
            <Button
              onClick={onSubmit}
              disabled={
                !proofPackage ||
                !canSubmit ||
                submitStatus === "submitting" ||
                submitStatus === "confirming" ||
                submitStatus === "success"
              }
            >
              提交申请
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
