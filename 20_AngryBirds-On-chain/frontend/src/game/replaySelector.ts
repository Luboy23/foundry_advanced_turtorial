import type { LevelCatalogEntry, ProgressSnapshot } from './types'

type ReplaySelectionOptions = {
  replayableLevels: LevelCatalogEntry[]
  selectedReplayLevelId?: string | null
  currentLevelId?: string | null
}

export const getReplayableLevels = (levels: LevelCatalogEntry[], progress: ProgressSnapshot) => {
  const completedLevelIds = new Set(progress.completedLevelIds)

  return [...levels]
    .filter((level) => level.manifest.enabled && completedLevelIds.has(level.levelId))
    .sort((left, right) => left.manifest.order - right.manifest.order)
}

export const resolveReplaySelection = ({
  replayableLevels,
  selectedReplayLevelId,
  currentLevelId,
}: ReplaySelectionOptions) => {
  if (replayableLevels.length === 0) {
    return null
  }

  if (selectedReplayLevelId && replayableLevels.some((level) => level.levelId === selectedReplayLevelId)) {
    return selectedReplayLevelId
  }

  if (currentLevelId && replayableLevels.some((level) => level.levelId === currentLevelId)) {
    return currentLevelId
  }

  return replayableLevels[replayableLevels.length - 1]?.levelId ?? null
}
