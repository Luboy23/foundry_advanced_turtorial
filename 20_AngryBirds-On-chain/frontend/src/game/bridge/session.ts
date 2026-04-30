import type { LevelCatalogEntry, RunSummary, SessionState } from '../types'
import { createDefaultSessionState } from '../types'
import type { BridgeEventBus } from './events'

export class BridgeSessionDomain {
  private sessionState = createDefaultSessionState()
  private pendingForceWinLevelId: string | null = null

  constructor(private readonly events: BridgeEventBus) {}

  getSession() {
    return this.sessionState
  }

  commitSession(sessionState: SessionState) {
    this.sessionState = sessionState
    this.events.emit('session:changed', this.sessionState)
  }

  returnHome(fallbackLevelId: string | null) {
    this.commitSession({
      scene: 'title',
      currentLevelId: this.sessionState.currentLevelId ?? fallbackLevelId,
      runSummary: null,
    })
  }

  startLevel(level: LevelCatalogEntry | null) {
    if (!level) {
      return null
    }

    this.commitSession({
      scene: 'play',
      currentLevelId: level.levelId,
      runSummary: null,
    })
    return level
  }

  publishRunSummary(summary: RunSummary) {
    this.sessionState = {
      scene: 'result',
      currentLevelId: summary.levelId,
      runSummary: summary,
    }
    this.events.emit('session:changed', this.sessionState)
    this.events.emit('run:finished', summary)
  }

  requestStartLevel(levelId: string) {
    this.events.emit('gameplay:start-request', {
      mode: 'level',
      levelId,
    })
  }

  requestStartHomeLevel() {
    this.events.emit('gameplay:start-request', {
      mode: 'home',
    })
  }

  requestStartNextLevel() {
    this.events.emit('gameplay:start-request', {
      mode: 'next',
    })
  }

  requestRestartLevel() {
    this.events.emit('gameplay:start-request', {
      mode: 'retry',
      levelId: this.sessionState.currentLevelId ?? undefined,
    })
  }

  requestForceWin(levelId?: string | null) {
    const targetLevelId = levelId ?? this.sessionState.currentLevelId
    this.pendingForceWinLevelId = targetLevelId
    this.events.emit('debug:force-win-request', {
      levelId: targetLevelId,
    })
  }

  consumePendingForceWin(levelId?: string | null) {
    if (!this.pendingForceWinLevelId) {
      return null
    }
    if (levelId && this.pendingForceWinLevelId !== levelId) {
      return null
    }

    const consumedLevelId = this.pendingForceWinLevelId
    this.pendingForceWinLevelId = null
    return consumedLevelId
  }
}
