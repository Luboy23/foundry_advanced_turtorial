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
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const key = String(queryKey?.[1] ?? '')
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
  useInfiniteQuery: () => ({
    data: { pages: [{ items: chainMocks.state.historyItems }] },
    isLoading: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }),
}))

vi.mock('./lib/contract', () => ({
  STONEFALL_ABI: [],
  STONEFALL_ADDRESS: '0x0000000000000000000000000000000000000001',
  STONEFALL_ADDRESS_VALID: true,
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
    debugGetPlayerX: vi.fn(() => 640),
    debugGetPlayerVelocityX: vi.fn(() => 0),
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
    chainMocks.state.address = '0x0000000000000000000000000000000000000012'

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
    chainMocks.state.address = '0x0000000000000000000000000000000000000099'

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

  it('marks score=0 settlement failure as terminal and unlocks close/restart without retry', async () => {
    chainMocks.state.isConnected = true
    chainMocks.state.address = '0x00000000000000000000000000000000000000DD'

    render(<App />)

    act(() => {
      testBridge.emit('onGameOver', {
        stats: {
          score: 0,
          survivalMs: 0,
          maxDifficulty: 1,
          hitCount: 1,
          peakThreatLevel: 1.2,
          spikeSpawned: 0,
          boulderSpawned: 0,
          spikeDodged: 0,
          boulderDodged: 0,
          totalDodged: 0,
        },
        inputType: 'keyboard',
      })
      testBridge.emit('onGameState', { state: 'gameover' })
    })

    await waitFor(() => {
      expect(screen.getByText('分数为 0，无法上链提交')).toBeInTheDocument()
    })

    expect(chainMocks.writeContractAsync).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '重试上链' })).not.toBeInTheDocument()
    const closeButtons = screen.getAllByRole('button', { name: '关闭' })
    expect(closeButtons.at(-1)).toBeEnabled()
    expect(screen.getByRole('button', { name: '再来一局' })).toBeEnabled()
  })
})
