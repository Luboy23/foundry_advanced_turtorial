"use client";

import { agencyCopy } from "@/lib/copy";
import type { BenefitClaimRecord } from "@/types/domain";
import { formatDateTime, formatEth } from "@/lib/utils";

/** 发放记录区块的入参。 */
type AgencyClaimHistorySectionProps = {
  records: BenefitClaimRecord[];
  isPending: boolean;
  isError: boolean;
  errorMessage: string;
  isRetrying: boolean;
  onRetry: () => void;
};

/** 发放机构工作台的发放记录区块。 */
export function AgencyClaimHistorySection({
  records,
  isPending,
  isError,
  errorMessage,
  isRetrying,
  onRetry
}: AgencyClaimHistorySectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-base font-semibold">{agencyCopy.history.title}</h3>
      <div className="card overflow-hidden p-0">
        <table className="soft-table w-full">
          <thead>
            <tr>
              <th>{agencyCopy.history.timeColumn}</th>
              <th>{agencyCopy.history.recipientColumn}</th>
              <th>{agencyCopy.history.amountColumn}</th>
              <th>{agencyCopy.history.versionColumn}</th>
            </tr>
          </thead>
          <tbody>
            {isError && !records.length ? (
              <tr className="border-t border-line-soft">
                <td colSpan={4} className="px-4 py-6">
                  <div className="space-y-3 text-left">
                    <div className="text-sm font-medium text-brand-seal">发放记录读取失败</div>
                    <div className="text-sm text-text-muted">{errorMessage}</div>
                    <button type="button" onClick={onRetry} disabled={isRetrying} className="btn-outline">
                      {isRetrying ? "重新同步中..." : "重新同步发放记录"}
                    </button>
                  </div>
                </td>
              </tr>
            ) : isPending ? (
              <tr className="border-t border-line-soft">
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-text-muted">
                  {agencyCopy.history.loading}
                </td>
              </tr>
            ) : records.length ? (
              records.map((record) => (
                <tr key={record.txHash ?? record.nullifierHash} className="border-t border-line-soft">
                  <td>{formatDateTime(record.claimedAt)}</td>
                  <td className="font-mono text-xs">{record.recipient}</td>
                  <td>{formatEth(record.amountWei)}</td>
                  <td>{`v${record.rootVersion}`}</td>
                </tr>
              ))
            ) : (
              <tr className="border-t border-line-soft">
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-text-muted">
                  {agencyCopy.history.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
