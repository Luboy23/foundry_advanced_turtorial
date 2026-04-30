import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RunSummary } from '../game/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { LevelCatalogEntry } from '../game/types'
import { ApiError, fetchIndexedHistory, fetchIndexedLeaderboard } from '../lib/api'
import {
  ANGRY_BIRDS_CHAIN_ID,
  ANGRY_BIRDS_DEPLOYMENT_ID,
} from '../lib/chain'
import {
  ANGRY_BIRDS_LEVEL_CATALOG_ABI,
  ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS,
  ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS_VALID,
  ANGRY_BIRDS_SCOREBOARD_ABI,
  ANGRY_BIRDS_SCOREBOARD_ADDRESS,
  ANGRY_BIRDS_SCOREBOARD_ADDRESS_VALID,
  normalizeLeaderboardEntry,
  normalizeLevelConfig,
  normalizeRunResult,
} from '../lib/contract'
import { attachLeaderboardMetadata } from '../lib/leaderboard'
import { getPublicClient } from '../lib/publicClient'

type PageVisibilityState = 'visible' | 'hidden'

type UseAngryBirdsChainQueriesOptions = {
  address?: `0x${string}`
  localLevels: LevelCatalogEntry[]
}

// 监听页面可见性，用于动态调整轮询频率。
const usePageVisibility = (): PageVisibilityState => {
  const getVisibilityState = (): PageVisibilityState => {
    if (typeof document === 'undefined') {
      return 'visible'
    }
    return document.hidden ? 'hidden' : 'visible'
  }

  const [visibilityState, setVisibilityState] = useState<PageVisibilityState>(getVisibilityState)

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const syncVisibilityState = () => setVisibilityState(getVisibilityState())
    document.addEventListener('visibilitychange', syncVisibilityState)
    return () => document.removeEventListener('visibilitychange', syncVisibilityState)
  }, [])

  return visibilityState
}

// 页面可见时高频刷新，后台标签页降频减少资源占用。
const getLeaderboardRefetchInterval = (visibilityState: PageVisibilityState) =>
  visibilityState === 'visible' ? 15_000 : 45_000

const FORCE_CHAIN_READ_WINDOW_MS = 15_000
export const MAX_LEADERBOARD_ROWS = 10

const capLeaderboardRows = <T,>(rows: T[]) => rows.slice(0, MAX_LEADERBOARD_ROWS)

