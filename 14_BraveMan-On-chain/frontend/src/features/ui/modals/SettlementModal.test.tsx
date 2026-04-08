import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SettlementModal from './SettlementModal'

const sessionStats = {
  sessionId: '0x1111111111111111111111111111111111111111111111111111111111111111' as const,
  kills: 12,
  survivalMs: 43820,
  goldEarned: 15,
  endReason: 'death' as const,
}

describe('SettlementModal', () => {
  it('shows retry action and keeps modal locked while claim is pending', () => {
    const onRetry = vi.fn()
    render(
      <SettlementModal
        isOpen
        sessionStats={sessionStats}
        submitStage="error"
        submitStatusText="系统正在复盘本局"
        submitError="需要重试"
        txHash={null}
        isLocked
        autoReturning={false}
        canRetry
        isRecoveryMode={false}
        onClose={vi.fn()}
        onDiscardRecovery={vi.fn()}
        onRetry={onRetry}
        shortAddress={(value) => value ? `${value.slice(0, 6)}...${value.slice(-4)}` : '--'}
      />,
    )

    expect(screen.getByText('结算进行中或尚未确认，当前无法关闭弹窗。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重试上链' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    const closeButtons = screen.getAllByRole('button', { name: '关闭' })
    expect(closeButtons[closeButtons.length - 1]).toBeDisabled()
  })

  it('shows auto-return status without manual success actions', () => {
    render(
      <SettlementModal
        isOpen
        sessionStats={sessionStats}
        submitStage="success"
        submitStatusText="战绩已成功上链，正在返回待机界面..."
        submitError={null}
        txHash="0x3333333333333333333333333333333333333333333333333333333333333333"
        isLocked={false}
        autoReturning
        canRetry={false}
        isRecoveryMode={false}
        onClose={vi.fn()}
        onDiscardRecovery={vi.fn()}
        onRetry={vi.fn()}
        shortAddress={(value) => value ? `${value.slice(0, 6)}...${value.slice(-4)}` : '--'}
      />,
    )

    expect(screen.getByText('约 1.2 秒后自动返回待机画面。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '关闭' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '重试上链' })).not.toBeInTheDocument()
  })

  it('forces an explicit continue-or-discard choice in recovery mode', () => {
    render(
      <SettlementModal
        isOpen
        sessionStats={sessionStats}
        submitStage="idle"
        submitStatusText="检测到上次未完成结算，你可以继续上链或放弃本地缓存。"
        submitError={null}
        txHash={null}
        isLocked={false}
        autoReturning={false}
        canRetry={false}
        isRecoveryMode
        onClose={vi.fn()}
        onDiscardRecovery={vi.fn()}
        onRetry={vi.fn()}
        shortAddress={(value) => value ? `${value.slice(0, 6)}...${value.slice(-4)}` : '--'}
      />,
    )

    expect(screen.getByRole('button', { name: '放弃缓存' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '继续上链' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '关闭' })).not.toBeInTheDocument()
  })
})
