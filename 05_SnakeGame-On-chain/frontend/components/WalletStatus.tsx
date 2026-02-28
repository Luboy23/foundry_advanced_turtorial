import { useEffect, useMemo, useState } from 'react'
import { useAccount, useChainId, useConnect, useDisconnect } from 'wagmi'

const ANVIL_CHAIN_ID = 31337

// 将地址缩略显示为 0x1234...abcd
const shortenAddress = (address?: string) => {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// 右上角钱包状态组件（连接/断开与网络提示）
export default function WalletStatus() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  useEffect(() => {
    setMounted(true)
  }, [])

  const injectedConnector = useMemo(
    () => connectors.find((connector) => connector.id === 'injected'),
    [connectors]
  )

  const isAnvil = chainId === ANVIL_CHAIN_ID

  if (!mounted) {
    return (
      <div className="fixed right-4 top-4 z-50 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-rose-200 bg-white/95 px-3 py-2 text-xs font-semibold text-rose-600 shadow-lg shadow-rose-200/40 backdrop-blur">
        <span className="text-rose-400">未连接</span>
        <span className="hidden h-1 w-1 rounded-full bg-rose-200/70 sm:inline-block" />
        <span className="text-[10px] uppercase tracking-[0.24em] text-rose-400">
          ---
        </span>
        <button
          type="button"
          disabled
          className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-500 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          连接钱包
        </button>
      </div>
    )
  }

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-rose-200 bg-white/95 px-3 py-2 text-xs font-semibold text-rose-600 shadow-lg shadow-rose-200/40 backdrop-blur">
      <span className="text-rose-400">
        {isConnected ? shortenAddress(address) : '未连接'}
      </span>
      <span className="hidden h-1 w-1 rounded-full bg-rose-200/70 sm:inline-block" />
      <span className="text-[10px] uppercase tracking-[0.24em] text-rose-400">
        {isConnected ? (isAnvil ? 'Anvil' : 'Wrong') : '---'}
      </span>
      {isConnected ? (
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-500 transition hover:bg-rose-100"
        >
          断开
        </button>
      ) : (
        <button
          type="button"
          onClick={() =>
            mounted && injectedConnector
              ? connect({ connector: injectedConnector })
              : undefined
          }
          disabled={!mounted || !injectedConnector || isPending}
          className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-500 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? '连接中…' : '连接钱包'}
        </button>
      )}
    </div>
  )
}
