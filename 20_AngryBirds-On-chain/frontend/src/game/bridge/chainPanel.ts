import type { ChainPanelState } from '../types'
import { createEmptyChainPanelState } from '../types'
import type { BridgeEventBus } from './events'

export class BridgeChainPanelDomain {
  private chainPanelState = createEmptyChainPanelState()

  constructor(private readonly events: BridgeEventBus) {}

  updateChainPanelState(chainPanelState: ChainPanelState) {
    this.chainPanelState = chainPanelState
    this.events.emit('chain:changed', chainPanelState)
  }

  getChainPanelState() {
    return this.chainPanelState
  }
}
