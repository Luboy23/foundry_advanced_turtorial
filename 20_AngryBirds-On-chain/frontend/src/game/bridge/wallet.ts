import type { WalletState } from '../types'
import { createDefaultWalletState } from '../types'
import type { BridgeEventBus } from './events'

export class BridgeWalletDomain {
  private walletState = createDefaultWalletState()

  constructor(private readonly events: BridgeEventBus) {}

  updateWalletState(walletState: WalletState) {
    this.walletState = walletState
    this.events.emit('wallet:state-changed', walletState)
  }

  getWalletState() {
    return this.walletState
  }

  requestWalletConnect() {
    this.events.emit('wallet:connect-request', undefined)
  }

  requestWalletDisconnect() {
    this.events.emit('wallet:disconnect-request', undefined)
  }
}
