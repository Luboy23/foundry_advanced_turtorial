"use client";

import { applicantCopy } from "@/lib/copy";
import type { FailureHistoryEntry } from "@/types/domain";
import { formatDateTime } from "@/lib/utils";

/** 申请人异常记录区块的入参。 */
type ApplicantFailureHistorySectionProps = {
  entries: FailureHistoryEntry[];
};

/** 展示本地保存的申请异常记录，帮助用户理解最近失败原因。 */
export function ApplicantFailureHistorySection({ entries }: ApplicantFailureHistorySectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-base font-semibold">{applicantCopy.failureHistoryTitle}</h3>
      <div className="card">
        {entries.length ? (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-line-soft bg-bg-paper p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{entry.title}</span>
                  <span className="text-text-muted">{formatDateTime(entry.timestamp)}</span>
                </div>
                <div className="mt-1 text-sm text-text-muted">{entry.message}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-text-muted">{applicantCopy.failureHistoryEmpty}</div>
        )}
      </div>
    </section>
  );
}
