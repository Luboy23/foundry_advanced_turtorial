/**
 * 模块职责：展示链上排行榜 Top10，并提供手动刷新入口。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import type { UseQueryResult } from '@tanstack/react-query'
import { formatDuration, formatScore, formatTimestamp } from '../../../shared/utils/format'
import type { ChainScoreEntry } from '../../../lib/contract'
import { Modal } from '../Modal'
import {
  buttonSecondaryClass,
  buttonSizeXsClass,
} from '../buttonStyles'

type LeaderboardModalProps = {
  isOpen: boolean
  hasContractAddress: boolean
  entries: ChainScoreEntry[]
  query: UseQueryResult<ChainScoreEntry[]>
  shortAddress: (address?: string) => string
  onClose: () => void
}

/**
 * 链上排行榜弹窗。
 * 展示优先级：地址缺失 > 加载中 > 错误 > 空态 > 列表。
 */
export default function LeaderboardModal({
  isOpen,
  hasContractAddress,
  entries,
  query,
  shortAddress,
  onClose,
}: LeaderboardModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="链上排行榜"
    >
      <div className="space-y-3">
        {/* 手动刷新：用于链上刚提交后快速确认结果。 */}
        <div className="flex justify-end">
          <button
            className={`${buttonSecondaryClass} ${buttonSizeXsClass}`}
            onClick={() => query.refetch()}
            type="button"
            disabled={query.isFetching || !hasContractAddress}
          >
            刷新
          </button>
        </div>

        {!hasContractAddress ? (
          // 合约地址缺失属于可恢复配置问题，优先提示部署指令。
          <p className="text-sm text-[var(--accent-vermilion)]">合约地址未配置，请先执行 make deploy。</p>
        ) : query.isLoading ? (
          <p className="text-sm text-[var(--ink-500)]">正在读取链上排行榜...</p>
        ) : query.error ? (
          <p className="text-sm text-[var(--accent-vermilion)]">链上排行榜读取失败，请检查 RPC 或地址配置。</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-[var(--ink-500)]">暂无链上记录</p>
        ) : (
          <ol className="space-y-2">
            {entries.map((entry, index) => (
              <li
                className="rounded-xl border border-[var(--line-soft)] bg-[rgba(255,255,255,0.56)] px-3 py-2"
                key={`${entry.player}-${entry.finishedAt}-${index}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p
                    className={`text-sm font-semibold ${
                      index === 0
                        ? 'text-[var(--accent-vermilion)]'
                        : 'text-[var(--ink-900)]'
                    }`}
                  >
                    {/* 名次从 1 开始展示，和合约数组索引解耦。 */}
                    排名 #{index + 1}
                  </p>
                  <div className="text-right text-xs">
                    <p
                      className={`font-semibold ${
                        index === 0
                          ? 'text-[var(--accent-vermilion)]'
                          : 'text-[var(--ink-900)]'
                      }`}
                    >
                      分数 {formatScore(entry.score)}
                    </p>
                    <p className="text-[var(--ink-500)]">
                      用时 {formatDuration(entry.survivalMs)} · 躲避 {entry.totalDodged}
                    </p>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-[var(--ink-500)]">
                  {shortAddress(entry.player)} · {formatTimestamp(entry.finishedAt * 1000)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  )
}
