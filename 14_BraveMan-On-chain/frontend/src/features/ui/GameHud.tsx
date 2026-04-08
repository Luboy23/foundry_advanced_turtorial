import { memo, type CSSProperties, type ReactNode } from 'react'
import { formatNumber } from '../../shared/utils/format'
import type { WeaponType } from '../../game/types'
import { railPanelClass } from './buttonStyles'
import { GoldIcon, KillIcon } from './GameUiIcons'

type GameHudProps = {
  kills: number
  runGold: number
  activeWeapon: WeaponType
  bowUnlocked: boolean
  className?: string
  layout?: 'floating' | 'toolbar'
  style?: CSSProperties
}

const weaponLabelByType: Record<WeaponType, string> = {
  sword: '玄火镇岳',
  hook_spear: '金钩裂甲',
  bow: '霜翎逐月',
}

export const GameHud = memo(function GameHud({
  kills,
  runGold,
  activeWeapon,
  bowUnlocked,
  className,
  layout = 'floating',
  style,
}: GameHudProps) {
  return (
    <section
      className={[
        layout === 'toolbar'
          ? 'pointer-events-none flex flex-col gap-2'
          : 'pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-2 sm:left-4 sm:top-4',
        className,
      ].filter(Boolean).join(' ')}
      data-testid="game-hud"
      style={style}
    >
      <HudStat
        icon={<KillIcon className="h-5 w-5 sm:h-5.5 sm:w-5.5" />}
        label="击杀"
        testId="hud-stat-kills"
        toneClass="text-[var(--ink-900)]"
        value={formatNumber(kills)}
        valueTestId="kills-value"
      />
      <HudStat
        icon={<GoldIcon className="h-5 w-5 sm:h-5.5 sm:w-5.5" />}
        label="金币"
        testId="hud-stat-gold"
        toneClass="text-[var(--accent-vermilion)]"
        value={formatNumber(runGold)}
        valueTestId="run-gold-value"
      />
      <div
        className={`${railPanelClass} min-w-[5.75rem] px-3 py-2 sm:min-w-[6.2rem] sm:px-3.5 sm:py-2.5`}
        data-testid="hud-weapon-status"
      >
        <p className="text-[10px] font-semibold tracking-[0.18em] text-[var(--ink-500)]">武器</p>
        <p className="mt-1 text-[13px] font-semibold text-[var(--ink-900)]">{weaponLabelByType[activeWeapon]}</p>
        <p className="mt-1 text-[10px] font-medium text-[var(--ink-500)]">
          霜翎逐月 {bowUnlocked ? '已解锁' : '未解锁'}
        </p>
      </div>
    </section>
  )
})

const HudStat = ({
  icon,
  label,
  testId,
  toneClass,
  value,
  valueTestId,
}: {
  icon: ReactNode
  label: string
  testId: string
  toneClass: string
  value: string
  valueTestId: string
}) => (
  <div
    aria-label={label}
    className={`${railPanelClass} flex min-w-[5.75rem] items-center gap-2 px-3 py-2 sm:min-w-[6.2rem] sm:px-3.5 sm:py-2.5`}
    data-testid={testId}
  >
    <span className={`${toneClass} shrink-0`}>{icon}</span>
    <p className="numeric-tabular text-base font-semibold text-[var(--ink-900)] sm:text-[1.1rem]" data-testid={valueTestId}>
      {value}
    </p>
  </div>
)
