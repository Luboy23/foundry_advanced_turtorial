import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WalletPanel } from './WalletPanel'

describe('WalletPanel', () => {
  it('disables disconnect in minimal layout when disconnect is locked', () => {
    render(
      <WalletPanel
        isConnected
        isCorrectChain
        chainId={31337}
        displayAddress="0x1111...1111"
        isConnecting={false}
        bypassMode={false}
        disconnectLocked
        disconnectLockReason="对局进行中，暂不可断开钱包连接"
        layout="minimal"
        isSwitchingChain={false}
        onToggleConnect={vi.fn()}
        onRepairNetwork={vi.fn()}
      />,
    )

    const disconnectButton = screen.getByRole('button', { name: '断开' })
    expect(disconnectButton).toBeDisabled()
    expect(disconnectButton).toHaveAttribute('title', '对局进行中，暂不可断开钱包连接')
  })

  it('disables disconnect in stacked layout when disconnect is locked', () => {
    render(
      <WalletPanel
        isConnected
        isCorrectChain
        chainId={31337}
        displayAddress="0x1111...1111"
        isConnecting={false}
        bypassMode={false}
        disconnectLocked
        disconnectLockReason="对局进行中，暂不可断开钱包连接"
        layout="stacked"
        isSwitchingChain={false}
        onToggleConnect={vi.fn()}
        onRepairNetwork={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '断开' })).toBeDisabled()
  })

  it('keeps connect action enabled even when disconnectLocked is true', () => {
    render(
      <WalletPanel
        isConnected={false}
        isCorrectChain
        chainId={31337}
        displayAddress="--"
        isConnecting={false}
        bypassMode={false}
        disconnectLocked
        layout="stacked"
        isSwitchingChain={false}
        onToggleConnect={vi.fn()}
        onRepairNetwork={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '连接' })).toBeEnabled()
  })
})
