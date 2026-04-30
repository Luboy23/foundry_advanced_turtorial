import type { LevelCatalogEntry, ProgressSnapshot } from './types'

type ResolveResumeLevelOptions = {
  levels: LevelCatalogEntry[]
  progress: ProgressSnapshot
  currentLevelId?: string | null
  lastPlayedLevelId?: string | null
}

const isLevelUnlocked = (level: LevelCatalogEntry, progress: ProgressSnapshot) =>
  level.manifest.enabled && progress.unlockedOrders.includes(level.manifest.order)

const isLevelCompleted = (level: LevelCatalogEntry, progress: ProgressSnapshot) =>
  progress.completedLevelIds.includes(level.levelId)

export const resolveResumeLevel = ({
  levels,
  progress,
  currentLevelId,
  lastPlayedLevelId,
}: ResolveResumeLevelOptions) => {
  const enabledLevels = [...levels]
    .filter((level) => level.manifest.enabled)
    .sort((left, right) => left.manifest.order - right.manifest.order)

  if (enabledLevels.length === 0) {
    return levels[0] ?? null
  }

  const levelById = new Map(enabledLevels.map((level) => [level.levelId, level] as const))

  const currentLevel = currentLevelId ? levelById.get(currentLevelId) ?? null : null
  if (currentLevel && isLevelUnlocked(currentLevel, progress) && !isLevelCompleted(currentLevel, progress)) {
    return currentLevel
  }

  const firstUnlockedUncleared =
    enabledLevels.find((level) => isLevelUnlocked(level, progress) && !isLevelCompleted(level, progress)) ?? null
  if (firstUnlockedUncleared) {
    return firstUnlockedUncleared
  }

  const lastPlayedLevel = lastPlayedLevelId ? levelById.get(lastPlayedLevelId) ?? null : null
  if (lastPlayedLevel && (isLevelUnlocked(lastPlayedLevel, progress) || isLevelCompleted(lastPlayedLevel, progress))) {
    return lastPlayedLevel
  }

  return enabledLevels[enabledLevels.length - 1] ?? levels[0] ?? null
}
