import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFns = vi.hoisted(() => ({
  playSfx: vi.fn(),
  activateAudio: vi.fn(),
  setBgmRunning: vi.fn(),
  writeContractAsync: vi.fn(async () => '0x4444444444444444444444444444444444444444444444444444444444444444'),
  waitForTransactionReceipt: vi.fn(async () => ({ status: 'success' as const })),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  verifySettlement: vi.fn(async () => ({
    settlement: {
      sessionId: '0x1111111111111111111111111111111111111111111111111111111111111111' as const,
      player: '0x1111111111111111111111111111111111111111' as const,
      kills: 8,
      survivalMs: 32200,
      goldEarned: 13,
      endedAt: 1711111111,
      rulesetVersion: 1,
      configHash: '0x2222222222222222222222222222222222222222222222222222222222222222' as const,
    },
    signature: '0x3333333333333333333333333333333333333333333333333333333333333333' as const,
    replaySummary: {
      kills: 8,
      survivalMs: 32200,
      goldEarned: 13,
      endReason: 'death' as const,
    },
  })),
}))
const mockPublicClient = {
  waitForTransactionReceipt: mockFns.waitForTransactionReceipt,
}
const mockQueryClient = {
  invalidateQueries: mockFns.invalidateQueries,
}

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
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const key = String(queryKey?.[1] ?? '')
    if (key === 'api-health') {
      return { data: { ok: true }, isLoading: false, error: null, isFetching: false, refetch: vi.fn() }
    }
    if (key === 'wallet-state') {
      return {
        data: { chainGold: 999, chainBowOwned: false },
        isLoading: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      }
    }
    if (key === 'history') {
      return { data: [], isLoading: false, error: null, isFetching: false, refetch: vi.fn() }
    }
    return { data: undefined, isLoading: false, error: null, isFetching: false, refetch: vi.fn() }
  },
  useQueryClient: () => mockQueryClient,
}))

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x1111111111111111111111111111111111111111', isConnected: true }),
  useChainId: () => 31337,
  useConnect: () => ({ connect: vi.fn(), connectors: [{ id: 'injected', name: 'Injected' }], isPending: false }),
  useSwitchChain: () => ({ switchChainAsync: vi.fn(), isPending: false }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  usePublicClient: () => mockPublicClient,
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
  GameCanvas: ({ onControllerReady }: { onControllerReady: (next: unknown) => void }) => {
    useEffect(() => {
      onControllerReady(controller)
      return () => onControllerReady(null)
    }, [onControllerReady])
    return <div data-testid="game-canvas">mock-canvas</div>
  },
}))

vi.mock('./features/audio/useGameAudio', () => ({
  useGameAudio: () => ({
    activateAudio: mockFns.activateAudio,
    playSfx: mockFns.playSfx,
    setBgmRunning: mockFns.setBgmRunning,
  }),
}))

vi.mock('./shared/utils/useViewport', () => ({
  useViewport: () => ({ width: 1280, height: 720 }),
}))

import App from './App'

const makeSnapshot = (pose: 'sword_idle' | 'sword_attack' | 'hook_spear_attack' | 'bow_attack') => ({
  kills: 0,
  survivalMs: 0,
  goldEarned: 0,
  activeWeapon: 'sword' as const,
  pose,
  targetId: null,
  projectileCount: 0,
  enemyCount: 0,
})

describe('App audio mapping', () => {
  beforeEach(() => {
    listeners.clear()
    mockFns.playSfx.mockClear()
    mockFns.activateAudio.mockClear()
    mockFns.setBgmRunning.mockClear()
    mockFns.writeContractAsync.mockClear()
    mockFns.waitForTransactionReceipt.mockClear()
    mockFns.invalidateQueries.mockClear()
    mockFns.verifySettlement.mockClear()
  })

  it('plays countdown/start/attack/death at expected state transitions', async () => {
    let now = 1000
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
    try {
      render(<App />)

      expect(mockFns.setBgmRunning).toHaveBeenCalledWith(false)
      await waitFor(() => {
        expect(listeners.has('onGameState')).toBe(true)
      })

      act(() => {
        listeners.get('onGameState')?.({ state: 'countdown' })
      })
      act(() => {
        listeners.get('onCountdown')?.({ value: 3 })
      })
      expect(mockFns.playSfx).toHaveBeenCalledWith('countdown')

      act(() => {
        listeners.get('onGameState')?.({ state: 'running' })
      })
      expect(mockFns.playSfx).toHaveBeenCalledWith('start')
      await waitFor(() => {
        expect(mockFns.setBgmRunning).toHaveBeenCalledWith(true)
      })

      act(() => {
        listeners.get('onSnapshot')?.(makeSnapshot('sword_idle'))
        listeners.get('onSnapshot')?.(makeSnapshot('sword_attack'))
      })

      now = 1030
      act(() => {
        listeners.get('onSnapshot')?.(makeSnapshot('sword_idle'))
        listeners.get('onSnapshot')?.(makeSnapshot('hook_spear_attack'))
      })

      now = 1120
      act(() => {
        listeners.get('onSnapshot')?.(makeSnapshot('sword_idle'))
        listeners.get('onSnapshot')?.(makeSnapshot('bow_attack'))
      })

      const attackCalls = mockFns.playSfx.mock.calls.filter(([kind]) => kind === 'attack')
      expect(attackCalls).toHaveLength(2)

      mockFns.verifySettlement.mockImplementationOnce(() => new Promise(() => {}))
      act(() => {
        listeners.get('onGameOver')?.({
          stats: {
            sessionId: '0x1111111111111111111111111111111111111111111111111111111111111111',
            rulesetVersion: 1,
            configHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
            kills: 8,
            survivalMs: 32200,
            goldEarned: 13,
            endReason: 'death',
            inputSource: 'keyboard',
            logs: [],
          },
        })
      })

      expect(mockFns.playSfx).toHaveBeenCalledWith('death')
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('plays purchase sfx after buying bow succeeds', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '装备' }))
    fireEvent.click(await screen.findByTestId('purchase-bow'))

    await waitFor(() => {
      expect(mockFns.writeContractAsync).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(mockFns.playSfx).toHaveBeenCalledWith('purchase')
    })
  })
})
