declare global {
  type WalletStatus = {
    address: `0x${string}` | null
    isConnected: boolean
  }

  type EthereumProvider = {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    on?: (event: string, listener: (...args: unknown[]) => void) => void
    removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
  }

  interface Window {
    __walletConnect?: () => void | Promise<void>
    __walletDisconnect?: () => void
    __walletStatus?: WalletStatus
    ethereum?: EthereumProvider
  }

  interface WindowEventMap {
    'wallet:status': CustomEvent<WalletStatus>
    'game:over': CustomEvent<{ score?: number; endedAt?: number }>
  }
}

export {}
