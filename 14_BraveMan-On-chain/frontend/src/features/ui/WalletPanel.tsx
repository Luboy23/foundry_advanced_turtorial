import { ConnectIcon } from './GameUiIcons'
import { RailActionButton } from './RailActionButton'
import { buttonPrimaryClass, buttonSecondaryClass, parchmentBadgeClass, railPanelClass } from './buttonStyles'
import { BRAVEMAN_CHAIN_ID } from '../../lib/chain'

/** 钱包面板输入：由 App 统一计算连接状态、链状态与断开锁定策略。 */
type WalletPanelProps = {
  isConnected: boolean
  isCorrectChain: boolean
  chainId: number | undefined
  displayAddress: string
  isConnecting: boolean
  isSwitchingChain: boolean
  bypassMode: boolean
  disconnectLocked: boolean
  disconnectLockReason?: string
  onToggleConnect: () => void
  onRepairNetwork: () => void
  className?: string
  layout?: 'stacked' | 'minimal'
}

export const WalletPanel = ({
  isConnected,
  isCorrectChain,
  chainId,
  displayAddress,
  isConnecting,
  isSwitchingChain,
  bypassMode,
  disconnectLocked,
  disconnectLockReason,
  onToggleConnect,
  onRepairNetwork,
  className,
  layout = 'stacked',
}: WalletPanelProps) => {
  const needsNetworkRepair = isConnected && !isCorrectChain
  // 文案策略：E2E 模式固定显示 E2E，避免自动化流程被误操作中断。
  const actionLabel = bypassMode
    ? 'E2E'
    : needsNetworkRepair
      ? (isSwitchingChain ? '切换中' : '切换网络')
      : (isConnected ? '断开' : (isConnecting ? '连接中' : '连接'))
  // 链状态由上层统一转成 CTA：正常时展示状态，错误链时允许一键修复。
  const statusLabel = isConnected ? (isCorrectChain ? '链路正常' : `网络错误 · 当前链 ${chainId ?? '--'}`) : '等待连接'
  // 对局中禁断开：由上层控制 `disconnectLocked`，这里仅消费策略。
  const disconnectDisabled = isConnected && disconnectLocked
  const buttonDisabled = bypassMode
    || (needsNetworkRepair ? isSwitchingChain : (disconnectDisabled || isConnecting))
  const buttonTitle = bypassMode
    ? 'E2E 模式下不允许手动切换钱包'
    : needsNetworkRepair
      ? `当前链 ${chainId ?? '--'}，请切换到本地链 ${BRAVEMAN_CHAIN_ID}`
    : disconnectDisabled
      ? (disconnectLockReason ?? '对局进行中，暂不可断开钱包连接')
      : `${actionLabel} · ${statusLabel}`
  const handleAction = needsNetworkRepair ? onRepairNetwork : onToggleConnect

  if (layout === 'minimal') {
    // minimal 版本用于舞台右上角，强调紧凑尺寸与低遮挡。
    const buttonClass = (!isConnected && !bypassMode) || needsNetworkRepair ? buttonPrimaryClass : buttonSecondaryClass

    return (
      <section
        className={[
          railPanelClass,
          'flex items-center gap-1.5 rounded-[0.85rem] px-[7px] py-[4px]',
          className,
        ].filter(Boolean).join(' ')}
        data-testid="wallet-panel"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full ${
              isConnected ? (isCorrectChain ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-[var(--line-strong)]'
            }`}
          />
          <p className="min-w-0 flex-1 truncate text-[10.5px] font-semibold leading-none text-[var(--ink-900)]" data-testid="wallet-address">
            {isConnected ? displayAddress : '未连接'}
          </p>
        </div>
        <button
          aria-label={actionLabel}
          className={[
            buttonClass,
            'h-8 w-8 shrink-0 rounded-[0.78rem] p-0 shadow-[0_8px_16px_rgba(0,0,0,0.1)]',
          ].join(' ')}
          disabled={buttonDisabled}
          onClick={handleAction}
          title={buttonTitle}
          type="button"
        >
          <span className="inline-flex h-full w-full items-center justify-center" data-testid="wallet-connect-icon">
            <ConnectIcon className="h-3.25 w-3.25" />
          </span>
        </button>
      </section>
    )
  }

  return (
    // stacked 版本用于移动端/窄屏，展示完整状态信息与链标识。
    <section
      className={[
        railPanelClass,
        'px-3 py-3',
        className,
      ].filter(Boolean).join(' ')}
      data-testid="wallet-panel"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
            isConnected ? (isCorrectChain ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-[var(--line-strong)]'
          }`}
        />
        <div className="min-w-0 flex-1 text-[var(--ink-700)]">
          <p className="text-[10px] font-semibold tracking-[0.24em] text-[var(--ink-500)]">钱包</p>
          <p className="mt-1 truncate text-[12px] font-semibold leading-tight text-[var(--ink-900)]" data-testid="wallet-address">
            {isConnected ? displayAddress : '未连接钱包'}
          </p>
          <p className="mt-1 truncate text-[11px] leading-tight text-[var(--ink-500)]">{statusLabel}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className={`${parchmentBadgeClass} min-w-0 flex-1 px-2.5 py-1 text-[11px] font-semibold`}>
          <span className="truncate">{isCorrectChain ? `本地链 ${BRAVEMAN_CHAIN_ID}` : (chainId ? `链 ${chainId}` : '--')}</span>
        </span>
        <RailActionButton
          className="w-auto min-w-[4.8rem] px-2.5"
          disabled={buttonDisabled}
          icon={<ConnectIcon className="h-3.5 w-3.5" />}
          iconTestId="wallet-connect-icon"
          label={actionLabel}
          onClick={handleAction}
          size="sm"
          title={buttonTitle}
          tone={(!isConnected && !bypassMode) || needsNetworkRepair ? 'primary' : 'secondary'}
        />
      </div>
    </section>
  )
}
