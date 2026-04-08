import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GameState } from '../game/types'

/** 统一收拢 react-query 与 API mock，方便每个用例按 queryKey 定向覆写。 */
const hookMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  getApiHealth: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => hookMocks.useQuery(options),
  useQueryClient: () => ({ invalidateQueries: hookMocks.invalidateQueries }),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    getApiHealth: hookMocks.getApiHealth,
  }
})

vi.mock('../lib/contract', async () => {
  const actual = await vi.importActual<typeof import('../lib/contract')>('../lib/contract')
  return {
    ...actual,
    BRAVEMAN_ADDRESS: '0x1111111111111111111111111111111111111111',
    BRAVEMAN_ADDRESS_VALID: true,
  }
})

import { useChainQueries } from './useChainQueries'

/** 历史记录夹具：覆盖 kills/survival/gold 三个 UI 会展示的关键字段。 */
const historyEntry = {
  player: '0x1111111111111111111111111111111111111111' as const,
  kills: 9,
  survivalMs: 42000,
  goldEarned: 13,
  endedAt: 1711111111,
}

/** 构造一个满足当前 Hook 读取需求的最小 publicClient 桩。 */
const makePublicClient = () => ({
  multicall: vi.fn().mockResolvedValue([12n, 0n]),
  readContract: vi.fn().mockResolvedValue([
    {
      player: '0x1111111111111111111111111111111111111111',
      kills: 9n,
      survivalMs: 42000n,
      goldEarned: 13n,
      endedAt: 1711111111n,
    },
  ]),
})

/** 从最近一次 `useQuery` 调用中拿到指定 queryKey 的配置，便于直接验证 queryFn/轮询策略。 */
const getLatestQueryOptions = (key: string) => {
  const queryOptions = [...hookMocks.useQuery.mock.calls]
    .map(([options]) => options as {
      queryKey: unknown[]
      enabled?: boolean
      refetchInterval?: number | false
      queryFn: () => Promise<unknown>
    })
    .reverse()
    .find((options) => options.queryKey[1] === key)

  if (!queryOptions) {
    throw new Error(`Missing query options for ${key}`)
  }

  return queryOptions
}

