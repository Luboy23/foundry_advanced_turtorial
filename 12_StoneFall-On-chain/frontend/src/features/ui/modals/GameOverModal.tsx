/**
 * 模块职责：展示单局结算信息与链上提交流程状态。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import type { SessionStats } from '../../../game/types'
import { formatDuration, formatScore } from '../../../shared/utils/format'
import { Modal } from '../Modal'
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  buttonSizeSmClass,
} from '../buttonStyles'

type GameOverModalProps = {
  isOpen: boolean
  sessionStats: SessionStats | null
  submitStatusText: string
  submitError: string | null
  txHash: `0x${string}` | null
  isLocked: boolean
  canRetry: boolean
  isWritePending: boolean
  isReceiptLoading: boolean
  onClose: () => void
  onRetry: () => void
  onRestart: () => void
  shortAddress: (address?: string) => string
}

/**
 * 结算弹窗。
 * 当 `isLocked=true` 时，表示链上提交流程未完成，关闭和重开会被限制。
 */
export default function GameOverModal({
  isOpen,
  sessionStats,
  submitStatusText,
  submitError,
  txHash,
  isLocked,
  canRetry,
  isWritePending,
  isReceiptLoading,
  onClose,
  onRetry,
  onRestart,
  shortAddress,
}: GameOverModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={isLocked}
      title="本局结算"
    >
      {sessionStats ? (
        <div className="space-y-3">
          {/* 本局核心指标 */}
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-lg bg-[rgba(255,255,255,0.58)] px-3 py-2">
              <p className="text-[var(--ink-500)]">得分</p>
              <p className="text-base font-semibold text-[var(--ink-900)]">
                {formatScore(sessionStats.score)}
              </p>
            </div>
            <div className="rounded-lg bg-[rgba(255,255,255,0.58)] px-3 py-2">
              <p className="text-[var(--ink-500)]">时长</p>
              <p className="text-base font-semibold text-[var(--ink-900)]">
                {formatDuration(sessionStats.survivalMs)}
              </p>
            </div>
            <div className="rounded-lg bg-[rgba(255,255,255,0.58)] px-3 py-2">
              <p className="text-[var(--ink-500)]">已躲避</p>
              <p className="text-base font-semibold text-[var(--ink-900)]">
                {sessionStats.totalDodged}
              </p>
            </div>
          </div>

          {/* 链上提交状态区：统一展示签名/广播/确认/失败信息。 */}
          <div className="rounded-lg border border-[var(--line-soft)] bg-[rgba(255,255,255,0.6)] px-3 py-2 text-xs">
            <p className="font-semibold text-[var(--ink-900)]">链上提交状态：{submitStatusText}</p>
            {submitError ? (
              <p className="mt-1 text-[var(--accent-vermilion)]">{submitError}</p>
            ) : null}
            {txHash ? (
              <p className="mt-1 text-[var(--ink-500)]">Tx: {shortAddress(txHash)}</p>
            ) : null}
            {isLocked ? (
              <p className="mt-1 text-[var(--ink-500)]">
                完成链上签名并确认后，才能关闭弹窗或开始下一局。
              </p>
            ) : null}
          </div>

          {/* 操作区：失败可重试，成功可关闭或再来一局。 */}
          <div className="flex flex-wrap justify-end gap-2">
            {canRetry ? (
              <button
                className={`${buttonSecondaryClass} ${buttonSizeSmClass}`}
                onClick={onRetry}
                type="button"
              >
                重试上链
              </button>
            ) : null}
            <button
              className={`${buttonSecondaryClass} ${buttonSizeSmClass}`}
              onClick={onClose}
              type="button"
              disabled={isLocked}
            >
              关闭
            </button>
            <button
              className={`${buttonPrimaryClass} ${buttonSizeSmClass}`}
              onClick={onRestart}
              type="button"
              disabled={isLocked}
            >
              再来一局
            </button>
          </div>

          {(isWritePending || isReceiptLoading) && isLocked ? (
            // 处于链上处理中时提示用户避免重复操作钱包弹窗。
            <p className="text-[11px] text-[var(--ink-500)]">上链处理中，请勿重复关闭钱包弹窗。</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--ink-500)]">暂无结算数据</p>
      )}
    </Modal>
  )
}
