import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameEvents } from './game/types'

const chainMocks = vi.hoisted(() => {
  const connect = vi.fn()
  const disconnect = vi.fn()
  const writeContractAsync = vi.fn(async () => '0xabc' as `0x${string}`)
  const invalidateQueries = vi.fn()

  const state = {
    isConnected: false,
    address: undefined as `0x${string}` | undefined,
    chainId: 31337,
    receipt: {
      isLoading: false,
      isSuccess: false,
      isError: false,
    },
    leaderboard: [] as Array<{
      player: `0x${string}`
      score: number
      survivalMs: number
      totalDodged: number
      finishedAt: number
    }>,
    bestScore: 0,
    historyCount: 0,
    historyItems: [] as Array<{
      player: `0x${string}`
      score: number
      survivalMs: number
      totalDodged: number
      finishedAt: number
    }>,
    queryEnabled: {} as Record<string, boolean>,
    infiniteQueryEnabled: {} as Record<string, boolean>,
  }

  return {
    connect,
    disconnect,
    writeContractAsync,
    invalidateQueries,
    state,
  }
})

vi.mock('wagmi', () => ({
  useAccount: () => ({
    isConnected: chainMocks.state.isConnected,
    address: chainMocks.state.address,
  }),
  useChainId: () => chainMocks.state.chainId,
  useConnect: () => ({
    connect: chainMocks.connect,
    connectors: [{ id: 'injected', name: 'Injected' }],
    isPending: false,
  }),
  useDisconnect: () => ({
    disconnect: chainMocks.disconnect,
  }),
  useWriteContract: () => ({
    writeContractAsync: chainMocks.writeContractAsync,
    isPending: false,
  }),
  useWaitForTransactionReceipt: () => chainMocks.state.receipt,
  usePublicClient: () => ({
    watchContractEvent: vi.fn(() => vi.fn()),
  }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: chainMocks.invalidateQueries,
  }),
  useQuery: ({ queryKey, enabled }: { queryKey: unknown[]; enabled?: boolean }) => {
    const key = String(queryKey?.[1] ?? '')
    chainMocks.state.queryEnabled[key] = enabled ?? true
    if (key === 'leaderboard') {
      return {
        data: chainMocks.state.leaderboard,
        isLoading: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      }
    }
    if (key === 'best-score') {
      return {
        data: chainMocks.state.bestScore,
        isLoading: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      }
    }
    if (key === 'history-count') {
      return {
        data: chainMocks.state.historyCount,
        isLoading: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      }
    }

    return {
      data: null,
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    }
  },
  useInfiniteQuery: ({ queryKey, enabled }: { queryKey: unknown[]; enabled?: boolean }) => {
    const key = String(queryKey?.[1] ?? '')
    chainMocks.state.infiniteQueryEnabled[key] = enabled ?? true
    return {
    data: { pages: [{ items: chainMocks.state.historyItems }] },
    isLoading: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    }
  },
}))

vi.mock('./lib/contract', () => ({
  DOWNMAN_ABI: [],
  DOWNMAN_ADDRESS: '0x0000000000000000000000000000000000000001',
  DOWNMAN_ADDRESS_VALID: true,
  compareChainEntries: (a: { score: number; survivalMs: number; finishedAt: number }, b: { score: number; survivalMs: number; finishedAt: number }) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.survivalMs !== a.survivalMs) return b.survivalMs - a.survivalMs
    return a.finishedAt - b.finishedAt
  },
  toChainScoreEntry: (entry: {
    player: `0x${string}`
    score: number | bigint
    survivalMs: number | bigint
    totalDodged: number | bigint
    finishedAt: number | bigint
  }) => ({
    player: entry.player,
    score: Number(entry.score),
    survivalMs: Number(entry.survivalMs),
    totalDodged: Number(entry.totalDodged),
    finishedAt: Number(entry.finishedAt),
  }),
}))

