/**
 * 钱包状态角标。
 * 只负责展示连接/链状态和一个连接按钮，不承担链上逻辑判断。
 */
import {
  buttonSecondaryClass,
  buttonSizeXsClass,
} from './buttonStyles'

type WalletPanelProps = {
  isConnected: boolean
  isCorrectChain: boolean
  chainId: number | undefined
  displayAddress: string
  isConnecting: boolean
  bypassMode: boolean
  disconnectLocked: boolean
  disconnectLockReason?: string
  onToggleConnect: () => void
}

export const WalletPanel = ({
  isConnected,
  isCorrectChain,
  chainId,
  displayAddress,
  isConnecting,
  bypassMode,
  disconnectLocked,
  disconnectLockReason,
  onToggleConnect,
}: WalletPanelProps) => {
  const disconnectDisabled = isConnected && disconnectLocked
  const buttonDisabled = bypassMode || disconnectDisabled
  const buttonTitle = bypassMode
    ? 'E2E 模式下不允许手动切换钱包'
    : disconnectDisabled
      ? (disconnectLockReason ?? '对局进行中，暂不可断开钱包连接')
      : undefined

  return (
    <section className="fixed right-3 top-3 z-[70] w-auto max-w-[calc(100vw-1.5rem)] rounded-xl border border-[var(--line-soft)] bg-[rgba(255,255,255,0.94)] px-2.5 py-2 shadow-lg shadow-black/12 backdrop-blur-sm sm:right-4 sm:top-4">
      {/* 钱包角标固定在右上，不参与游戏主布局流，避免 HUD 和弹窗切换时跳动。 */}
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`h-2 w-2 shrink-0 rounded-full ${
            isConnected
              ? (isCorrectChain ? 'bg-emerald-500' : 'bg-amber-500')
              : 'bg-[var(--line-strong)]'
          }`}
        />
        <div className="min-w-0 text-[var(--ink-700)]">
          <p className="truncate text-[11px] font-semibold leading-tight" data-testid="wallet-address">
            {isConnected ? displayAddress : '未连接钱包'}
          </p>
          <p className="truncate text-[10px] leading-tight text-[var(--ink-500)]" data-testid="wallet-chain">
            {isCorrectChain ? 'Anvil 31337' : (chainId ? `Chain ${chainId}` : '--')}
          </p>
        </div>
        <button
          className={`${buttonSecondaryClass} ${buttonSizeXsClass} shrink-0`}
          onClick={onToggleConnect}
          type="button"
          disabled={buttonDisabled}
          title={buttonTitle}
        >
          {bypassMode
            ? 'E2E'
            : (isConnected ? '断开' : (isConnecting ? '连接中...' : '连接'))}
        </button>
      </div>
    </section>
  )
}