// 统一管理目录、排行榜、历史记录三类查询，并封装链上/索引器回退策略。
export const useAngryBirdsChainQueries = ({
  address,
  localLevels,
}: UseAngryBirdsChainQueriesOptions) => {
  const queryClient = useQueryClient()
  const visibilityState = usePageVisibility()
  const [forceChainReadUntilMs, setForceChainReadUntilMs] = useState(0)
  const forceChainReadUntilRef = useRef(0)

  // 在关键窗口内强制走链上读取，避免索引延迟导致 UI 显示旧数据。
  const extendForceChainReadWindow = useCallback((durationMs = FORCE_CHAIN_READ_WINDOW_MS) => {
    const nextUntil = Date.now() + durationMs
    const effectiveUntil = Math.max(forceChainReadUntilRef.current, nextUntil)
    forceChainReadUntilRef.current = effectiveUntil
    setForceChainReadUntilMs(effectiveUntil)
  }, [])

  useEffect(() => {
    forceChainReadUntilRef.current = forceChainReadUntilMs
  }, [forceChainReadUntilMs])

  // 到期后自动关闭强制链读窗口。
  useEffect(() => {
    if (forceChainReadUntilMs <= 0) {
      return
    }

    const remainingMs = forceChainReadUntilMs - Date.now()
    if (remainingMs <= 0) {
      forceChainReadUntilRef.current = 0
      setForceChainReadUntilMs(0)
      return
    }

    const timer = window.setTimeout(() => {
      forceChainReadUntilRef.current = 0
      setForceChainReadUntilMs(0)
    }, remainingMs)

    return () => window.clearTimeout(timer)
  }, [forceChainReadUntilMs])

  const isForceChainReadActive = forceChainReadUntilMs > Date.now()
  const leaderboardQueryKey = ['angry-birds', 'leaderboard', ANGRY_BIRDS_CHAIN_ID, ANGRY_BIRDS_DEPLOYMENT_ID] as const
  const historyQueryKey = ['angry-birds', 'history', ANGRY_BIRDS_CHAIN_ID, ANGRY_BIRDS_DEPLOYMENT_ID, address] as const

  // 直接从合约读取全局榜，作为索引器不可用时的兜底数据源。
  const readChainLeaderboard = useCallback(async () => {
    const rows = (await getPublicClient().readContract({
      address: ANGRY_BIRDS_SCOREBOARD_ADDRESS!,
      abi: ANGRY_BIRDS_SCOREBOARD_ABI,
      functionName: 'getGlobalLeaderboard',
    })) as unknown[]
    return capLeaderboardRows(rows.map((row) => normalizeLeaderboardEntry(row)))
  }, [])

  // 直接从合约读取当前钱包历史记录。
  const readChainHistory = useCallback(async () => {
    if (!address) {
      return []
    }

    const results = (await getPublicClient().readContract({
      address: ANGRY_BIRDS_SCOREBOARD_ADDRESS!,
      abi: ANGRY_BIRDS_SCOREBOARD_ABI,
      functionName: 'getUserHistory',
      args: [address, 0n, 20n],
    })) as unknown[]
    return results.map((result) => normalizeRunResult(result))
  }, [address])

  // 排行榜优先读索引器；可重试错误时回退到链上读。
  const fetchLeaderboardData = useCallback(async () => {
    if (forceChainReadUntilRef.current > Date.now()) {
      return readChainLeaderboard()
    }

    try {
      const rows = await fetchIndexedLeaderboard(MAX_LEADERBOARD_ROWS)
      return capLeaderboardRows(rows.map((row) => ({
        player: row.player,
        result: row.result,
      })))
    } catch (error) {
      if (!(error instanceof ApiError) || !error.retriable) {
        throw error
      }
      return readChainLeaderboard()
    }
  }, [readChainLeaderboard])

  // 历史记录优先读索引器；可重试错误时回退到链上读。
  const fetchHistoryData = useCallback(async () => {
    if (!address) {
      return []
    }

    if (forceChainReadUntilRef.current > Date.now()) {
      return readChainHistory()
    }

    try {
      const results = await fetchIndexedHistory(address, { offset: 0, limit: 20 })
      return results.map((entry) => entry.result)
    } catch (error) {
      if (!(error instanceof ApiError) || !error.retriable) {
        throw error
      }
      return readChainHistory()
    }
  }, [address, readChainHistory])

  // 关卡目录读取链上目录合约，得到可用关卡配置。
  const catalogQuery = useQuery({
    queryKey: ['angry-birds', 'catalog', ANGRY_BIRDS_CHAIN_ID, ANGRY_BIRDS_DEPLOYMENT_ID],
    enabled: Boolean(ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS_VALID && ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS),
    queryFn: async () => {
      const levels = (await getPublicClient().readContract({
        address: ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS!,
        abi: ANGRY_BIRDS_LEVEL_CATALOG_ABI,
        functionName: 'getCatalog',
      })) as unknown[]

      return levels.map((level) => normalizeLevelConfig(level)).sort((left, right) => left.order - right.order)
    },
    staleTime: 5 * 60 * 1_000,
    gcTime: 10 * 60 * 1_000,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  })

  // 全局排行榜查询。
  const leaderboardQuery = useQuery({
    queryKey: leaderboardQueryKey,
    enabled: Boolean(ANGRY_BIRDS_SCOREBOARD_ADDRESS_VALID && ANGRY_BIRDS_SCOREBOARD_ADDRESS),
    queryFn: fetchLeaderboardData,
    refetchInterval: getLeaderboardRefetchInterval(visibilityState),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  })

  // 给排行榜条目补关卡标签/顺序等展示元数据。
  const leaderboardEntries = useMemo(
    () => capLeaderboardRows(attachLeaderboardMetadata(leaderboardQuery.data ?? [], catalogQuery.data ?? [], localLevels)),
    [catalogQuery.data, leaderboardQuery.data, localLevels],
  )

  // 当前地址历史查询。
  const historyQuery = useQuery({
    queryKey: historyQueryKey,
    enabled: Boolean(address && ANGRY_BIRDS_SCOREBOARD_ADDRESS_VALID && ANGRY_BIRDS_SCOREBOARD_ADDRESS),
    queryFn: fetchHistoryData,
    staleTime: 30_000,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  })

  // 提供细粒度失效能力，供业务流程按需刷新。
  const invalidateCatalog = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['angry-birds', 'catalog'] }),
    [queryClient],
  )

  const invalidateLeaderboard = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['angry-birds', 'leaderboard'] }),
    [queryClient],
  )

  const invalidateHistory = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['angry-birds', 'history'] }),
    [queryClient],
  )

  // 提供统一失效入口，允许按目标集合批量触发重拉。
  const invalidateChainData = useCallback(
    async (targets: Array<'catalog' | 'leaderboard' | 'history'> = ['catalog', 'leaderboard', 'history']) => {
      await Promise.all(
        targets.map((target) => {
          if (target === 'catalog') {
            return invalidateCatalog()
          }
          if (target === 'leaderboard') {
            return invalidateLeaderboard()
          }
          return invalidateHistory()
        }),
      )
    },
    [invalidateCatalog, invalidateHistory, invalidateLeaderboard],
  )

  // 手动刷新排行榜：先取消同 key 请求，避免竞态覆盖。
  const refreshLeaderboard = useCallback(async () => {
    await queryClient.cancelQueries({ queryKey: leaderboardQueryKey })
    return leaderboardQuery.refetch()
  }, [leaderboardQuery, leaderboardQueryKey, queryClient])

  // 手动刷新历史；未连接钱包时直接返回成功状态。
  const refreshHistory = useCallback(async () => {
    if (!address) {
      return { data: historyQuery.data, error: null, status: 'success' as const }
    }

    await queryClient.cancelQueries({ queryKey: historyQueryKey })
    return historyQuery.refetch()
  }, [address, historyQuery, historyQueryKey, queryClient])

  // 一局确认后触发短时强制链读，并并行刷新榜单与历史。
  const refreshAfterConfirmedRun = useCallback(
    async (_summary: RunSummary) => {
      extendForceChainReadWindow()
      await Promise.all([refreshLeaderboard(), refreshHistory()])
    },
    [extendForceChainReadWindow, refreshHistory, refreshLeaderboard],
  )

  return {
    catalogQuery,
    leaderboardQuery,
    historyQuery,
    invalidateCatalog,
    invalidateLeaderboard,
    invalidateHistory,
    invalidateChainData,
    refreshLeaderboard,
    refreshHistory,
    refreshAfterConfirmedRun,
    leaderboardRefreshing: leaderboardQuery.isFetching && !leaderboardQuery.isLoading,
    historyRefreshing: historyQuery.isFetching && !historyQuery.isLoading,
    forceChainReadActive: isForceChainReadActive,
    chainCatalog: catalogQuery.data ?? [],
    leaderboardEntries,
    historyEntries: historyQuery.data ?? [],
  }
}
