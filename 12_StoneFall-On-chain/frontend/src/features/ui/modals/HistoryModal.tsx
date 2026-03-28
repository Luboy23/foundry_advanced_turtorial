/**
 * 模块职责：展示当前钱包地址的历史成绩分页列表。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
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

/**
 * 链上历史弹窗。
 * 展示优先级：未连接 > 地址缺失 > 加载中 > 错误 > 空态 > 列表。
 */
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
        // 未连接钱包时无法确定查询主体地址。
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
                    躲避 {entry.totalDodged}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--ink-700)]">
                  用时 {formatDuration(entry.survivalMs)} · {formatTimestamp(entry.finishedAt * 1000)}
                </p>
              </li>
            ))}
          </ol>

          {historyQuery.hasNextPage ? (
            // 使用已加载数/总数提示分页进度，减少用户对“是否到底”的疑问。
            <div className="flex justify-center">
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
