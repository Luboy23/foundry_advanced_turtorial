import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { healthState, wagmiState, createSessionMock, listeners, controller } = vi.hoisted(() => {
  const nextHealthState = {
    data: undefined as { ok: boolean; message?: string | null } | undefined,
    error: new Error('network') as Error | null,
  }

  const nextWagmiState = {
    address: '0x1111111111111111111111111111111111111111' as `0x${string}` | undefined,
    isConnected: true,
    chainId: 31337,
    connect: vi.fn(),
    switchChainAsync: vi.fn(),
    disconnect: vi.fn(),
    writeContractAsync: vi.fn(),
  }

  const nextCreateSessionMock = vi.fn()
  const nextListeners = new Map<string, (payload: unknown) => void>()
  const nextController = {
    destroy: vi.fn(),
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      nextListeners.set(event, handler)
      return () => nextListeners.delete(event)
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

  return {
    healthState: nextHealthState,
    wagmiState: nextWagmiState,
    createSessionMock: nextCreateSessionMock,
    listeners: nextListeners,
    controller: nextController,
  }
})

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: unknown[] }) => {
    if (options.queryKey[1] === 'api-health') {
      return {
        data: healthState.data,
        isLoading: false,
        error: healthState.error,
        isFetching: false,
        refetch: vi.fn(),
      }
    }

    return { data: undefined, isLoading: false, error: null, isFetching: false, refetch: vi.fn() }
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
}))

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: wagmiState.address, isConnected: wagmiState.isConnected }),
  useChainId: () => wagmiState.chainId,
  useConnect: () => ({ connect: wagmiState.connect, connectors: [{ id: 'injected', name: 'Injected' }], isPending: false }),
  useSwitchChain: () => ({ switchChainAsync: wagmiState.switchChainAsync, isPending: false }),
  useDisconnect: () => ({ disconnect: wagmiState.disconnect }),
  usePublicClient: () => null,
  useWriteContract: () => ({ writeContractAsync: wagmiState.writeContractAsync }),
}))

vi.mock('./lib/api', async () => {
  const actual = await vi.importActual<typeof import('./lib/api')>('./lib/api')
  return {
    ...actual,
    createSession: createSessionMock,
  }
})

vi.mock('./lib/contract', async () => {
  const actual = await vi.importActual<typeof import('./lib/contract')>('./lib/contract')
  return {
    ...actual,
    BRAVEMAN_ADDRESS: '0x1111111111111111111111111111111111111111',
    BRAVEMAN_ADDRESS_VALID: true,
  }
})

vi.mock('./features/game/GameCanvas', () => ({
  GameCanvas: ({ onControllerReady }: { onControllerReady: (nextController: unknown) => void }) => {
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

const mockSessionResponse = {
  sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  seed: 'demo-seed',
  expiresAt: '2026-04-01T12:00:00.000Z',
  bowUnlocked: false,
  rulesetMeta: {
    rulesetVersion: 1,
    configHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  },
} as const

describe('App start readiness', () => {
  beforeEach(() => {
    healthState.data = undefined
    healthState.error = new Error('network')
    wagmiState.address = '0x1111111111111111111111111111111111111111'
    wagmiState.isConnected = true
    wagmiState.chainId = 31337
    wagmiState.connect.mockReset()
    wagmiState.switchChainAsync.mockReset()
    wagmiState.disconnect.mockReset()
    wagmiState.writeContractAsync.mockReset()
    createSessionMock.mockReset()
    createSessionMock.mockResolvedValue(mockSessionResponse)
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
  })

  it('blocks starting when the wallet is disconnected and keeps connect on the wallet panel', async () => {
    const user = userEvent.setup()
    healthState.data = { ok: true }
    healthState.error = null
    wagmiState.address = undefined
    wagmiState.isConnected = false

    render(<App />)

    const startButton = screen.getByTestId('floating-control-start')
    expect(startButton).toBeDisabled()
    expect(startButton).toHaveAttribute('title', '请先连接钱包后开始')
    expect(screen.getByTestId('start-blocked-reason')).toHaveTextContent('请先连接钱包后开始')
    expect(screen.getByRole('button', { name: '连接' })).toBeEnabled()

    await user.click(startButton)

    expect(wagmiState.connect).not.toHaveBeenCalled()
    expect(createSessionMock).not.toHaveBeenCalled()
  })

  it('blocks starting when api health request fails', () => {
    healthState.data = undefined
    healthState.error = new Error('network')

    render(<App />)

    expect(screen.getByTestId('floating-control-start')).toBeDisabled()
    expect(screen.getByTestId('floating-control-start')).toHaveAttribute('title', '对局服务连接失败，请确认 make dev 已启动完成。')
    expect(screen.getByTestId('start-blocked-reason')).toHaveTextContent('对局服务连接失败，请确认 make dev 已启动完成。')
  })

  it('blocks starting when the session service is not ready even if wallet and engine are ready', () => {
    healthState.data = {
      ok: false,
      message: '本地链或游戏合约尚未就绪，请确认 Anvil 正在运行，并重新执行 make deploy 或 make dev。',
    }
    healthState.error = null

    render(<App />)

    expect(screen.getByTestId('floating-control-start')).toBeDisabled()
    expect(screen.getByTestId('floating-control-start')).toHaveAttribute('title', '本地链或游戏合约尚未就绪，请确认 Anvil 正在运行，并重新执行 make deploy 或 make dev。')
    expect(screen.getByTestId('start-blocked-reason')).toHaveTextContent('本地链或游戏合约尚未就绪，请确认 Anvil 正在运行，并重新执行 make deploy 或 make dev。')
  })

  it('blocks starting on the wrong chain and leaves network repair on the wallet panel', async () => {
    const user = userEvent.setup()
    healthState.data = { ok: true }
    healthState.error = null
    wagmiState.chainId = 1

    render(<App />)

    const startButton = screen.getByTestId('floating-control-start')
    expect(startButton).toBeDisabled()
    expect(startButton).toHaveAttribute('title', '请切换到 Anvil (31337)')
    expect(screen.getByTestId('start-blocked-reason')).toHaveTextContent('请切换到 Anvil (31337)')
    expect(screen.getByRole('button', { name: '切换网络' })).toBeEnabled()

    await user.click(startButton)

    expect(wagmiState.switchChainAsync).not.toHaveBeenCalled()
    expect(createSessionMock).not.toHaveBeenCalled()
  })

  it('starts a game only when wallet, chain, engine, and api are all ready', async () => {
    const user = userEvent.setup()
    healthState.data = { ok: true }
    healthState.error = null

    render(<App />)

    const startButton = screen.getByTestId('floating-control-start')
    expect(startButton).toBeEnabled()
    expect(screen.queryByTestId('start-blocked-reason')).not.toBeInTheDocument()

    await user.click(startButton)

    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledWith(
        '0x1111111111111111111111111111111111111111',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      )
    })

    await waitFor(() => {
      expect(controller.startGame).toHaveBeenCalledWith({
        sessionId: mockSessionResponse.sessionId,
        seed: mockSessionResponse.seed,
        expiresAt: mockSessionResponse.expiresAt,
        rulesetVersion: mockSessionResponse.rulesetMeta.rulesetVersion,
        configHash: mockSessionResponse.rulesetMeta.configHash,
        bowUnlocked: false,
      })
    })
  })
})
