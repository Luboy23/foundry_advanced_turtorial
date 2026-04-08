import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PublicClient } from 'viem'

import type { GameState } from '../game/types'
import { getApiHealth } from '../lib/api'
import {
  BOW_UNLOCK_TOKEN_ID,
  BRAVEMAN_ABI,
  BRAVEMAN_ADDRESS,
  GOLD_TOKEN_ID,
  toChainRunRecord,
} from '../lib/contract'

type WalletState = {
  chainGold: number
  chainBowOwned: boolean
}

type PageVisibilityState = 'visible' | 'hidden'

type UseChainQueriesOptions = {
  publicClient: PublicClient | null | undefined
  effectiveAddress?: `0x${string}`
  hasContractAddress: boolean
  isHistoryOpen: boolean
  gameState: GameState
  optimisticBowOwned: boolean
}

/** 当钱包尚未连接或链上读取尚未完成时，先回退到空资产态。 */
const initialWalletState: WalletState = {
  chainGold: 0,
  chainBowOwned: false,
}

/** 历史弹窗每次按页增量读取的条数。 */
const HISTORY_PAGE_SIZE = 20

/**
 * 使用逐条 `readContract` 读取钱包资产状态。
 * 该路径只在 multicall 不可用或失败时启用，作为链上读取的回退方案。
 */
const readWalletStateViaDirectCalls = async (
  publicClient: PublicClient,
  effectiveAddress: `0x${string}`,
): Promise<WalletState> => {
  const [goldBalance, bowBalance] = await Promise.all([
    publicClient.readContract({
      address: BRAVEMAN_ADDRESS!,
      abi: BRAVEMAN_ABI,
      functionName: 'balanceOf',
      args: [effectiveAddress, GOLD_TOKEN_ID],
    }),
    publicClient.readContract({
      address: BRAVEMAN_ADDRESS!,
      abi: BRAVEMAN_ABI,
      functionName: 'balanceOf',
      args: [effectiveAddress, BOW_UNLOCK_TOKEN_ID],
    }),
  ]) as [bigint, bigint]

  return {
    chainGold: Number(goldBalance),
    chainBowOwned: bowBalance > 0n,
  }
}

/**
 * 追踪页面可见性，用于控制后台轮询频率。
 * 目标是页面不可见时降低 API 探活频率，减少本地开发环境噪音。
 */
const usePageVisibility = (): PageVisibilityState => {
  /** 在 SSR 环境下默认视为可见，避免访问 `document.hidden`。 */
  const getVisibilityState = (): PageVisibilityState => {
    if (typeof document === 'undefined') return 'visible'
    return document.hidden ? 'hidden' : 'visible'
  }

  const [visibilityState, setVisibilityState] = useState<PageVisibilityState>(getVisibilityState)

  useEffect(() => {
    if (typeof document === 'undefined') return

    // 页面切前台/后台时立即同步状态，驱动探活轮询降频。
    const syncVisibilityState = () => {
      setVisibilityState(getVisibilityState())
    }

    document.addEventListener('visibilitychange', syncVisibilityState)
    return () => document.removeEventListener('visibilitychange', syncVisibilityState)
  }, [])

  return visibilityState
}

/**
 * 聚合 BraveMan 前端所需的链上只读数据与 API 健康状态。
 * 返回内容涵盖：资产余额、霜翎逐月拥有状态、历史记录、开始按钮门禁与缓存失效入口。
 */
