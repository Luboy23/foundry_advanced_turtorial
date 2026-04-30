import type {
  ChainPanelState,
  InGameMenuTab,
  LevelCatalogEntry,
  OverlayRoute,
  ProgressSnapshot,
  RunSummary,
  SettingsState,
  SubmissionState,
  UiState,
  WalletState,
} from './types'
import { BridgeCatalogDomain } from './bridge/catalog'
import { BridgeChainPanelDomain } from './bridge/chainPanel'
import { BridgeEventBus, type BridgeEventMap } from './bridge/events'
import { BridgeSessionDomain } from './bridge/session'
import { BridgeSubmissionDomain } from './bridge/submission'
import { BridgeUiMenuDomain } from './bridge/uiMenu'
import { BridgeWalletDomain } from './bridge/wallet'

export class AngryBirdsBridge {
  private readonly events = new BridgeEventBus()
  private readonly sessionDomain = new BridgeSessionDomain(this.events)
  private readonly catalogDomain = new BridgeCatalogDomain(this.events)
  private readonly walletDomain = new BridgeWalletDomain(this.events)
  private readonly submissionDomain = new BridgeSubmissionDomain(
    this.events,
    () => this.sessionDomain.getSession().runSummary,
  )
  private readonly uiMenuDomain = new BridgeUiMenuDomain(this.events)
  private readonly chainPanelDomain = new BridgeChainPanelDomain(this.events)

  on<K extends keyof BridgeEventMap>(type: K, listener: (payload: BridgeEventMap[K]) => void) {
    return this.events.on(type, listener)
  }

  setLevels(levels: LevelCatalogEntry[]) {
    const nextSession = this.catalogDomain.syncLevels(levels, this.sessionDomain.getSession())
    this.sessionDomain.commitSession(nextSession)
  }

  getLevels() {
    return this.catalogDomain.getLevels()
  }

  getCurrentLevel() {
    return this.catalogDomain.getCurrentLevel(this.sessionDomain.getSession().currentLevelId)
  }

  getHomeLevel() {
    return this.getResumeLevel()
  }

  getResumeLevel() {
    return this.catalogDomain.getResumeLevel(this.sessionDomain.getSession().currentLevelId)
  }

  getNextLevelAfter(levelId: string | null | undefined) {
    return this.catalogDomain.getNextLevelAfter(levelId)
  }

  updateProgress(progress: ProgressSnapshot, options?: { lastPlayedLevelId?: string | null }) {
    this.catalogDomain.updateProgress(progress, options?.lastPlayedLevelId)
  }

  getProgress() {
    return this.catalogDomain.getProgress()
  }

  updateSettings(settings: SettingsState) {
    this.uiMenuDomain.updateSettings(settings)
  }

  getSettings() {
    return this.uiMenuDomain.getSettings()
  }

  updateWalletState(walletState: WalletState) {
    this.walletDomain.updateWalletState(walletState)
  }

  getWalletState() {
    return this.walletDomain.getWalletState()
  }

  updateSubmissionState(submissionState: SubmissionState) {
    this.submissionDomain.updateSubmissionState(submissionState)
  }

  getSubmissionState() {
    return this.submissionDomain.getSubmissionState()
  }

  updateChainPanelState(chainPanelState: ChainPanelState) {
    this.chainPanelDomain.updateChainPanelState(chainPanelState)
  }

  getChainPanelState() {
    return this.chainPanelDomain.getChainPanelState()
  }

  updateUiState(uiState: UiState) {
    this.uiMenuDomain.updateUiState(uiState)
  }

  getUiState() {
    return this.uiMenuDomain.getUiState()
  }

  getSession() {
    return this.sessionDomain.getSession()
  }

  returnHome() {
    this.sessionDomain.returnHome(this.getResumeLevel()?.levelId ?? this.getLevels()[0]?.levelId ?? null)
  }

  returnToTitle() {
    this.returnHome()
  }

  startLevel(levelId: string) {
    return this.sessionDomain.startLevel(this.catalogDomain.getLevelById(levelId))
  }

  startHomeLevel() {
    return this.startResumeLevel()
  }

  startResumeLevel() {
    const resumeLevel = this.getResumeLevel()
    if (!resumeLevel) {
      return null
    }
    return this.startLevel(resumeLevel.levelId)
  }

  startNextLevel() {
    const nextLevel = this.getNextLevelAfter(this.sessionDomain.getSession().currentLevelId)
    if (!nextLevel) {
      return null
    }
    return this.startLevel(nextLevel.levelId)
  }

  restartLevel() {
    const currentLevelId = this.sessionDomain.getSession().currentLevelId
    if (!currentLevelId) {
      return null
    }
    return this.startLevel(currentLevelId)
  }

  requestStartLevel(levelId: string) {
    this.sessionDomain.requestStartLevel(levelId)
  }

  requestStartHomeLevel() {
    this.sessionDomain.requestStartHomeLevel()
  }

  requestStartResumeLevel() {
    const resumeLevel = this.getResumeLevel()
    if (!resumeLevel) {
      return
    }
    this.sessionDomain.requestStartLevel(resumeLevel.levelId)
  }

  requestStartNextLevel() {
    this.sessionDomain.requestStartNextLevel()
  }

  requestRestartLevel() {
    this.sessionDomain.requestRestartLevel()
  }

  publishRunSummary(summary: RunSummary) {
    this.sessionDomain.publishRunSummary(summary)
  }

  requestSubmit(summary?: RunSummary | null) {
    this.submissionDomain.requestSubmit(summary)
  }

  requestClearSubmission() {
    this.submissionDomain.requestClearSubmission()
  }

  requestForceWin(levelId?: string | null) {
    this.sessionDomain.requestForceWin(levelId)
  }

  consumePendingForceWin(levelId?: string | null) {
    return this.sessionDomain.consumePendingForceWin(levelId)
  }

  requestWalletConnect() {
    this.walletDomain.requestWalletConnect()
  }

  requestWalletDisconnect() {
    this.walletDomain.requestWalletDisconnect()
  }

  requestSettingsUpdate(nextSettings: Partial<SettingsState>) {
    this.uiMenuDomain.requestSettingsUpdate(nextSettings)
  }

  requestOpenMenu(tab: InGameMenuTab, route: OverlayRoute | null = null) {
    this.uiMenuDomain.requestOpenMenu(tab, route)
  }
}
