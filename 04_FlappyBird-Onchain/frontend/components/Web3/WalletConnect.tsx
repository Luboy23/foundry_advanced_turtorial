import { useEffect, useMemo } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from '@wagmi/core'

export default function WalletConnect() {
  const injectedConnector = useMemo(() => injected(), [])
  const { address, isConnected, connector } = useAccount()
  const { connect, error } = useConnect()
  const { disconnect } = useDisconnect()

  useEffect(() => {
    console.log('钱包连接状态:', { isConnected, address, connector })
    if (error) {
      console.error('钱包连接错误:', error)
    }
  }, [isConnected, error, address, connector])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.__walletDisconnect = disconnect
    return () => {
      if (window.__walletDisconnect === disconnect) {
        delete window.__walletDisconnect
      }
    }
  }, [disconnect])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const connectFn = () => {
      connect({ connector: injectedConnector })
    }
    window.__walletConnect = connectFn
    return () => {
      if (window.__walletConnect === connectFn) {
        delete window.__walletConnect
      }
    }
  }, [connect, injectedConnector])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const detail: WalletStatus = {
      address: address ?? null,
      isConnected: Boolean(isConnected),
    }
    window.__walletStatus = detail
    window.dispatchEvent(new CustomEvent('wallet:status', { detail }))
  }, [address, isConnected])

  return null
}
