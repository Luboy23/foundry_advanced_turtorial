import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  buildProgressStorageKey,
  loadLastPlayedLevel,
  loadProgress,
  loadSettings,
  saveProgress,
  saveSettings,
} from '../features/progress/localStore'
import { loadLevelCatalog } from '../game/content'
import type {
  ChainPanelState,
  HistoryRow,
  ProgressSnapshot,
  SettingsState,
} from '../game/types'
import { useAngryBirdsChainQueries } from './useAngryBirdsChainQueries'
import { shortAddress } from '../lib/contract'
import type { AngryBirdsRuntimeConfig } from '../lib/runtime-config'
import { resolveResumeLevel } from '../game/resume'

type UseGameShellControllerOptions = {
  runtimeConfig: AngryBirdsRuntimeConfig
  effectiveAddress?: `0x${string}`
  currentLevelId: string | null
}

// 聚合游戏壳层状态：本地进度、链上查询、关卡合并与侧边面板数据。
export const useGameShellController = ({
  runtimeConfig,
  effectiveAddress,
  currentLevelId,
}: UseGameShellControllerOptions) => {
  const [settings, setSettings] = useState(() => loadSettings())

  const progressScope = useMemo(
    () => ({
      chainId: runtimeConfig.chainId,
      deploymentId: runtimeConfig.deploymentId,
      walletAddress: effectiveAddress,
    }),
    [effectiveAddress, runtimeConfig.chainId, runtimeConfig.deploymentId],
  )
  const runSyncScope = useMemo(
    () => ({
      chainId: runtimeConfig.chainId,
      deploymentId: runtimeConfig.deploymentId,
      walletAddress: effectiveAddress,
    }),
    [effectiveAddress, runtimeConfig.chainId, runtimeConfig.deploymentId],
  )
  const progressStorageKey = useMemo(() => buildProgressStorageKey(progressScope), [progressScope])
  const [progressState, setProgressState] = useState<{
    ownerKey: string
    snapshot: ProgressSnapshot
  }>(() => ({
    ownerKey: progressStorageKey,
    snapshot: loadProgress(progressScope),
  }))
  const progress =
    progressState.ownerKey === progressStorageKey ? progressState.snapshot : loadProgress(progressScope)

  // 在当前 scope 内更新进度；当 scope 切换时自动回退到对应存档再计算。
  const updateProgress = useCallback(
    (nextProgress: ProgressSnapshot | ((current: ProgressSnapshot) => ProgressSnapshot)) => {
      setProgressState((current) => {
        const base = current.ownerKey === progressStorageKey ? current.snapshot : loadProgress(progressScope)
        return {
          ownerKey: progressStorageKey,
          snapshot: typeof nextProgress === 'function' ? nextProgress(base) : nextProgress,
        }
      })
    },
    [progressScope, progressStorageKey],
  )

  // 局部更新设置状态。
  const updateGameSettings = useCallback((patch: Partial<SettingsState>) => {
    setSettings((current) => ({
      ...current,
      ...patch,
    }))
  }, [])

  const levelsQuery = useQuery({
    queryKey: ['angry-birds', 'local-level-catalog'],
    queryFn: loadLevelCatalog,
  })

  const chainQueries = useAngryBirdsChainQueries({
    address: effectiveAddress,
    localLevels: levelsQuery.data?.levels ?? [],
  })

  // 将链上目录与本地关卡定义合并，形成最终可游玩关卡列表。
  const mergedLevels = useMemo(() => {
    const localLevels = levelsQuery.data?.levels ?? []
    const chainByKey = new Map(
      chainQueries.chainCatalog.map((level) => [`${level.levelId}:${level.version}`, level] as const),
    )

    return localLevels
      .map((level) => {
        const chainLevel = chainByKey.get(`${level.levelId}:${level.version}`)
        return {
          ...level,
          manifest: {
            ...level.manifest,
            order: chainLevel?.order ?? level.manifest.order,
            enabled: chainLevel?.enabled ?? level.manifest.enabled,
            contentHash: chainLevel?.contentHash ?? level.manifest.contentHash,
          },
        }
      })
      .sort((left, right) => left.manifest.order - right.manifest.order)
  }, [chainQueries.chainCatalog, levelsQuery.data?.levels])

  const persistedLastPlayedLevelId = useMemo(() => loadLastPlayedLevel(progressScope), [progressStorageKey, progressScope])
  const currentLevel = mergedLevels.find((level) => level.levelId === currentLevelId) ?? null
  const resumeLevel = useMemo(
    () =>
      resolveResumeLevel({
        levels: mergedLevels,
        progress,
        currentLevelId: currentLevelId ?? null,
        lastPlayedLevelId: persistedLastPlayedLevelId,
      }),
    [currentLevelId, mergedLevels, persistedLastPlayedLevelId, progress],
  )
  const selectedLevel = currentLevel ?? resumeLevel ?? mergedLevels[0] ?? null
  const lastPlayedLevelId =
    currentLevel && progress.unlockedOrders.includes(currentLevel.manifest.order)
      ? currentLevel.levelId
      : persistedLastPlayedLevelId ?? resumeLevel?.levelId ?? null
  const resumeLevelId = resumeLevel?.levelId ?? null

  // 构建链面板展示数据（排行榜/历史/加载态/提示文案）。
  const chainPanelState = useMemo<ChainPanelState>(() => {
    const levelLabelById = new Map(mergedLevels.map((level) => [level.levelId, level.map.label]))

    return {
      isLoading:
        levelsQuery.isLoading || chainQueries.leaderboardQuery.isLoading || chainQueries.historyQuery.isLoading,
      error:
        (levelsQuery.error as Error | undefined)?.message ??
        (chainQueries.leaderboardQuery.error as Error | undefined)?.message ??
        (chainQueries.historyQuery.error as Error | undefined)?.message ??
        null,
      leaderboardLoading: chainQueries.leaderboardQuery.isLoading,
      historyLoading: chainQueries.historyQuery.isLoading,
      leaderboardRefreshing: chainQueries.leaderboardRefreshing,
      historyRefreshing: chainQueries.historyRefreshing,
      leaderboardSyncMessage:
        chainQueries.leaderboardRefreshing && chainQueries.leaderboardEntries.length === 0 ? '排行榜同步中…' : null,
      historySyncMessage:
        chainQueries.historyRefreshing && chainQueries.historyEntries.length === 0 ? '历史记录同步中…' : null,
      leaderboard: chainQueries.leaderboardEntries.map((entry, index) => ({
        rank: index + 1,
        player: entry.player,
        label: shortAddress(entry.player),
        levelId: entry.result.levelId,
        levelVersion: entry.result.levelVersion,
        levelLabel: entry.levelLabel,
        levelOrder: entry.levelOrder,
        birdsUsed: entry.result.birdsUsed,
        durationMs: entry.result.durationMs,
        evidenceHash: entry.result.evidenceHash,
        submittedAt: entry.result.submittedAt,
      })),
      history: chainQueries.historyEntries.map((entry): HistoryRow => ({
        levelId: entry.levelId,
        levelLabel: levelLabelById.get(entry.levelId) ?? entry.levelId,
        birdsUsed: entry.birdsUsed,
        destroyedPigs: entry.destroyedPigs,
        durationMs: entry.durationMs,
        evidenceHash: entry.evidenceHash,
        submittedAt: entry.submittedAt,
      })),
    }
  }, [
    chainQueries.historyEntries,
    chainQueries.historyQuery.error,
    chainQueries.historyQuery.isLoading,
    chainQueries.historyRefreshing,
    chainQueries.leaderboardEntries,
    chainQueries.leaderboardQuery.error,
    chainQueries.leaderboardQuery.isLoading,
    chainQueries.leaderboardRefreshing,
    levelsQuery.error,
    levelsQuery.isLoading,
    mergedLevels,
  ])

  // 持久化设置到 local storage。
  const persistSettings = useCallback(() => {
    saveSettings(settings)
  }, [settings])

  // 持久化进度到当前 scope 对应存档。
  const persistProgress = useCallback(() => {
    saveProgress(progressScope, progress, lastPlayedLevelId)
  }, [lastPlayedLevelId, progress, progressScope])

  return {
    settings,
    updateGameSettings,
    persistSettings,
    progressScope,
    runSyncScope,
    progress,
    updateProgress,
    persistProgress,
    levelsQuery,
    chainQueries,
    mergedLevels,
    selectedLevel,
    resumeLevelId,
    lastPlayedLevelId,
    chainPanelState,
  }
}