const testBridge = vi.hoisted(() => {
  const listeners = new Map<keyof GameEvents, Set<(payload: unknown) => void>>()

  const subscribe = vi.fn(<Key extends keyof GameEvents>(
    event: Key,
    listener: (payload: GameEvents[Key]) => void,
  ) => {
    const current = listeners.get(event) ?? new Set<(payload: unknown) => void>()
    current.add(listener as (payload: unknown) => void)
    listeners.set(event, current)

    return () => {
      current.delete(listener as (payload: unknown) => void)
    }
  })

  const controller = {
    startGame: vi.fn(),
    pauseGame: vi.fn(),
    resumeGame: vi.fn(),
    restartGame: vi.fn(),
    returnToIdle: vi.fn(),
    setInputMode: vi.fn(),
    setAudioSettings: vi.fn(),
    subscribe,
    destroy: vi.fn(),
    debugForceGameOver: vi.fn(),
    debugSetElapsedMs: vi.fn(),
    debugSetPlayerState: vi.fn(),
    debugSpawnTestPlatform: vi.fn(),
    debugClearTestPlatforms: vi.fn(),
    debugGetPlayerX: vi.fn(() => 640),
    debugGetPlayerY: vi.fn(() => 360),
    debugGetPlayerVelocityX: vi.fn(() => 0),
    debugGetPlayerVelocityY: vi.fn(() => 0),
    debugGetPlayerStateSnapshot: vi.fn(() => ({
      x: 640,
      y: 360,
      velocityX: 0,
      velocityY: 0,
      cameraScrollY: 0,
      grounded: true,
      currentGroundPlatformId: 1,
      lastLandingEvent: null,
    })),
    debugGetPlatformState: vi.fn(() => null),
    debugGetSpawnTelemetry: vi.fn(() => []),
  }

  const emit = <Key extends keyof GameEvents>(event: Key, payload: GameEvents[Key]) => {
    const current = listeners.get(event)
    if (!current) {
      return
    }

    for (const listener of current) {
      listener(payload)
    }
  }

  const reset = () => {
    listeners.clear()
    for (const value of Object.values(controller)) {
      if (typeof value === 'function' && 'mockClear' in value) {
        ;(value as { mockClear: () => void }).mockClear()
      }
    }
  }

  return { controller, emit, reset }
})

vi.mock('./features/game/GameCanvas', async () => {
  const React = await import('react')
  return {
    GameCanvas: ({
      onControllerReady,
    }: {
      onControllerReady: (controller: typeof testBridge.controller | null) => void
    }) => {
      React.useEffect(() => {
        onControllerReady(testBridge.controller)
        return () => {
          onControllerReady(null)
        }
      }, [onControllerReady])

      return React.createElement('div', { 'data-testid': 'game-canvas' })
    },
  }
})

import App from './App'

