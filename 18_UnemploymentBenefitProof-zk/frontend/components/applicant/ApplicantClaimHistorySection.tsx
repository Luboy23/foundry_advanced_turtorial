"use client";

import { applicantCopy } from "@/lib/copy";
import type { BenefitClaimRecord } from "@/types/domain";
import { formatDateTime, formatEth } from "@/lib/utils";

/** 申请人到账记录区块的入参。 */
type ApplicantClaimHistorySectionProps = {
  records: BenefitClaimRecord[];
  isPending: boolean;
  isError: boolean;
  errorMessage: string;
  isRetrying: boolean;
  onRetry: () => void;
};

/** 申请人补助到账记录区块。 */
export function ApplicantClaimHistorySection({
  records,
  isPending,
  isError,
  errorMessage,
  isRetrying,
  onRetry
}: ApplicantClaimHistorySectionProps) {
  return (
    <section className="space-y-4" id="claim-records">
      <h3 className="text-base font-semibold">{applicantCopy.claimHistoryTitle}</h3>
      <div className="card">
        {isError && !records.length ? (
          <div className="space-y-4">
            <div className="text-sm font-medium text-brand-seal">补助到账记录读取失败</div>
            <div className="text-sm text-text-muted">{errorMessage}</div>
            <button type="button" onClick={onRetry} disabled={isRetrying} className="btn-outline">
              {isRetrying ? "重新同步中..." : "重新同步到账记录"}
            </button>
          </div>
        ) : isPending ? (
          <div className="py-6 text-center text-sm text-text-muted">{applicantCopy.claimHistoryLoading}</div>
        ) : records.length ? (
          <div className="space-y-3">
            {records.map((record) => (
              <div key={record.txHash ?? record.nullifierHash} className="rounded-xl border border-line-soft bg-bg-paper p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{formatEth(record.amountWei)}</span>
                  <span className="text-text-muted">{formatDateTime(record.claimedAt)}</span>
                </div>
                <div className="mt-1 text-xs text-text-muted">{applicantCopy.claimHistoryVersionLabel(record.rootVersion)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-text-muted">{applicantCopy.claimHistoryEmpty}</div>
        )}
      </div>
    </section>
  );
}
