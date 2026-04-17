"use client";

import { governmentCopy } from "@/lib/copy";
import type { CredentialSetPublishRecord } from "@/types/domain";
import { formatDateTime } from "@/lib/utils";

/** 政府端更新记录区块的入参。 */
type GovernmentHistorySectionProps = {
  records: CredentialSetPublishRecord[];
  isPending: boolean;
  isError: boolean;
  errorMessage: string;
  isRetrying: boolean;
  onRetry: () => void;
};

/** 资格名单发布历史区块。 */
export function GovernmentHistorySection({
  records,
  isPending,
  isError,
  errorMessage,
  isRetrying,
  onRetry
}: GovernmentHistorySectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-base font-semibold">{governmentCopy.history.sectionTitle}</h3>
      <div className="card overflow-hidden p-0">
        <table className="soft-table w-full">
          <thead>
            <tr>
              <th>{governmentCopy.history.timeColumn}</th>
              <th>{governmentCopy.history.actionColumn}</th>
              <th>{governmentCopy.history.versionColumn}</th>
              <th>{governmentCopy.history.eligibleCountColumn}</th>
            </tr>
          </thead>
          <tbody>
            {isError && !records.length ? (
              <tr className="border-t border-line-soft">
                <td colSpan={4} className="px-4 py-6">
                  <div className="space-y-3 text-left">
                    <div className="text-sm font-medium text-brand-seal">更新记录读取失败</div>
                    <div className="text-sm text-text-muted">{errorMessage}</div>
                    <button type="button" onClick={onRetry} disabled={isRetrying} className="btn-outline">
                      {isRetrying ? "重新同步中..." : "重新同步更新记录"}
                    </button>
                  </div>
                </td>
              </tr>
            ) : isPending ? (
              <tr className="border-t border-line-soft">
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-text-muted">
                  {governmentCopy.history.loading}
                </td>
              </tr>
            ) : records.length ? (
              records.map((record) => (
                <tr key={`${record.version}-${record.txHash}`} className="border-t border-line-soft">
                  <td>{formatDateTime(record.timestamp)}</td>
                  <td>{governmentCopy.history.publishAction(record.version)}</td>
                  <td>{`v${record.version}`}</td>
                  <td>{record.eligibleCount}</td>
                </tr>
              ))
            ) : (
              <tr className="border-t border-line-soft">
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-text-muted">
                  {governmentCopy.history.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