describe('useChainQueries', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    hookMocks.useQuery.mockReset()
    hookMocks.invalidateQueries.mockClear()
    hookMocks.getApiHealth.mockReset()
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    })

    hookMocks.useQuery.mockImplementation((options: { queryKey: unknown[] }) => {
      const key = String(options.queryKey[1] ?? '')
      if (key === 'wallet-state') {
        return { data: { chainGold: 12, chainBowOwned: false }, isLoading: false, error: null }
      }
      if (key === 'history') {
        return { data: [historyEntry], isLoading: false, isFetching: false, error: null, refetch: vi.fn() }
      }
      if (key === 'history-count') {
        return { data: 1, isLoading: false, error: null, refetch: vi.fn() }
      }
      if (key === 'api-health') {
        return { data: { ok: true }, isLoading: false, error: null }
      }
      return { data: undefined, isLoading: false, error: null }
    })
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    })
  })

  it('uses one wallet-state query and skips history reads while the modal is closed', async () => {
    // 前置条件：历史弹窗关闭，只应读取钱包资产，不应触发历史链上读取。
    const publicClient = makePublicClient()
    const { result } = renderHook(() => useChainQueries({
      publicClient: publicClient as never,
      effectiveAddress: '0x1111111111111111111111111111111111111111',
      hasContractAddress: true,
      isHistoryOpen: false,
      gameState: 'idle',
      optimisticBowOwned: false,
    }))

    const walletQueryCalls = hookMocks.useQuery.mock.calls.filter(
      ([options]) => (options as { queryKey: unknown[] }).queryKey[1] === 'wallet-state',
    )

    expect(walletQueryCalls).toHaveLength(1)
    expect(result.current.chainGold).toBe(12)
    expect(result.current.bowOwned).toBe(false)

    // 执行动作：直接调用钱包 queryFn，确认 multicall 会被使用。
    const walletOptions = getLatestQueryOptions('wallet-state')
    await walletOptions.queryFn()
    expect(publicClient.multicall).toHaveBeenCalledTimes(1)

    // 断言目标：历史 query 保持禁用，且缓存失效入口会同时刷新三类数据。
    const historyOptions = getLatestQueryOptions('history')
    expect(historyOptions.enabled).toBe(false)
    expect(publicClient.readContract).not.toHaveBeenCalled()

    await result.current.invalidateChainData()
    expect(hookMocks.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['braveman', 'wallet-state'],
    })
    expect(hookMocks.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['braveman', 'history'],
    })
    expect(hookMocks.invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ['braveman', 'history-count'],
    })
  })

  it('falls back to direct balance reads when multicall is unavailable', async () => {
    // 前置条件：multicall 失败，Hook 应自动回退为两次 `balanceOf` 直读。
    const publicClient = {
      multicall: vi.fn().mockRejectedValue(new Error('multicall unavailable')),
      readContract: vi.fn().mockImplementation(({ functionName, args }: {
        functionName: string
        args: readonly unknown[]
      }) => {
        if (functionName === 'balanceOf' && args[1] === 1n) return Promise.resolve(34n)
        if (functionName === 'balanceOf' && args[1] === 2n) return Promise.resolve(1n)
        return Promise.resolve([
          {
            player: '0x1111111111111111111111111111111111111111',
            kills: 9n,
            survivalMs: 42000n,
            goldEarned: 13n,
            endedAt: 1711111111n,
          },
        ])
      }),
    }

    renderHook(() => useChainQueries({
      publicClient: publicClient as never,
      effectiveAddress: '0x1111111111111111111111111111111111111111',
      hasContractAddress: true,
      isHistoryOpen: false,
      gameState: 'idle',
      optimisticBowOwned: false,
    }))

    const walletOptions = getLatestQueryOptions('wallet-state')
    await expect(walletOptions.queryFn()).resolves.toEqual({
      chainGold: 34,
      chainBowOwned: true,
    })
    expect(publicClient.multicall).toHaveBeenCalledTimes(1)
    expect(publicClient.readContract).toHaveBeenCalledTimes(2)
  })

  it('polls api health only while idle and slows down when the page becomes hidden', async () => {
    // 前置条件：大厅态允许探活轮询，页面进入后台后应自动降频。
    const publicClient = makePublicClient()
    const { rerender } = renderHook(
      ({ gameState }: { gameState: GameState }) => useChainQueries({
        publicClient: publicClient as never,
        effectiveAddress: '0x1111111111111111111111111111111111111111',
        hasContractAddress: true,
        isHistoryOpen: false,
        gameState,
        optimisticBowOwned: false,
      }),
      {
        initialProps: { gameState: 'idle' as GameState },
      },
    )

    expect(getLatestQueryOptions('api-health').enabled).toBe(true)
    expect(getLatestQueryOptions('api-health').refetchInterval).toBe(5000)

    act(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => {
      expect(getLatestQueryOptions('api-health').refetchInterval).toBe(30000)
    })

    rerender({ gameState: 'running' as GameState })
    expect(getLatestQueryOptions('api-health').enabled).toBe(false)
    expect(getLatestQueryOptions('api-health').refetchInterval).toBe(false)
  })

  it('surfaces api health message when the backend reports ok=false', () => {
    // 前置条件：后端返回 ok=false，Hook 应把 message 透传为开始按钮门禁文案。
    hookMocks.useQuery.mockImplementation((options: { queryKey: unknown[] }) => {
      const key = String(options.queryKey[1] ?? '')
      if (key === 'wallet-state') {
        return { data: { chainGold: 12, chainBowOwned: false }, isLoading: false, error: null }
      }
      if (key === 'history') {
        return { data: [], isLoading: false, isFetching: false, error: null, refetch: vi.fn() }
      }
      if (key === 'history-count') {
        return { data: 0, isLoading: false, error: null, refetch: vi.fn() }
      }
      if (key === 'api-health') {
        return {
          data: {
            ok: false,
            message: '本地链或游戏合约尚未就绪，请确认 Anvil 正在运行，并重新执行 make deploy 或 make dev。',
          },
          isLoading: false,
          error: null,
        }
      }
      return { data: undefined, isLoading: false, error: null }
    })

    const { result } = renderHook(() => useChainQueries({
      publicClient: makePublicClient() as never,
      effectiveAddress: '0x1111111111111111111111111111111111111111',
      hasContractAddress: true,
      isHistoryOpen: false,
      gameState: 'idle',
      optimisticBowOwned: false,
    }))

    expect(result.current.apiUnavailableReason).toBe(
      '本地链或游戏合约尚未就绪，请确认 Anvil 正在运行，并重新执行 make deploy 或 make dev。',
    )
  })

  it('expands history limit in fixed 20-entry steps when loading more', () => {
    const publicClient = makePublicClient()
    const { result } = renderHook(() => useChainQueries({
      publicClient: publicClient as never,
      effectiveAddress: '0x1111111111111111111111111111111111111111',
      hasContractAddress: true,
      isHistoryOpen: true,
      gameState: 'idle',
      optimisticBowOwned: false,
    }))

    const initialHistoryKey = getLatestQueryOptions('history').queryKey
    expect(initialHistoryKey[initialHistoryKey.length - 1]).toBe(20)

    act(() => {
      result.current.historyQueryState.loadMore()
    })

    const expandedHistoryKey = getLatestQueryOptions('history').queryKey
    expect(expandedHistoryKey[expandedHistoryKey.length - 1]).toBe(40)
  })
})