export const useChainQueries = ({
  publicClient,
  effectiveAddress,
  hasContractAddress,
  isHistoryOpen,
  gameState,
  optimisticBowOwned,
}: UseChainQueriesOptions) => {
  const queryClient = useQueryClient()
  const visibilityState = usePageVisibility()
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE)

  useEffect(() => {
    if (isHistoryOpen) return
    // 历史弹窗关闭时重置分页窗口，下次打开从第一页重新开始。
    setHistoryLimit(HISTORY_PAGE_SIZE)
  }, [isHistoryOpen])

  const walletStateQuery = useQuery({
    queryKey: ['braveman', 'wallet-state', BRAVEMAN_ADDRESS, effectiveAddress],
    enabled: hasContractAddress && !!publicClient && !!effectiveAddress,
    queryFn: async (): Promise<WalletState> => {
      try {
        // 优先使用 multicall 一次性读取 GOLD 与弓解锁状态，减少 RPC 往返次数。
        const [goldBalance, bowBalance] = await publicClient!.multicall({
          allowFailure: false,
          contracts: [
            {
              address: BRAVEMAN_ADDRESS!,
              abi: BRAVEMAN_ABI,
              functionName: 'balanceOf',
              args: [effectiveAddress!, GOLD_TOKEN_ID],
            },
            {
              address: BRAVEMAN_ADDRESS!,
              abi: BRAVEMAN_ABI,
              functionName: 'balanceOf',
              args: [effectiveAddress!, BOW_UNLOCK_TOKEN_ID],
            },
          ],
        }) as [bigint, bigint]

        return {
          chainGold: Number(goldBalance),
          chainBowOwned: bowBalance > 0n,
        }
      } catch (error) {
        // 本地链偶发不支持 multicall 时，回退到逐条读取，优先保证功能可用。
        console.warn('braveman wallet multicall failed, falling back to direct reads', error)
        return readWalletStateViaDirectCalls(publicClient!, effectiveAddress!)
      }
    },
    staleTime: 3000,
  })

  const historyQuery = useQuery({
    queryKey: ['braveman', 'history', BRAVEMAN_ADDRESS, effectiveAddress, historyLimit],
    enabled: isHistoryOpen && hasContractAddress && !!publicClient && !!effectiveAddress,
    queryFn: async () => {
      // 历史记录只在弹窗打开时读取，避免大厅态无意义轮询。
      const result = await publicClient!.readContract({
        address: BRAVEMAN_ADDRESS!,
        abi: BRAVEMAN_ABI,
        functionName: 'getUserHistory',
        args: [effectiveAddress!, 0n, BigInt(historyLimit)],
      }) as Array<{
        player: `0x${string}`
        kills: bigint
        survivalMs: bigint
        goldEarned: bigint
        endedAt: bigint
      }>

      return result.map(toChainRunRecord)
    },
    staleTime: 5000,
  })

  const historyCountQuery = useQuery({
    queryKey: ['braveman', 'history-count', BRAVEMAN_ADDRESS, effectiveAddress],
    enabled: isHistoryOpen && hasContractAddress && !!publicClient && !!effectiveAddress,
    queryFn: async () => {
      // 单独读取总数，用于控制“加载更多”按钮与分页终点。
      const result = await publicClient!.readContract({
        address: BRAVEMAN_ADDRESS!,
        abi: BRAVEMAN_ABI,
        functionName: 'getUserHistoryCount',
        args: [effectiveAddress!],
      }) as bigint

      return Number(result)
    },
    staleTime: 5000,
  })

  const apiHealthQuery = useQuery({
    queryKey: ['braveman', 'api-health'],
    queryFn: ({ signal }) => getApiHealth({ signal }),
    enabled: gameState === 'idle',
    staleTime: 1500,
    // 仅在大厅态轮询后端健康状态；页面隐藏时进一步降频。
    refetchInterval: gameState !== 'idle' ? false : visibilityState === 'visible' ? 5000 : 30000,
    refetchIntervalInBackground: true,
    retry: false,
  })

  // 所有派生展示态统一从 query 结果归一化，避免 UI 层散落重复判断。
  const walletState = walletStateQuery.data ?? initialWalletState
  const chainGold = walletState.chainGold
  const chainBowOwned = walletState.chainBowOwned
  const bowOwned = chainBowOwned || optimisticBowOwned
  const historyEntries = historyQuery.data ?? []
  const historyCount = historyCountQuery.data ?? historyEntries.length
  // 开始按钮与提示文案统一消费这一条“后端不可用原因”，避免多处分叉判断。
  const apiUnavailableReason = apiHealthQuery.error
    ? '对局服务连接失败，请确认 make dev 已启动完成。'
    : apiHealthQuery.data && !apiHealthQuery.data.ok
      ? apiHealthQuery.data.message ?? '对局服务暂未就绪，请稍候再开始。'
      : !apiHealthQuery.data
      ? '对局服务正在就绪，请稍候再开始。'
      : null

  /** 统一失效链上缓存，供购买、结算成功后刷新钱包与历史数据。 */
  const invalidateChainData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['braveman', 'wallet-state'] }),
      queryClient.invalidateQueries({ queryKey: ['braveman', 'history'] }),
      queryClient.invalidateQueries({ queryKey: ['braveman', 'history-count'] }),
    ])
  }, [queryClient])

  /** 追加历史分页窗口大小，驱动下一次 `getUserHistory` 读取更多记录。 */
  const loadMoreHistory = useCallback(() => {
    setHistoryLimit((current) => current + HISTORY_PAGE_SIZE)
  }, [])

  /** 当历史读取失败时，同时重试列表与总数，保持分页状态一致。 */
  const retryHistory = useCallback(async () => {
    await Promise.all([
      historyCountQuery.refetch(),
      historyQuery.refetch(),
    ])
  }, [historyCountQuery, historyQuery])

  /** 通过当前已加载条数与总数判断是否还有下一页。 */
  const hasMoreHistory = historyEntries.length < historyCount

  return {
    chainGold,
    chainBowOwned,
    bowOwned,
    historyQueryState: {
      entries: historyEntries,
      isLoading: historyQuery.isLoading,
      isError: Boolean(historyQuery.error),
      isLoadingMore: historyQuery.isFetching && historyEntries.length > 0,
      hasMore: hasMoreHistory,
      total: historyCount,
      retry: retryHistory,
      loadMore: loadMoreHistory,
    },
    apiUnavailableReason,
    invalidateChainData,
  }
}