describe('App on-chain flow', () => {
  beforeEach(() => {
    window.localStorage.clear()
    testBridge.reset()
    chainMocks.connect.mockClear()
    chainMocks.disconnect.mockClear()
    chainMocks.writeContractAsync.mockClear()
    chainMocks.invalidateQueries.mockClear()

    chainMocks.state.isConnected = false
    chainMocks.state.address = undefined
    chainMocks.state.chainId = 31337
    chainMocks.state.receipt = {
      isLoading: false,
      isSuccess: false,
      isError: false,
    }
    chainMocks.state.leaderboard = []
    chainMocks.state.bestScore = 0
    chainMocks.state.historyCount = 0
    chainMocks.state.historyItems = []
    chainMocks.state.queryEnabled = {}
    chainMocks.state.infiniteQueryEnabled = {}
  })

  it('blocks start and guides wallet connection when disconnected', () => {
    render(<App />)

    const start = screen.getByTestId('control-start')
    const githubLink = screen.getByRole('link', { name: 'GitHub' })
    expect(start).toBeDisabled()
    expect(screen.getByTestId('start-blocked-reason')).toHaveTextContent('请先连接钱包后开始')
    expect(githubLink).toHaveAttribute('href', 'https://github.com/Luboy23/foundry_advanced_turtorial')
    expect(githubLink.firstElementChild?.tagName.toLowerCase()).toBe('svg')
    expect(githubLink.querySelector('[data-testid="footer-github-icon"]')).not.toBeNull()

    fireEvent.click(start)
    expect(chainMocks.connect).not.toHaveBeenCalled()

    const connectButton = screen.getByRole('button', { name: '连接' })
    fireEvent.click(connectButton)
    expect(chainMocks.connect).toHaveBeenCalledTimes(1)
  })

  it('updates pause/resume state from game state events', () => {
    chainMocks.state.isConnected = true
    chainMocks.state.address = '0x0000000000000000000000000000000000000011'

    render(<App />)

    const start = screen.getByTestId('control-start')
    const pauseResume = screen.getByTestId('control-pause-resume')

    expect(start).toBeEnabled()
    expect(pauseResume).toBeDisabled()

    act(() => {
      testBridge.emit('onGameState', { state: 'running' })
    })

    expect(pauseResume).toBeEnabled()
    expect(pauseResume).toHaveTextContent('暂停')
    fireEvent.click(pauseResume)
    expect(testBridge.controller.pauseGame).toHaveBeenCalledTimes(1)

    act(() => {
      testBridge.emit('onGameState', { state: 'paused' })
    })

    expect(pauseResume).toHaveTextContent('继续')
    fireEvent.click(pauseResume)
    expect(testBridge.controller.resumeGame).toHaveBeenCalledTimes(1)
  })

  it('toggles pause/resume via Space and ignores repeat or input targets', () => {
    chainMocks.state.isConnected = true
    chainMocks.state.address = '0x0000000000000000000000000000000000000011'

    render(<App />)

    act(() => {
      testBridge.emit('onGameState', { state: 'running' })
    })

    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    expect(testBridge.controller.pauseGame).toHaveBeenCalledTimes(1)

    act(() => {
      testBridge.emit('onGameState', { state: 'paused' })
    })

    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    expect(testBridge.controller.resumeGame).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { code: 'Space', key: ' ', repeat: true })
    expect(testBridge.controller.resumeGame).toHaveBeenCalledTimes(1)

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireEvent.keyDown(input, { code: 'Space', key: ' ' })
    expect(testBridge.controller.resumeGame).toHaveBeenCalledTimes(1)
    input.blur()
    input.remove()
  })

  it('locks wallet disconnect outside idle and re-enables it after returning idle', () => {
    chainMocks.state.isConnected = true
    chainMocks.state.address = '0x0000000000000000000000000000000000000098'

    render(<App />)

    const disconnectButton = screen.getByRole('button', { name: '断开' })
    expect(disconnectButton).toBeEnabled()
    fireEvent.click(disconnectButton)
    expect(chainMocks.disconnect).toHaveBeenCalledTimes(1)
    chainMocks.disconnect.mockClear()

    act(() => {
      testBridge.emit('onGameState', { state: 'running' })
    })
    expect(screen.getByRole('button', { name: '断开' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '断开' }))
    expect(chainMocks.disconnect).not.toHaveBeenCalled()

    act(() => {
      testBridge.emit('onGameState', { state: 'paused' })
    })
    expect(screen.getByRole('button', { name: '断开' })).toBeDisabled()

    act(() => {
      testBridge.emit('onGameState', { state: 'gameover' })
    })
    expect(screen.getByRole('button', { name: '断开' })).toBeDisabled()

    act(() => {
      testBridge.emit('onGameState', { state: 'idle' })
    })
    const enabledAgain = screen.getByRole('button', { name: '断开' })
    expect(enabledAgain).toBeEnabled()
    fireEvent.click(enabledAgain)
    expect(chainMocks.disconnect).toHaveBeenCalledTimes(1)
  })

  it('auto submits score to chain after game over', async () => {
    chainMocks.state.isConnected = true
    chainMocks.state.address = '0x00000000000000000000000000000000000000AA'

    render(<App />)

    act(() => {
      testBridge.emit('onGameOver', {
        stats: {
          score: 123,
          survivalMs: 5500,
          maxDifficulty: 6,
          hitCount: 1,
          peakThreatLevel: 7.8,
          stablePlatformsSpawned: 10,
          movingPlatformsSpawned: 5,
          vanishingPlatformsSpawned: 8,
          totalLandings: 12,
          spikeSpawned: 15,
          boulderSpawned: 8,
          spikeDodged: 7,
          boulderDodged: 5,
          totalDodged: 12,
        },
        inputType: 'keyboard',
      })
      testBridge.emit('onGameState', { state: 'gameover' })
    })

    await waitFor(() => {
      expect(chainMocks.writeContractAsync).toHaveBeenCalledTimes(1)
    })

    const firstCall = chainMocks.writeContractAsync.mock.calls[0] as unknown as [
      {
        functionName: string
        args: [number, number, number]
      },
    ]
    const callArg = firstCall[0]
    expect(callArg.functionName).toBe('submitScore')
    expect(callArg.args).toEqual([123, 5500, 12])

    expect(
      await screen.findByText('链上提交状态：交易已发出，等待链上确认'),
    ).toBeInTheDocument()
  })

  it('locks settlement actions before on-chain confirmation succeeds', async () => {
    chainMocks.state.isConnected = true
    chainMocks.state.address = '0x00000000000000000000000000000000000000BB'

    render(<App />)

    act(() => {
      testBridge.emit('onGameOver', {
        stats: {
          score: 66,
          survivalMs: 3300,
          maxDifficulty: 5,
          hitCount: 1,
          peakThreatLevel: 6.2,
          stablePlatformsSpawned: 5,
          movingPlatformsSpawned: 4,
          vanishingPlatformsSpawned: 4,
          totalLandings: 5,
          spikeSpawned: 9,
          boulderSpawned: 4,
          spikeDodged: 3,
          boulderDodged: 2,
          totalDodged: 5,
        },
        inputType: 'keyboard',
      })
      testBridge.emit('onGameState', { state: 'gameover' })
    })

    await waitFor(() => {
      expect(chainMocks.writeContractAsync).toHaveBeenCalledTimes(1)
    })

    const closeButtons = screen.getAllByRole('button', { name: '关闭' })
    expect(closeButtons.length).toBeGreaterThan(0)
    for (const button of closeButtons) {
      expect(button).toBeDisabled()
    }
    expect(screen.getByRole('button', { name: '再来一局' })).toBeDisabled()
  })

  it('keeps settlement locked after signature rejection and shows retry action', async () => {
    chainMocks.state.isConnected = true
    chainMocks.state.address = '0x00000000000000000000000000000000000000EE'
    chainMocks.writeContractAsync.mockRejectedValueOnce(new Error('User rejected the request'))

    render(<App />)

    act(() => {
      testBridge.emit('onGameOver', {
        stats: {
          score: 88,
          survivalMs: 2200,
          maxDifficulty: 3,
          hitCount: 1,
          peakThreatLevel: 3.1,
          stablePlatformsSpawned: 3,
          movingPlatformsSpawned: 2,
          vanishingPlatformsSpawned: 1,
          totalLandings: 6,
          spikeSpawned: 2,
          boulderSpawned: 1,
          spikeDodged: 4,
          boulderDodged: 2,
          totalDodged: 6,
        },
        inputType: 'keyboard',
      })
      testBridge.emit('onGameState', { state: 'gameover' })
    })

    await waitFor(() => {
      expect(screen.getByText('你已取消钱包签名')).toBeInTheDocument()
    })

    expect(chainMocks.writeContractAsync).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '重试上链' })).toBeInTheDocument()
    for (const button of screen.getAllByRole('button', { name: '关闭' })) {
      expect(button).toBeDisabled()
    }
    expect(screen.getByRole('button', { name: '再来一局' })).toBeDisabled()
  })

  it('unlocks close/restart only after retry succeeds and receipt confirms', async () => {
    chainMocks.state.isConnected = true
    chainMocks.state.address = '0x00000000000000000000000000000000000000EF'
    chainMocks.writeContractAsync
      .mockRejectedValueOnce(new Error('User rejected the request'))
      .mockResolvedValueOnce('0xdef')

    render(<App />)

    act(() => {
      testBridge.emit('onGameOver', {
        stats: {
          score: 101,
          survivalMs: 4800,
          maxDifficulty: 6,
          hitCount: 1,
          peakThreatLevel: 6.9,
          stablePlatformsSpawned: 9,
          movingPlatformsSpawned: 4,
          vanishingPlatformsSpawned: 5,
          totalLandings: 11,
          spikeSpawned: 12,
          boulderSpawned: 5,
          spikeDodged: 7,
          boulderDodged: 4,
          totalDodged: 11,
        },
        inputType: 'keyboard',
      })
      testBridge.emit('onGameState', { state: 'gameover' })
    })

    await waitFor(() => {
      expect(screen.getByText('你已取消钱包签名')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '重试上链' }))
    await waitFor(() => {
      expect(chainMocks.writeContractAsync).toHaveBeenCalledTimes(2)
    })

    act(() => {
      chainMocks.state.receipt = {
        isLoading: false,
        isSuccess: true,
        isError: false,
      }
      testBridge.emit('onCountdown', { value: 1 })
    })

    await waitFor(() => {
      expect(screen.getByText('链上提交状态：成绩已成功上链')).toBeInTheDocument()
    })

    for (const button of screen.getAllByRole('button', { name: '关闭' })) {
      expect(button).toBeEnabled()
    }
    expect(screen.getByRole('button', { name: '再来一局' })).toBeEnabled()
  })

  it('skips on-chain submit for zero score and unlocks settlement actions', async () => {
    chainMocks.state.isConnected = true
    chainMocks.state.address = '0x00000000000000000000000000000000000000F0'

    render(<App />)

    act(() => {
      testBridge.emit('onGameOver', {
        stats: {
          score: 0,
          survivalMs: 2200,
          maxDifficulty: 3,
          hitCount: 1,
          peakThreatLevel: 3.1,
          stablePlatformsSpawned: 3,
          movingPlatformsSpawned: 2,
          vanishingPlatformsSpawned: 1,
          totalLandings: 0,
          spikeSpawned: 2,
          boulderSpawned: 1,
          spikeDodged: 0,
          boulderDodged: 0,
          totalDodged: 0,
        },
        inputType: 'keyboard',
      })
      testBridge.emit('onGameState', { state: 'gameover' })
    })

    await waitFor(() => {
      expect(screen.getByText('链上提交状态：零分局已跳过链上提交')).toBeInTheDocument()
    })

    expect(screen.getByText('零分局已跳过链上提交，不计入链上成绩')).toBeInTheDocument()
    expect(chainMocks.writeContractAsync).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '重试上链' })).not.toBeInTheDocument()
    for (const button of screen.getAllByRole('button', { name: '关闭' })) {
      expect(button).toBeEnabled()
    }
    expect(screen.getByRole('button', { name: '再来一局' })).toBeEnabled()
  })

  it('loads leaderboard and history queries lazily when dialogs open', async () => {
    chainMocks.state.isConnected = true
    chainMocks.state.address = '0x0000000000000000000000000000000000000022'

    render(<App />)

    expect(chainMocks.state.queryEnabled.leaderboard).toBeUndefined()
    expect(chainMocks.state.queryEnabled['history-count']).toBeUndefined()
    expect(chainMocks.state.infiniteQueryEnabled.history).toBeUndefined()
    expect(chainMocks.state.queryEnabled['best-score']).toBe(true)

    fireEvent.click(screen.getByTestId('control-leaderboard'))
    await waitFor(() => {
      expect(chainMocks.state.queryEnabled.leaderboard).toBe(true)
    })

    fireEvent.click(screen.getByTestId('control-history'))
    await waitFor(() => {
      expect(chainMocks.state.queryEnabled['history-count']).toBe(true)
      expect(chainMocks.state.infiniteQueryEnabled.history).toBe(true)
    })
  })

  it('invalidates only targeted on-chain queries after confirmation succeeds', async () => {
    chainMocks.state.isConnected = true
    chainMocks.state.address = '0x00000000000000000000000000000000000000CC'

    render(<App />)

    act(() => {
      testBridge.emit('onGameOver', {
        stats: {
          score: 99,
          survivalMs: 4200,
          maxDifficulty: 6,
          hitCount: 1,
          peakThreatLevel: 6.8,
          stablePlatformsSpawned: 8,
          movingPlatformsSpawned: 4,
          vanishingPlatformsSpawned: 3,
          totalLandings: 9,
          spikeSpawned: 12,
          boulderSpawned: 3,
          spikeDodged: 9,
          boulderDodged: 0,
          totalDodged: 9,
        },
        inputType: 'keyboard',
      })
      testBridge.emit('onGameState', { state: 'gameover' })
    })

    await waitFor(() => {
      expect(chainMocks.writeContractAsync).toHaveBeenCalledTimes(1)
    })

    act(() => {
      chainMocks.state.receipt = {
        isLoading: false,
        isSuccess: true,
        isError: false,
      }
      testBridge.emit('onCountdown', { value: 1 })
    })

    await waitFor(() => {
      expect(chainMocks.invalidateQueries).toHaveBeenCalled()
    })

    const invalidatedQueryKeys = chainMocks.invalidateQueries.mock.calls.map((call) => {
      const options = call[0] as { queryKey: unknown[] }
      return options.queryKey
    })

    expect(invalidatedQueryKeys).toEqual(
      expect.arrayContaining([
        ['downman', 'leaderboard', '0x0000000000000000000000000000000000000001'],
        ['downman', 'best-score', '0x0000000000000000000000000000000000000001', '0x00000000000000000000000000000000000000CC'],
        ['downman', 'history-count', '0x0000000000000000000000000000000000000001', '0x00000000000000000000000000000000000000CC'],
        ['downman', 'history', '0x0000000000000000000000000000000000000001', '0x00000000000000000000000000000000000000CC'],
      ]),
    )
    expect(
      invalidatedQueryKeys.some((queryKey) => Array.isArray(queryKey) && queryKey.length === 1),
    ).toBe(false)
  })
})
