import type { ReactNode } from 'react'
import type { GameState, WeaponType } from '../../game/types'
import { formatNumber } from '../../shared/utils/format'
import { Modal } from './Modal'
import { buttonPrimaryClass, buttonSecondaryClass, buttonSizeSmClass, modalInsetClass, modalSectionClass, parchmentBadgeClass } from './buttonStyles'
import {
  CoinStackIcon,
  EmptySlotMarkIcon,
  EquipStampIcon,
  LockBadgeIcon,
} from './GameUiIcons'

type EquipmentModalProps = {
  isOpen: boolean
  gameState: GameState
  chainGold: number
  runGold: number
  activeWeapon: WeaponType
  bowOwned: boolean
  canToggleWeapon: boolean
  purchasePending: boolean
  purchaseError: string | null
  canPurchaseBow: boolean
  purchaseBowBlockedReason: string | null
  onClose: () => void
  onPurchaseBow: () => void
  onEquipWeapon: (weapon: WeaponType) => void
}

const weaponShortLabel: Record<WeaponType, string> = {
  sword: '玄火镇岳',
  hook_spear: '金钩裂甲',
  bow: '霜翎逐月',
}

const slots: Array<{ slot: number; weapon?: WeaponType }> = [
  { slot: 1, weapon: 'sword' },
  { slot: 2, weapon: 'bow' },
  { slot: 3, weapon: 'hook_spear' },
]

const weaponArtworkByType: Record<WeaponType, { alt: string; src: string }> = {
  sword: {
    alt: '玄火镇岳武器图',
    src: '/ui/weapons/greatsword-card.svg',
  },
  bow: {
    alt: '霜翎逐月武器图',
    src: '/ui/weapons/bow-card.svg',
  },
  hook_spear: {
    alt: '金钩裂甲武器图',
    src: '/ui/weapons/hook-spear-card.svg',
  },
}

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

const sectionEyebrowClass = 'text-[11px] font-semibold tracking-[0.18em] text-[var(--ink-500)]'
const sectionTitleClass = 'mt-1 text-lg font-semibold text-[var(--ink-900)]'
const pillClass = `${parchmentBadgeClass} px-2.5 py-1 text-[11px] font-semibold`

const inventoryRackClass =
  `${modalInsetClass} mt-4 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.42),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,246,246,0.9))] p-3 sm:p-4`
const shopRackClass =
  `${modalInsetClass} mt-4 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.4),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,246,246,0.92))] p-3 sm:p-4`

const WeaponArtwork = ({
  weapon,
  className,
  muted = false,
  testId,
}: {
  weapon: WeaponType
  className?: string
  muted?: boolean
  testId?: string
}) => {
  const artwork = weaponArtworkByType[weapon]

  return (
    <img
      alt={artwork.alt}
      className={cx(
        'pointer-events-none select-none object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.12)]',
        unifiedWeaponArtClass,
        muted && 'opacity-65 saturate-[0.68] brightness-[0.96]',
        className,
      )}
      data-testid={testId}
      draggable="false"
      src={artwork.src}
    />
  )
}

const getSlotCopy = ({
  weapon,
  isActive,
  isLocked,
  canEquip,
}: {
  weapon?: WeaponType
  isActive: boolean
  isLocked: boolean
  canEquip: boolean
}) => {
  if (!weapon) {
    return {
      detail: '预留装备位',
      stateLabel: '空槽',
      tone: 'empty' as const,
    }
  }

  if (isActive) {
    return {
      detail: '当前战斗武器',
      stateLabel: '已装备',
      tone: 'active' as const,
    }
  }

  if (isLocked) {
    return {
      detail: '需 10 金币永久解锁',
      stateLabel: '未解锁',
      tone: 'locked' as const,
    }
  }

  if (!canEquip) {
    return {
      detail: '暂停后可切换',
      stateLabel: '待切换',
      tone: 'brass' as const,
    }
  }

  return {
    detail: '点击切换为当前武器',
    stateLabel: '可切换',
    tone: 'owned' as const,
  }
}

const cardBaseClass =
  'group relative flex min-h-[15.5rem] w-full flex-col overflow-hidden rounded-[1.35rem] border px-3 py-3.5 text-left transition sm:min-h-[16.1rem]'

const artFrameClass =
  'mx-auto aspect-square w-full max-w-[9rem] shrink-0 rounded-[1.05rem] border border-[rgba(16,16,16,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.6),rgba(248,248,248,0.34))] px-2 py-2.5 sm:max-w-[9.25rem]'
