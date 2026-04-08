/**
 * 个人链上历史弹窗。
 * 使用无限分页查询，按需加载更多历史成绩。
 */
import type { UseInfiniteQueryResult, UseQueryResult } from '@tanstack/react-query'
import type { ChainScoreEntry } from '../../../lib/contract'
import { formatDuration, formatScore, formatTimestamp } from '../../../shared/utils/format'
import { Modal } from '../Modal'
import {
  buttonSecondaryClass,
  buttonSizeSmClass,
} from '../buttonStyles'

type HistoryModalProps = {
  isOpen: boolean
  connected: boolean
  address: `0x${string}` | undefined
  hasContractAddress: boolean
  entries: ChainScoreEntry[]
  historyQuery: UseInfiniteQueryResult
  historyCountQuery: UseQueryResult<number>
  onClose: () => void
}

export default function HistoryModal({
  isOpen,
  connected,
  address,
  hasContractAddress,
  entries,
  historyQuery,
  historyCountQuery,
  onClose,
}: HistoryModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="我的历史成绩"
    >
      {!connected || !address ? (
        <p className="text-sm text-[var(--accent-vermilion)]">请先连接钱包查看你的链上历史。</p>
      ) : !hasContractAddress ? (
        <p className="text-sm text-[var(--accent-vermilion)]">合约地址未配置，请先执行 make deploy。</p>
      ) : historyQuery.isLoading ? (
        <p className="text-sm text-[var(--ink-500)]">正在读取链上历史...</p>
      ) : historyQuery.error ? (
        <p className="text-sm text-[var(--accent-vermilion)]">链上历史读取失败，请检查 RPC 或地址配置。</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-[var(--ink-500)]">暂无链上记录</p>
      ) : (
        <div className="space-y-3">
          {/* 历史按时间倒序平铺，用户更容易先看到最近几局的链上结果。 */}
          <ol className="space-y-2">
            {entries.map((entry, index) => (
              <li
                className="rounded-xl border border-[var(--line-soft)] bg-white px-3 py-2"
                key={`history-${entry.finishedAt}-${entry.score}-${index}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--ink-900)]">
                    {formatScore(entry.score)} 分
                  </p>
                  <span className="text-[11px] text-[var(--ink-500)]">
                    落台 {entry.totalDodged}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--ink-700)]">
                  用时 {formatDuration(entry.survivalMs)} · {formatTimestamp(entry.finishedAt * 1000)}
                </p>
              </li>
            ))}
          </ol>

          {historyQuery.hasNextPage ? (
            <div className="flex justify-center">
              {/* 分页按钮直接复用 query 自带状态，避免额外维护“是否正在加载更多”。 */}
              <button
                className={`${buttonSecondaryClass} ${buttonSizeSmClass}`}
                onClick={() => historyQuery.fetchNextPage()}
                type="button"
                disabled={historyQuery.isFetchingNextPage}
              >
                {historyQuery.isFetchingNextPage
                  ? '加载中...'
                  : `加载更多（已加载 ${entries.length}/${historyCountQuery.data ?? entries.length}）`}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  )
}
