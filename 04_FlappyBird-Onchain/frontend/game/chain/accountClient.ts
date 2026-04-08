const getConnectedAccount = async (): Promise<`0x${string}` | null> => {
  if (typeof window === 'undefined') return null

  if (window.__walletStatus) {
    return window.__walletStatus.isConnected ? window.__walletStatus.address : null
  }

  if (!window.ethereum) return null
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[]
    return Array.isArray(accounts) && accounts.length > 0 ? (accounts[0] as `0x${string}`) : null
  } catch {
    return null
  }
}

const onAccountChanged = (handler: (address: `0x${string}` | null) => void): (() => void) => {
  if (typeof window === "undefined") {
    return () => {}
  }

  const handleAccounts = (accounts: string[]) => {
    const account =
      Array.isArray(accounts) && accounts.length > 0 ? (accounts[0] as `0x${string}`) : null
    handler(account)
  }

  const handleWalletStatus = (event: WindowEventMap['wallet:status']) => {
    const detail = event?.detail || { address: null, isConnected: false }
    const account = detail.isConnected ? detail.address : null
    handler(account || null)
  }

  window.addEventListener('wallet:status', handleWalletStatus as EventListener)

  if (window.ethereum?.on) {
    window.ethereum.on('accountsChanged', handleAccounts)
  }

  return () => {
    window.removeEventListener('wallet:status', handleWalletStatus as EventListener)
    if (window.ethereum?.removeListener) {
      window.ethereum.removeListener('accountsChanged', handleAccounts)
    }
  }
}

export { getConnectedAccount, onAccountChanged }
