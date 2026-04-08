import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFns = vi.hoisted(() => ({
  verifySettlement: vi.fn(),
  writeContractAsync: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  account: {
    address: '0x1111111111111111111111111111111111111111' as `0x${string}` | undefined,
    isConnected: true,
  },
}))

const listeners = new Map<string, (payload: unknown) => void>()
const controller = {
  destroy: vi.fn(),
  on: vi.fn((event: string, handler: (payload: unknown) => void) => {
    listeners.set(event, handler)
    return () => listeners.delete(event)
  }),
  startGame: vi.fn(),
  pauseGame: vi.fn(),
  resumeGame: vi.fn(),
  returnToIdle: vi.fn(),
  setMovement: vi.fn(),
  setEquipmentModalOpen: vi.fn(),
  setBowAvailability: vi.fn(),
  toggleWeapon: vi.fn(),
  equipWeapon: vi.fn(),
  unlockBowAndEquip: vi.fn(),
  retreat: vi.fn(),
  forceGameOver: vi.fn(),
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, error: null, isFetching: false, refetch: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
}))

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: mockFns.account.address, isConnected: mockFns.account.isConnected }),
  useChainId: () => 31337,
  useConnect: () => ({ connect: mockFns.connect, connectors: [{ id: 'injected', name: 'Injected' }], isPending: false }),
  useSwitchChain: () => ({ switchChainAsync: vi.fn(), isPending: false }),
  useDisconnect: () => ({ disconnect: mockFns.disconnect }),
  usePublicClient: () => ({ waitForTransactionReceipt: mockFns.waitForTransactionReceipt }),
  useWriteContract: () => ({ writeContractAsync: mockFns.writeContractAsync }),
}))

vi.mock('./lib/api', () => ({
  createSession: vi.fn(),
  getApiHealth: vi.fn().mockResolvedValue({ ok: true }),
  verifySettlement: mockFns.verifySettlement,
}))

vi.mock('./lib/contract', async () => {
  const actual = await vi.importActual<typeof import('./lib/contract')>('./lib/contract')
  return {
    ...actual,
    BRAVEMAN_ADDRESS: '0x1111111111111111111111111111111111111111',
    BRAVEMAN_ADDRESS_VALID: true,
  }
})

vi.mock('./features/game/GameCanvas', () => ({
  GameCanvas: ({ onControllerReady }: { onControllerReady: (controller: unknown) => void }) => {
    useEffect(() => {
      onControllerReady(controller)
      return () => onControllerReady(null)
    }, [onControllerReady])
    return <div data-testid="game-canvas">mock-canvas</div>
  },
}))

vi.mock('./features/audio/useGameAudio', () => ({
  useGameAudio: () => ({
    activateAudio: vi.fn(),
    playSfx: vi.fn(),
    setBgmRunning: vi.fn(),
  }),
}))

vi.mock('./shared/utils/useViewport', () => ({
  useViewport: () => ({ width: 1280, height: 720 }),
}))

import App from './App'

const sessionStats = {
  sessionId: '0x1111111111111111111111111111111111111111111111111111111111111111' as const,
  rulesetVersion: 1,
  configHash: '0x2222222222222222222222222222222222222222222222222222222222222222' as const,
  kills: 12,
  survivalMs: 43820,
  goldEarned: 15,
  endReason: 'death' as const,
  inputSource: 'keyboard' as const,
  logs: [],
}

