import type {
  ChainPanelState,
  GameplayStartRequest,
  InGameMenuTab,
  LevelCatalogEntry,
  OverlayRoute,
  ProgressSnapshot,
  RunSummary,
  SessionState,
  SettingsState,
  SubmissionState,
  UiState,
  WalletState,
} from '../types'

export type BridgeEventMap = {
  'levels:changed': LevelCatalogEntry[]
  'progress:changed': ProgressSnapshot
  'settings:changed': SettingsState
  'wallet:state-changed': WalletState
  'submission:state-changed': SubmissionState
  'chain:changed': ChainPanelState
  'ui:changed': UiState
  'session:changed': SessionState
  'run:finished': RunSummary
  'submission:submit-request': RunSummary | null
  'submission:clear-request': undefined
  'debug:force-win-request': { levelId: string | null }
  'gameplay:start-request': GameplayStartRequest
  'wallet:connect-request': undefined
  'wallet:disconnect-request': undefined
  'settings:update-request': Partial<SettingsState>
  'menu:open-request': { tab: InGameMenuTab; route: OverlayRoute | null }
}

export class BridgeEventBus {
  private readonly target = new EventTarget()

  on<K extends keyof BridgeEventMap>(type: K, listener: (payload: BridgeEventMap[K]) => void) {
    const wrapped = (event: Event) => {
      listener((event as CustomEvent<BridgeEventMap[K]>).detail)
    }
    this.target.addEventListener(type, wrapped)
    return () => this.target.removeEventListener(type, wrapped)
  }

  emit<K extends keyof BridgeEventMap>(type: K, payload: BridgeEventMap[K]) {
    this.target.dispatchEvent(new CustomEvent(type, { detail: payload }))
  }
}
