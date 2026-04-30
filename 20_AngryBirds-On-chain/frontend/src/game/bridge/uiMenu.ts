import type { InGameMenuTab, OverlayRoute, SettingsState, UiState } from '../types'
import { createDefaultSettings, createDefaultUiState } from '../types'
import type { BridgeEventBus } from './events'

export class BridgeUiMenuDomain {
  private settings = createDefaultSettings()
  private uiState = createDefaultUiState()

  constructor(private readonly events: BridgeEventBus) {}

  updateSettings(settings: SettingsState) {
    this.settings = settings
    this.events.emit('settings:changed', settings)
  }

  getSettings() {
    return this.settings
  }

  updateUiState(uiState: UiState) {
    this.uiState = uiState
    this.events.emit('ui:changed', uiState)
  }

  getUiState() {
    return this.uiState
  }

  requestSettingsUpdate(nextSettings: Partial<SettingsState>) {
    this.events.emit('settings:update-request', nextSettings)
  }

  requestOpenMenu(tab: InGameMenuTab, route: OverlayRoute | null = null) {
    this.events.emit('menu:open-request', { tab, route })
  }
}
