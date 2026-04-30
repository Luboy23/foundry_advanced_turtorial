import type { LevelCatalogEntry } from '../game/types'
import type { ChainLeaderboardEntry, ChainLevelConfig } from './contract'

export type LeaderboardTarget = {
  levelId: string
  version: number
  levelOrder: number
  levelLabel: string
}

export type AggregatedLeaderboardEntry = ChainLeaderboardEntry & {
  levelOrder: number
  levelLabel: string
}

const buildLevelKey = (levelId: string, version: number) => `${levelId}:${version}`

// 基于链上目录 + 本地关卡构建关卡元数据索引（名称、顺序、可用性）。
const buildLeaderboardTargetByKey = (
  chainCatalog: ChainLevelConfig[],
  localLevels: LevelCatalogEntry[],
): Map<string, LeaderboardTarget> => {
  const localLevelByKey = new Map(localLevels.map((level) => [buildLevelKey(level.levelId, level.version), level] as const))
  const targets = new Map<string, LeaderboardTarget>()

  for (const level of chainCatalog) {
    if (!level.enabled) {
      continue
    }

    const key = buildLevelKey(level.levelId, level.version)
    const localLevel = localLevelByKey.get(key)
    targets.set(key, {
      levelId: level.levelId,
      version: level.version,
      levelOrder: level.order,
      levelLabel: localLevel?.map.label ?? level.levelId,
    })
  }

  for (const level of localLevels) {
    if (!level.manifest.enabled) {
      continue
    }

    const key = buildLevelKey(level.levelId, level.version)
    if (targets.has(key)) {
      continue
    }

    targets.set(key, {
      levelId: level.levelId,
      version: level.version,
      levelOrder: level.manifest.order,
      levelLabel: level.map.label ?? level.levelId,
    })
  }

  return targets
}

// 给排行榜条目补齐 levelOrder/levelLabel，便于 UI 直接展示。
export const attachLeaderboardMetadata = (
  entries: ChainLeaderboardEntry[],
  chainCatalog: ChainLevelConfig[],
  localLevels: LevelCatalogEntry[],
): AggregatedLeaderboardEntry[] => {
  const targetByKey = buildLeaderboardTargetByKey(chainCatalog, localLevels)

  return entries.map((entry) => {
    const key = buildLevelKey(entry.result.levelId, entry.result.levelVersion)
    const target = targetByKey.get(key)

    return {
      ...entry,
      levelOrder: target?.levelOrder ?? 0,
      levelLabel: target?.levelLabel || entry.result.levelId,
    }
  })
}
