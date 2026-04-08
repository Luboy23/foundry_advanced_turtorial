import type { SettlementPreview, SubmitStage } from '../../../hooks/useSettlementFlow'
import { formatDuration, formatNumber } from '../../../shared/utils/format'
import { Modal } from '../Modal'
import { buttonSecondaryClass, buttonSizeSmClass, modalInsetClass, modalSectionClass, parchmentBadgeClass } from '../buttonStyles'

/** 结算弹窗输入：上层负责状态机，弹窗仅做展示与动作透传。 */
type SettlementModalProps = {
  isOpen: boolean
  sessionStats: SettlementPreview | null
  submitStage: SubmitStage
  submitStatusText: string
  submitError: string | null
  txHash: `0x${string}` | null
  isLocked: boolean
  autoReturning: boolean
  canRetry: boolean
  isRecoveryMode: boolean
  onClose: () => void
  onRetry: () => void
  onDiscardRecovery: () => void
  shortAddress: (address?: string) => string
}

/**
 * 结算弹窗：
 * - 展示本局统计；
 * - 展示 verify/claim 状态机文案；
 * - 在恢复模式下暴露“继续上链 / 放弃缓存”。
 */
export default function SettlementModal({
  isOpen,
  sessionStats,
  submitStage,
  submitStatusText,
  submitError,
  txHash,
  isLocked,
  autoReturning,
  canRetry,
  isRecoveryMode,
  onClose,
  onRetry,
  onDiscardRecovery,
  shortAddress,
}: SettlementModalProps) {
  const recoveryDecisionLocked = isRecoveryMode && submitStage === 'idle'
  const statusBadgeLabel = submitError
    ? '需要处理'
    : submitStage === 'success'
      ? '已完成'
      : submitStage === 'pending'
        ? '等待确认'
        : submitStage === 'signing'
          ? '待签名'
          : submitStage === 'verifying'
            ? '复盘中'
            : isRecoveryMode
              ? '待恢复'
              : '待确认'

  const statusBadgeClass = submitError
    ? 'text-[var(--accent-vermilion)]'
    : submitStage === 'success'
      ? 'text-emerald-700'
      : 'text-[var(--ink-700)]'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={isLocked || autoReturning || recoveryDecisionLocked}
      hideCloseButton={recoveryDecisionLocked}
      title="本局战绩"
      panelClassName="max-w-2xl"
    >
      {sessionStats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Stat label="击杀" value={formatNumber(sessionStats.kills)} />
            <Stat label="时长" value={formatDuration(sessionStats.survivalMs)} />
            <Stat label="金币" value={formatNumber(sessionStats.goldEarned)} />
            <Stat label="结束" value={sessionStats.endReason === 'death' ? '阵亡' : '主动结算'} />
          </div>

          <div className={`${modalSectionClass} px-4 py-4 text-xs`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.22em] text-[var(--ink-500)]">链上结算</p>
                <p className="mt-1 text-sm font-semibold text-[var(--ink-900)]">链上提交状态</p>
              </div>
              <span className={`${parchmentBadgeClass} px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass}`}>
                {statusBadgeLabel}
              </span>
            </div>

            <div className={`${modalInsetClass} mt-3 px-3 py-3`}>
              <p className="text-sm font-semibold text-[var(--ink-900)]">{submitStatusText}</p>
              {isRecoveryMode && submitStage === 'idle' ? (
                <p className="mt-2 text-[var(--ink-600)]">系统已恢复上次未完成的结算缓存。继续上链会重新发起链上提交，放弃缓存则直接丢弃这次恢复数据。</p>
              ) : null}
              {submitError ? <p className="mt-2 rounded-[0.9rem] border border-[rgba(181,57,34,0.2)] bg-[rgba(181,57,34,0.1)] px-2.5 py-2 text-[var(--accent-vermilion)]">{submitError}</p> : null}
              {txHash ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[var(--ink-600)]">
                  <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--ink-500)]">交易哈希</span>
                  <span className={`${parchmentBadgeClass} px-2.5 py-1 text-[11px] font-semibold`}>
                    {shortAddress(txHash)}
                  </span>
                </div>
              ) : null}
              {isLocked ? <p className="mt-2 text-[var(--ink-600)]">结算进行中或尚未确认，当前无法关闭弹窗。</p> : null}
              {autoReturning ? <p className="mt-2 text-[var(--ink-600)]">约 1.2 秒后自动返回待机画面。</p> : null}
            </div>
          </div>

          {!autoReturning ? (
            <div className="flex flex-wrap justify-end gap-2">
              {isRecoveryMode && submitStage === 'idle' ? (
                <button className={`${buttonSecondaryClass} ${buttonSizeSmClass}`} onClick={onDiscardRecovery} type="button">放弃缓存</button>
              ) : null}
              {isRecoveryMode && submitStage === 'idle' ? (
                <button className={`${buttonSecondaryClass} ${buttonSizeSmClass}`} onClick={onRetry} type="button">继续上链</button>
              ) : canRetry ? (
                <button className={`${buttonSecondaryClass} ${buttonSizeSmClass}`} onClick={onRetry} type="button">重试上链</button>
              ) : null}
              {!recoveryDecisionLocked ? (
                <button className={`${buttonSecondaryClass} ${buttonSizeSmClass}`} onClick={onClose} type="button" disabled={isLocked}>关闭</button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={`${modalSectionClass} px-4 py-4 text-sm text-[var(--ink-500)]`}>暂无战绩数据</div>
      )}
    </Modal>
  )
}

/** 统计卡片渲染单元。 */
const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className={`${modalInsetClass} px-3 py-2`}>
    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">{label}</p>
    <p className="mt-1 text-base font-semibold text-[var(--ink-900)]">{value}</p>
  </div>
)
