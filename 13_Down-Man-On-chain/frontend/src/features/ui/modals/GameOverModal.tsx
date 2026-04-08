/**
 * 结算弹窗。
 * 汇总本局统计和链上提交状态，并在提交成功前锁定关闭/重开动作。
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
          {/* 结算统计只展示本局最核心的三个值，避免弹窗信息密度过高。 */}
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
              <p className="text-[var(--ink-500)]">落台数</p>
              <p className="text-base font-semibold text-[var(--ink-900)]">
                {sessionStats.totalDodged}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--line-soft)] bg-[rgba(255,255,255,0.6)] px-3 py-2 text-xs">
            {/* 链上提交流程单独汇总在这里，避免用户误以为“结算弹窗已关闭 = 已上链成功”。 */}
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

          <div className="flex flex-wrap justify-end gap-2">
            {/* retry / close / restart 的可用性由 App 侧状态机控制，这里只负责展示。 */}
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
            <p className="text-[11px] text-[var(--ink-500)]">上链处理中，请勿重复关闭钱包弹窗。</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--ink-500)]">暂无结算数据</p>
      )}
    </Modal>
  )
}
