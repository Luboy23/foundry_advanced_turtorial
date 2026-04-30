import type { LevelCatalogEntry, ProgressSnapshot, SessionState } from '../types'
import { createDefaultProgress } from '../types'
import { resolveResumeLevel } from '../resume'
import type { BridgeEventBus } from './events'

export class BridgeCatalogDomain {
  private levels: LevelCatalogEntry[] = []
  private progress = createDefaultProgress()
  private lastPlayedLevelId: string | null = null

  constructor(private readonly events: BridgeEventBus) {}

  syncLevels(levels: LevelCatalogEntry[], sessionState: SessionState) {
    this.levels = [...levels].sort((left, right) => left.manifest.order - right.manifest.order)
    const fallbackLevelId = this.getResumeLevel(sessionState.currentLevelId)?.levelId ?? this.levels[0]?.levelId ?? null

    let nextSession = sessionState
    if (!sessionState.currentLevelId || !this.getLevelById(sessionState.currentLevelId)) {
      nextSession = {
        ...nextSession,
        currentLevelId: fallbackLevelId,
      }
    }
    if (nextSession.scene === 'boot' && this.levels.length > 0) {
      nextSession = {
        ...nextSession,
        scene: 'title',
      }
    }

    this.events.emit('levels:changed', this.levels)
    return nextSession
  }

  getLevels() {
    return this.levels
  }

  updateProgress(progress: ProgressSnapshot, lastPlayedLevelId?: string | null) {
    this.progress = progress
    if (lastPlayedLevelId !== undefined) {
      this.lastPlayedLevelId = lastPlayedLevelId
    }
    this.events.emit('progress:changed', progress)
  }

  getProgress() {
    return this.progress
  }

  getLevelById(levelId: string | null | undefined) {
    if (!levelId) {
      return null
    }
    return this.levels.find((level) => level.levelId === levelId) ?? null
  }

  getCurrentLevel(currentLevelId: string | null | undefined) {
    return this.getLevelById(currentLevelId) ?? null
  }

  getResumeLevel(currentLevelId: string | null | undefined) {
    return resolveResumeLevel({
      levels: this.levels,
      progress: this.progress,
      currentLevelId,
      lastPlayedLevelId: this.lastPlayedLevelId,
    })
  }

  getHomeLevel(currentLevelId: string | null | undefined) {
    return this.getResumeLevel(currentLevelId)
  }

  getNextLevelAfter(levelId: string | null | undefined) {
    const currentLevel = this.getLevelById(levelId)
    if (!currentLevel) {
      return null
    }

    return this.getEnabledLevels().find((level) => level.manifest.order > currentLevel.manifest.order) ?? null
  }

  private getEnabledLevels() {
    return [...this.levels]
      .filter((level) => level.manifest.enabled)
      .sort((left, right) => left.manifest.order - right.manifest.order)
  }

}