const unifiedWeaponArtClass = 'h-[5.7rem] w-[5.7rem] sm:h-[5.95rem] sm:w-[5.95rem]'
const cardTitleClass = 'text-[15px] font-semibold text-[var(--ink-900)] sm:text-base'
const cardBodyTextClass = 'break-keep text-[11px] leading-5 text-[var(--ink-500)]'
const slotBadgeClass = 'rounded-full border border-current/16 bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em]'
const chipBaseClass = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold'
const cardMetaClass = 'mt-auto grid min-h-[7.25rem] w-full grid-rows-[auto_auto_1fr] items-start justify-items-start gap-2 text-left'

export const EquipmentModal = ({
  isOpen,
  gameState,
  chainGold,
  runGold,
  activeWeapon,
  bowOwned,
  canToggleWeapon,
  purchasePending,
  purchaseError,
  canPurchaseBow,
  purchaseBowBlockedReason,
  onClose,
  onPurchaseBow,
  onEquipWeapon,
}: EquipmentModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="装备 / 商店"
      panelClassName="max-w-[67rem] shadow-[0_26px_60px_rgba(0,0,0,0.22)] sm:max-h-[80vh] sm:rounded-[2rem]"
      bodyClassName="bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.42),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,246,246,0.92))]"
    >
      <div className="space-y-4">
        <section className={`${modalSectionClass} px-4 py-4 sm:px-5`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={sectionEyebrowClass}>军械柜</p>
              <h3 className={sectionTitleClass}>战斗装备</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip tone="owned">当前装备</StatusChip>
              <span className={pillClass}>{weaponShortLabel[activeWeapon]}</span>
            </div>
          </div>

          <div className={inventoryRackClass}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {slots.map(({ slot, weapon }) => {
                const isOwned = weapon === 'sword' || weapon === 'hook_spear' || (weapon === 'bow' && bowOwned)
                const isActive = weapon === activeWeapon
                const isLocked = weapon === 'bow' && !bowOwned
                const canEquip = weapon === 'sword' || weapon === 'hook_spear' || (weapon === 'bow' && canToggleWeapon)
                const slotCopy = getSlotCopy({ weapon, isActive, isLocked, canEquip })
                const slotTitle = weapon ? weaponShortLabel[weapon] : '空槽'

                return (
                  <button
                    className={cx(
                      cardBaseClass,
                      isActive
                        ? 'border-[rgba(181,57,34,0.42)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,244,240,0.95))] text-[var(--ink-900)] shadow-[0_16px_26px_rgba(181,57,34,0.12)]'
                        : !weapon
                          ? 'border-dashed border-[rgba(16,16,16,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(248,248,248,0.82))] text-[rgba(16,16,16,0.42)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]'
                          : isLocked || !canEquip
                            ? 'border-[rgba(16,16,16,0.12)] bg-[linear-gradient(180deg,rgba(250,250,250,0.94),rgba(241,241,241,0.92))] text-[rgba(16,16,16,0.56)] shadow-[0_8px_14px_rgba(0,0,0,0.04)]'
                            : 'border-[rgba(16,16,16,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,247,247,0.94))] text-[var(--ink-900)] shadow-[0_12px_22px_rgba(0,0,0,0.08)] hover:-translate-y-[1px] hover:border-[rgba(16,16,16,0.22)] active:translate-y-[1px]',
                    )}
                    data-testid={`equipment-slot-${slot}`}
                    disabled={!weapon || !isOwned || !canEquip || isActive}
                    key={slot}
                    onClick={() => weapon && onEquipWeapon(weapon)}
                    type="button"
                  >
                    <div
                      aria-hidden
                      className={cx(
                        'absolute inset-[0.3rem] rounded-[1rem] border',
                        isActive
                          ? 'border-[rgba(181,57,34,0.14)] bg-[rgba(181,57,34,0.04)]'
                          : !weapon
                            ? 'border-[rgba(16,16,16,0.08)]'
                            : isLocked || !canEquip
                              ? 'border-[rgba(16,16,16,0.08)] bg-[rgba(255,255,255,0.16)]'
                              : 'border-[rgba(16,16,16,0.08)] bg-[rgba(255,255,255,0.24)]',
                      )}
                    />
                    <SlotCorners active={isActive} muted={!weapon || isLocked} />
                    <div className="relative z-[1] flex h-full flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className={slotBadgeClass}>
                          {slot.toString().padStart(2, '0')}
                        </span>
                        <span className={cx(
                          'inline-flex h-7 w-7 items-center justify-center rounded-[0.85rem] border',
                          isActive
                            ? 'border-[rgba(181,57,34,0.14)] bg-[rgba(181,57,34,0.1)] text-[var(--accent-vermilion)]'
                            : isLocked || !canEquip
                              ? 'border-[rgba(16,16,16,0.1)] bg-[rgba(245,245,245,0.9)] text-[rgba(16,16,16,0.5)]'
                              : !weapon
                                ? 'border-[rgba(16,16,16,0.08)] bg-[rgba(248,248,248,0.72)] text-[rgba(16,16,16,0.42)]'
                                : 'border-[rgba(16,16,16,0.1)] bg-[rgba(255,255,255,0.72)] text-[var(--ink-700)]',
                        )}>
                          {isActive ? <EquipStampIcon className="h-3.5 w-3.5" /> : isLocked ? <LockBadgeIcon className="h-3.5 w-3.5" /> : !weapon ? <EmptySlotMarkIcon className="h-3.5 w-3.5" /> : null}
                        </span>
                      </div>

                      <div className={cx(artFrameClass, 'flex items-center justify-center')}>
                        {weapon ? (
                          <WeaponArtwork
                            className={cx(
                              isActive && 'brightness-[1.08] saturate-[1.1]',
                              (isLocked || !canEquip) && 'opacity-60 saturate-[0.58]',
                            )}
                            muted={isLocked || !canEquip}
                            testId={`equipment-slot-art-${slot}`}
                            weapon={weapon}
                          />
                        ) : (
                          <EmptySlotMarkIcon className="h-10 w-10 text-[rgba(16,16,16,0.28)]" />
                        )}
                      </div>

                      <div className={cardMetaClass}>
                        <p className={cx(cardTitleClass, 'break-keep whitespace-nowrap leading-none', isActive && 'text-[var(--accent-vermilion)]', (!weapon || isLocked || !canEquip) && 'text-[rgba(16,16,16,0.72)]')}>{slotTitle}</p>
                        <div className="flex min-h-[2rem] items-start">
                          <StatusChip tone={slotCopy.tone}>{slotCopy.stateLabel}</StatusChip>
                        </div>
                        <p className={cx(cardBodyTextClass, isActive && 'text-[rgba(181,57,34,0.82)]', (!weapon || isLocked || !canEquip) && 'text-[rgba(16,16,16,0.56)]')}>
                          {slotCopy.detail}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className={`${modalSectionClass} px-4 py-4 sm:px-5`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={sectionEyebrowClass}>商店</p>
              <h3 className={sectionTitleClass}>永久解锁</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={pillClass}>
                <CoinStackIcon className="mr-1 h-3.5 w-3.5" />
                金币 {formatNumber(chainGold)}
              </span>
              {runGold > 0 ? (
                <span className={`${pillClass} text-[var(--accent-vermilion)]`}>
                  <CoinStackIcon className="mr-1 h-3.5 w-3.5" />
                  本局 {formatNumber(runGold)}
                </span>
              ) : null}
            </div>
          </div>

          <div className={shopRackClass}>
            <div
              className={cx(
                'relative overflow-hidden rounded-[1.35rem] border px-3 py-3.5 shadow-[0_12px_22px_rgba(0,0,0,0.08)] sm:px-4 sm:py-4',
                bowOwned
                  ? 'border-[rgba(16,16,16,0.12)] bg-[linear-gradient(180deg,rgba(250,250,250,0.94),rgba(241,241,241,0.92))] text-[rgba(16,16,16,0.76)]'
                  : 'border-[rgba(16,16,16,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,247,247,0.94))] text-[var(--ink-900)]',
              )}
              data-testid="shop-product-card"
            >
              <div
                aria-hidden
                className={cx(
                'absolute inset-[0.3rem] rounded-[1rem] border',
                bowOwned
                    ? 'border-[rgba(16,16,16,0.08)] bg-[rgba(255,255,255,0.14)]'
                    : 'border-[rgba(16,16,16,0.08)] bg-[rgba(255,255,255,0.2)]',
                )}
              />
              <SlotCorners active={false} muted={bowOwned} />

              <div className="relative z-[1] flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-start justify-between gap-2 sm:hidden">
                  <StatusChip tone={bowOwned ? 'locked' : 'brass'}>{bowOwned ? '已持有' : '10 金币'}</StatusChip>
                </div>

                <div className="flex justify-center sm:w-[11rem] sm:flex-none">
                  <div className={cx(artFrameClass, 'flex items-center justify-center')}>
                    <WeaponArtwork
                      className={cx(bowOwned && 'opacity-70 saturate-[0.72]')}
                      muted={bowOwned}
                      testId="shop-product-art"
                      weapon="bow"
                    />
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="hidden justify-end sm:flex">
                    <StatusChip tone={bowOwned ? 'locked' : 'brass'}>{bowOwned ? '已持有' : '10 金币'}</StatusChip>
                  </div>

                  <div className="space-y-2">
                    <p className={cx(cardTitleClass, bowOwned && 'text-[rgba(16,16,16,0.78)]')}>霜翎逐月</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip tone={bowOwned ? 'locked' : 'owned'}>{bowOwned ? '售罄' : gameState === 'paused' ? '可购即装' : '永久解锁'}</StatusChip>
                      {!bowOwned ? <span className={pillClass}>10 金币</span> : null}
                    </div>
                    <p className={cx('max-w-[30rem]', cardBodyTextClass, bowOwned && 'text-[rgba(16,16,16,0.56)]')}>
                      {bowOwned ? '已永久收录进军械柜，暂停后可切换为当前武器。' : '消耗 10 金币永久解锁，并在暂停时可切换为当前武器。'}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                      <span className={pillClass}>
                        <CoinStackIcon className="mr-1 h-3.5 w-3.5" />
                        金币 {formatNumber(chainGold)}
                      </span>
                      {runGold > 0 ? (
                        <span className={`${pillClass} text-[var(--accent-vermilion)]`}>
                          <CoinStackIcon className="mr-1 h-3.5 w-3.5" />
                          本局 {formatNumber(runGold)}
                        </span>
                      ) : null}
                    </div>
                    <button
                      className={cx(
                        bowOwned ? buttonSecondaryClass : buttonPrimaryClass,
                        buttonSizeSmClass,
                        'h-10 w-full max-w-full rounded-[1rem] px-3.5 text-[13px] shadow-[0_12px_20px_rgba(0,0,0,0.12)] sm:h-10 sm:w-[10.5rem] sm:min-w-0 sm:px-3 sm:text-[13px]',
                      )}
                      data-testid="purchase-bow"
                      disabled={!canPurchaseBow || bowOwned || purchasePending}
                      onClick={onPurchaseBow}
                      type="button"
                    >
                      {bowOwned ? '已拥有' : purchasePending ? '购入中...' : '购买并装备'}
                    </button>
                  </div>
                  {purchaseBowBlockedReason ? (
                    <p className="text-[12px] leading-5 text-[var(--accent-vermilion)]" data-testid="purchase-bow-blocked-reason">
                      {purchaseBowBlockedReason}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        {purchaseError ? (
          <div className="flex items-center gap-2 rounded-[1rem] border border-[rgba(181,57,34,0.16)] bg-[rgba(181,57,34,0.08)] px-3 py-2.5 text-[13px] font-medium text-[var(--accent-vermilion)]">
            <LockBadgeIcon className="h-4 w-4" />
            <span>{purchaseError}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

const SlotCorners = ({
  active,
  muted,
}: {
  active: boolean
  muted: boolean
}) => {
  const cornerClass = active
    ? 'bg-[rgba(181,57,34,0.26)]'
    : muted
      ? 'bg-[rgba(16,16,16,0.12)]'
      : 'bg-[rgba(16,16,16,0.18)]'

  return (
    <>
      <span aria-hidden className={`absolute left-2 top-2 h-1.5 w-1.5 rounded-full ${cornerClass}`} />
      <span aria-hidden className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${cornerClass}`} />
      <span aria-hidden className={`absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full ${cornerClass}`} />
      <span aria-hidden className={`absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full ${cornerClass}`} />
    </>
  )
}

const StatusChip = ({
  children,
  tone,
}: {
  children: ReactNode
  tone: 'active' | 'owned' | 'locked' | 'empty' | 'brass'
}) => (
  <span
    className={cx(
      chipBaseClass,
      tone === 'active' && 'border-[rgba(181,57,34,0.16)] bg-[rgba(181,57,34,0.1)] text-[var(--accent-vermilion)]',
      tone === 'owned' && 'border-[rgba(16,16,16,0.1)] bg-[rgba(255,255,255,0.82)] text-[var(--ink-700)]',
      tone === 'locked' && 'border-[rgba(16,16,16,0.08)] bg-[rgba(245,245,245,0.88)] text-[rgba(16,16,16,0.5)]',
      tone === 'empty' && 'border-[rgba(16,16,16,0.08)] bg-[rgba(248,248,248,0.72)] text-[rgba(16,16,16,0.42)]',
      tone === 'brass' && 'border-[rgba(181,57,34,0.14)] bg-[rgba(181,57,34,0.08)] text-[var(--brass-500)]',
    )}
  >
    {children}
  </span>
)