describe('App settlement flow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    listeners.clear()
    controller.destroy.mockClear()
    controller.on.mockClear()
    controller.startGame.mockClear()
    controller.pauseGame.mockClear()
    controller.resumeGame.mockClear()
    controller.returnToIdle.mockClear()
    controller.setMovement.mockClear()
    controller.setEquipmentModalOpen.mockClear()
    controller.setBowAvailability.mockClear()
    controller.toggleWeapon.mockClear()
    controller.equipWeapon.mockClear()
    controller.unlockBowAndEquip.mockClear()
    controller.retreat.mockClear()
    controller.forceGameOver.mockClear()
    mockFns.connect.mockReset()
    mockFns.disconnect.mockReset()
    mockFns.account.address = '0x1111111111111111111111111111111111111111'
    mockFns.account.isConnected = true
    mockFns.verifySettlement.mockReset()
    mockFns.writeContractAsync.mockReset()
    mockFns.waitForTransactionReceipt.mockReset()
    mockFns.verifySettlement.mockResolvedValue({
      settlement: {
        sessionId: '0x1111111111111111111111111111111111111111111111111111111111111111' as const,
        player: '0x1111111111111111111111111111111111111111' as const,
        kills: 12,
        survivalMs: 43820,
        goldEarned: 15,
        endedAt: 1711111111,
        rulesetVersion: 1,
        configHash: '0x2222222222222222222222222222222222222222222222222222222222222222' as const,
      },
      signature: '0x3333333333333333333333333333333333333333333333333333333333333333' as const,
      replaySummary: {
        kills: 12,
        survivalMs: 43820,
        goldEarned: 15,
        endReason: 'death' as const,
      },
    })
    mockFns.writeContractAsync.mockResolvedValue('0x4444444444444444444444444444444444444444444444444444444444444444')
    mockFns.waitForTransactionReceipt.mockResolvedValue({ status: 'success' as const })
  })

  afterEach(async () => {
    await act(async () => {
      vi.runOnlyPendingTimers()
    })
    vi.useRealTimers()
  })

  it('auto-returns to the idle layout after a successful settlement', async () => {
    await act(async () => {
      render(<App />)
      await Promise.resolve()
    })

    await act(async () => {
      listeners.get('onSnapshot')?.({
        kills: 12,
        survivalMs: 43820,
        goldEarned: 15,
        activeWeapon: 'bow',
        pose: 'bow_attack',
        targetId: null,
        projectileCount: 0,
        enemyCount: 1,
      })
      listeners.get('onGameOver')?.({ stats: sessionStats })

      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockFns.verifySettlement).toHaveBeenCalledTimes(1)
    expect(mockFns.writeContractAsync).toHaveBeenCalledTimes(1)
    expect(screen.getByText('战绩已成功上链')).toBeInTheDocument()
    expect(screen.getByTestId('kills-value')).toHaveTextContent('12')
    expect(screen.getByTestId('run-gold-value')).toHaveTextContent('15')

    await act(async () => {
      vi.advanceTimersByTime(1200)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(controller.returnToIdle).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('本局战绩')).not.toBeInTheDocument()
    expect(screen.getByTestId('kills-value')).toHaveTextContent('0')
    expect(screen.getByTestId('run-gold-value')).toHaveTextContent('0')
  })

  it('locks disconnect outside idle and restores it after returning idle', async () => {
    await act(async () => {
      render(<App />)
      await Promise.resolve()
    })

    const disconnectButton = screen.getByRole('button', { name: '断开' })
    expect(disconnectButton).toBeEnabled()
    disconnectButton.click()
    expect(mockFns.disconnect).toHaveBeenCalledTimes(1)
    mockFns.disconnect.mockClear()

    await act(async () => {
      listeners.get('onGameState')?.({ state: 'running' })
      await Promise.resolve()
    })
    expect(screen.getByRole('button', { name: '断开' })).toBeDisabled()
    screen.getByRole('button', { name: '断开' }).click()
    expect(mockFns.disconnect).not.toHaveBeenCalled()

    await act(async () => {
      listeners.get('onGameState')?.({ state: 'paused' })
      await Promise.resolve()
    })
    expect(screen.getByRole('button', { name: '断开' })).toBeDisabled()

    await act(async () => {
      listeners.get('onGameState')?.({ state: 'idle' })
      await Promise.resolve()
    })
    const enabledAgain = screen.getByRole('button', { name: '断开' })
    expect(enabledAgain).toBeEnabled()
    enabledAgain.click()
    expect(mockFns.disconnect).toHaveBeenCalledTimes(1)
  })

  it('shows explicit error when address is missing on game over', async () => {
    mockFns.account.address = undefined
    mockFns.account.isConnected = false

    await act(async () => {
      render(<App />)
      await Promise.resolve()
    })

    await act(async () => {
      listeners.get('onGameOver')?.({ stats: sessionStats })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockFns.verifySettlement).not.toHaveBeenCalled()
    expect(screen.getAllByText('钱包已断开，请重新连接后重试结算').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '重试上链' })).toBeEnabled()
    const closeButtons = screen.getAllByRole('button', { name: '关闭' })
    expect(closeButtons.at(-1)).toBeEnabled()
  })

  it('retries by rerunning verify when no pendingClaim is cached', async () => {
    mockFns.verifySettlement
      .mockRejectedValueOnce(new Error('服务暂不可用'))
      .mockResolvedValue({
        settlement: {
          sessionId: '0x1111111111111111111111111111111111111111111111111111111111111111' as const,
          player: '0x1111111111111111111111111111111111111111' as const,
          kills: 12,
          survivalMs: 43820,
          goldEarned: 15,
          endedAt: 1711111111,
          rulesetVersion: 1,
          configHash: '0x2222222222222222222222222222222222222222222222222222222222222222' as const,
        },
        signature: '0x3333333333333333333333333333333333333333333333333333333333333333' as const,
        replaySummary: {
          kills: 12,
          survivalMs: 43820,
          goldEarned: 15,
          endReason: 'death' as const,
        },
      })

    await act(async () => {
      render(<App />)
      await Promise.resolve()
    })

    await act(async () => {
      listeners.get('onGameOver')?.({ stats: sessionStats })
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getAllByText('服务暂不可用').length).toBeGreaterThan(0)
    expect(mockFns.writeContractAsync).toHaveBeenCalledTimes(0)

    await act(async () => {
      screen.getByRole('button', { name: '重试上链' }).click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockFns.verifySettlement).toHaveBeenCalledTimes(2)
    expect(mockFns.writeContractAsync).toHaveBeenCalledTimes(1)
  })
})
