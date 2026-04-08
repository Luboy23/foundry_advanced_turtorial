import type { ReactNode } from 'react'
import type { ChainRunRecord } from '../../../lib/contract'
import { formatDuration, formatNumber, formatTimestamp } from '../../../shared/utils/format'
import { Modal } from '../Modal'
import { modalInsetClass, modalSectionClass, parchmentBadgeClass } from '../buttonStyles'

/** 历史弹窗：仅展示链上已结算记录，不展示本地未上链战绩。 */
type HistoryModalProps = {
  isOpen: boolean
  connected: boolean
  hasContractAddress: boolean
  entries: ChainRunRecord[]
  isLoading: boolean
  isError: boolean
  isLoadingMore: boolean
  hasMore: boolean
  total: number
  onRetry: () => void
  onLoadMore: () => void
  onClose: () => void
}

/**
 * 历史战绩弹窗：
 * - 仅展示链上 `getUserHistory` 的结果；
 * - 不混入本地未上链战绩，避免玩家误解。
 */
export default function HistoryModal({
  isOpen,
  connected,
  hasContractAddress,
  entries,
  isLoading,
  isError,
  isLoadingMore,
  hasMore,
  total,
  onRetry,
  onLoadMore,
  onClose,
}: HistoryModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="历史战绩"
      panelClassName="max-w-2xl"
    >
      {!connected ? (
        // 先连接钱包才能读取该地址对应的个人历史。
        <HistoryState tone="error">请先连接钱包查看你的历史战绩。</HistoryState>
      ) : !hasContractAddress ? (
        <HistoryState tone="error">合约地址未配置，请先执行 make deploy。</HistoryState>
      ) : isLoading ? (
        <HistoryState>正在读取历史战绩...</HistoryState>
      ) : isError ? (
        <HistoryState tone="error">
          <p>历史战绩读取失败，请检查 RPC 或地址配置。</p>
          <button
            className="mt-3 inline-flex h-9 items-center justify-center rounded-[0.9rem] border border-[rgba(181,57,34,0.16)] bg-[rgba(255,255,255,0.94)] px-3 text-xs font-semibold text-[var(--accent-vermilion)] shadow-[0_8px_18px_rgba(0,0,0,0.08)]"
            onClick={onRetry}
            type="button"
          >
            重试读取
          </button>
        </HistoryState>
      ) : entries.length === 0 ? (
        <HistoryState>暂无历史战绩</HistoryState>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-1 text-[11px] text-[var(--ink-500)]">
            <p>已显示 {entries.length} 条记录</p>
            <span className={`${parchmentBadgeClass} px-2.5 py-1 text-[11px] font-semibold`}>
              总计 {formatNumber(total)}
            </span>
          </div>
          <ol className="space-y-3">
            {entries.map((entry, index) => (
              <li className={`${modalSectionClass} px-4 py-3`} key={`history-${entry.endedAt}-${entry.kills}-${index}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.22em] text-[var(--ink-500)]">第 {String(index + 1).padStart(2, '0')} 局</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--ink-900)]">击杀 {formatNumber(entry.kills)}</p>
                  </div>
                  <span className={`${parchmentBadgeClass} px-2.5 py-1 text-[11px] font-semibold`}>
                    金币 {formatNumber(entry.goldEarned)}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className={`${modalInsetClass} px-3 py-2`}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">用时</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink-900)]">{formatDuration(entry.survivalMs)}</p>
                  </div>
                  <div className={`${modalInsetClass} px-3 py-2`}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">结算时间</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink-900)]">{formatTimestamp(entry.endedAt * 1000)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {hasMore ? (
            <div className="flex justify-center pt-1">
              <button
                className="inline-flex h-10 items-center justify-center rounded-[1rem] border border-[rgba(16,16,16,0.1)] bg-[rgba(255,255,255,0.94)] px-4 text-sm font-semibold text-[var(--ink-700)] shadow-[0_8px_18px_rgba(0,0,0,0.08)]"
                data-testid="history-load-more"
                disabled={isLoadingMore}
                onClick={onLoadMore}
                type="button"
              >
                {isLoadingMore ? '加载中...' : '查看更多'}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  )
}

/** 历史弹窗的状态占位区（加载/错误/空列表）。 */
const HistoryState = ({
  children,
  tone = 'normal',
}: {
  children: ReactNode
  tone?: 'normal' | 'error'
}) => (
  <div className={`${modalSectionClass} px-4 py-4 text-sm ${tone === 'error' ? 'text-[var(--accent-vermilion)]' : 'text-[var(--ink-600)]'}`}>
    {children}
  </div>
)
