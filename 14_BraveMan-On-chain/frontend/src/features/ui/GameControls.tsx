import { memo, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { GameState } from '../../game/types'
import type { TouchControlMode } from '../../shared/storage/types'
import { clamp } from '../../shared/utils/math'
import {
  HistoryIcon,
  PauseIcon,
  ResumeIcon,
  RetreatIcon,
  SettingsIcon,
  StartIcon,
} from './GameUiIcons'
import { RailActionButton } from './RailActionButton'
import { buttonPrimaryClass, buttonSecondaryClass, railPanelClass } from './buttonStyles'

type GameControlsProps = {
  gameState: GameState
  startBlockedReason: string | null
  startPending?: boolean
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onRetreat: () => void
  onOpenSettings: () => void
  onOpenHistory: () => void
}

type DesktopFloatingControlsProps = GameControlsProps & {
  className?: string
  layout?: 'rail' | 'toolbar'
}

export const GameControls = memo(function GameControls({
  gameState,
  startBlockedReason,
  startPending = false,
  onStart,
  onPause,
  onResume,
  onRetreat,
  onOpenSettings,
  onOpenHistory,
}: GameControlsProps) {
  const pauseResumeLabel = useMemo(() => gameState === 'running' ? '暂停' : gameState === 'paused' ? '继续' : '暂停/继续', [gameState])
  const canTogglePauseResume = gameState === 'running' || gameState === 'paused'
  const canStart = (gameState === 'idle' || gameState === 'gameover') && !startBlockedReason && !startPending

  return (
    <section className="mx-auto w-full max-w-[980px] px-2 py-4 sm:px-5 sm:py-5">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
        <button className={`${buttonPrimaryClass} w-full whitespace-nowrap px-1.5 py-2 text-[11px] sm:px-3 sm:py-2.5 sm:text-sm`} data-testid="control-start" disabled={!canStart} onClick={onStart} type="button">{startPending ? '创建战局中...' : '开始'}</button>
        <button className={`${buttonSecondaryClass} w-full whitespace-nowrap px-1.5 py-2 text-[11px] sm:px-3 sm:py-2.5 sm:text-sm`} data-testid="control-pause-resume" disabled={!canTogglePauseResume} onClick={gameState === 'running' ? onPause : onResume} type="button">{pauseResumeLabel}</button>
        <button className={`${buttonSecondaryClass} w-full whitespace-nowrap px-1.5 py-2 text-[11px] sm:px-3 sm:py-2.5 sm:text-sm`} data-testid="control-retreat" disabled={gameState !== 'paused'} onClick={onRetreat} type="button">结算</button>
        <button className={`${buttonSecondaryClass} w-full whitespace-nowrap px-1.5 py-2 text-[11px] sm:px-3 sm:py-2.5 sm:text-sm`} data-testid="control-settings" onClick={onOpenSettings} type="button">设置</button>
        <button className={`${buttonSecondaryClass} w-full whitespace-nowrap px-1.5 py-2 text-[11px] sm:px-3 sm:py-2.5 sm:text-sm`} data-testid="control-history" onClick={onOpenHistory} type="button">战绩</button>
      </div>
      {startPending ? (
        <p className="mt-2 text-center text-[11px] text-[var(--ink-600)]" data-testid="start-pending-status">正在向对局服务申请 session，请稍候...</p>
      ) : startBlockedReason ? (
        <p className="mt-2 text-center text-[11px] text-[var(--accent-vermilion)]" data-testid="start-blocked-reason">{startBlockedReason}</p>
      ) : null}
    </section>
  )
})

export const DesktopFloatingControls = memo(function DesktopFloatingControls({
  gameState,
  startBlockedReason,
  startPending = false,
  onStart,
  onPause,
  onResume,
  onRetreat,
  onOpenSettings,
  onOpenHistory,
  className,
  layout = 'rail',
}: DesktopFloatingControlsProps) {
  const controls = useMemo(() => {
    if (gameState === 'gameover') return []
    if (gameState === 'running') {
      return [
        { key: 'pause-resume', label: '暂停', icon: PauseIcon, onClick: onPause, disabled: false, primary: true, title: '暂停' },
        { key: 'settings', label: '设置', icon: SettingsIcon, onClick: onOpenSettings, disabled: false, primary: false, title: '设置' },
      ]
    }
    if (gameState === 'paused') {
      return [
        { key: 'pause-resume', label: '继续', icon: ResumeIcon, onClick: onResume, disabled: false, primary: true, title: '继续' },
        { key: 'retreat', label: '结算', icon: RetreatIcon, onClick: onRetreat, disabled: false, primary: false, title: '结算' },
        { key: 'settings', label: '设置', icon: SettingsIcon, onClick: onOpenSettings, disabled: false, primary: false, title: '设置' },
        { key: 'history', label: '战绩', icon: HistoryIcon, onClick: onOpenHistory, disabled: false, primary: false, title: '战绩' },
      ]
    }
    return [
      {
        key: 'start',
        label: startPending ? '创建战局中...' : '开始',
        icon: StartIcon,
        onClick: onStart,
        disabled: Boolean(startBlockedReason) || startPending,
        primary: true,
        title: startPending ? '创建战局中...' : (startBlockedReason ?? '开始'),
      },
      { key: 'settings', label: '设置', icon: SettingsIcon, onClick: onOpenSettings, disabled: false, primary: false, title: '设置' },
      { key: 'history', label: '战绩', icon: HistoryIcon, onClick: onOpenHistory, disabled: false, primary: false, title: '战绩' },
    ]
  }, [gameState, onOpenHistory, onOpenSettings, onPause, onResume, onRetreat, onStart, startBlockedReason, startPending])

  if (controls.length === 0) return null

  if (layout === 'toolbar') {
    return (
      <section
        className={[
          'flex flex-wrap items-center justify-end gap-2',
          className,
        ].filter(Boolean).join(' ')}
        data-testid="desktop-floating-controls"
      >
        {controls.map((control) => (
          <RailActionButton
            className="min-w-[5.35rem] px-2.5 pr-2.5 md:min-w-[5.55rem]"
            data-testid={`floating-control-${control.key}`}
            disabled={control.disabled}
            icon={<control.icon className="h-4 w-4" />}
            iconTestId={`floating-control-${control.key}-icon`}
            key={control.key}
            label={control.label}
            layout="default"
            onClick={control.onClick}
            size="sm"
            title={control.title}
            tone={control.primary ? 'primary' : 'secondary'}
          />
        ))}
        {gameState === 'idle' && startBlockedReason && !startPending ? (
          <p
            className={`${railPanelClass} max-w-[14.5rem] px-3 py-1.5 text-[10px] leading-tight text-[var(--accent-vermilion)]`}
            data-testid="start-blocked-reason"
          >
            {startBlockedReason}
          </p>
        ) : null}
      </section>
    )
  }

  return (
    <section
      className={[
        'relative hidden w-11 flex-col items-end gap-2 overflow-visible md:flex',
        className,
      ].filter(Boolean).join(' ')}
      data-testid="desktop-floating-controls"
    >
      {controls.map((control) => (
        <RailActionButton
          className="pointer-events-auto"
          data-testid={`floating-control-${control.key}`}
          disabled={control.disabled}
          icon={<control.icon className="h-4.5 w-4.5" />}
          iconTestId={`floating-control-${control.key}-icon`}
          key={control.key}
          label={control.label}
          layout="icon-rail"
          onClick={control.onClick}
          size="sm"
          title={control.title}
          tone={control.primary ? 'primary' : 'secondary'}
        />
      ))}
      {gameState === 'idle' && startBlockedReason && !startPending ? (
        <p
          className={`${railPanelClass} pointer-events-none absolute right-[calc(100%+0.55rem)] top-0 z-[1] max-w-[14.5rem] px-3 py-1.5 text-[10px] leading-tight text-[var(--accent-vermilion)]`}
          data-testid="start-blocked-reason"
        >
          {startBlockedReason}
        </p>
      ) : null}
    </section>
  )
})

type TouchControlsProps = {
  touchControlMode: TouchControlMode
  gameState: GameState
  onMove: (x: -1 | 0 | 1, y: -1 | 0 | 1) => void
  onStop: () => void
  onToggleWeapon: () => void
  onPauseResume: () => void
}

const resolveDirection = (ratio: number): -1 | 0 | 1 => (ratio < -0.35 ? -1 : ratio > 0.35 ? 1 : 0)

export const TouchControls = memo(function TouchControls({
  touchControlMode,
  gameState,
  onMove,
  onStop,
  onToggleWeapon,
  onPauseResume,
}: TouchControlsProps) {
  const activePointerIdRef = useRef<number | null>(null)
  const [activeX, setActiveX] = useState(0)
  const [activeY, setActiveY] = useState(0)

  const applyPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const dx = clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1)
    const dy = clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1)
    setActiveX(dx)
    setActiveY(dy)
    onMove(resolveDirection(dx), resolveDirection(dy))
  }

  const reset = () => {
    setActiveX(0)
    setActiveY(0)
    onStop()
  }

  return (
    <section className="border-t border-[var(--line-soft)] px-4 pb-4 pt-3 md:hidden">
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">移动端控制</p>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        {touchControlMode === 'joystick' ? (
          <div
            className="relative h-28 rounded-2xl border border-[var(--line-soft)] bg-[rgba(255,255,255,0.72)]"
            onPointerDown={(event) => {
              activePointerIdRef.current = event.pointerId
              event.currentTarget.setPointerCapture(event.pointerId)
              applyPointer(event)
            }}
            onPointerMove={(event) => {
              if (activePointerIdRef.current !== event.pointerId) return
              applyPointer(event)
            }}
            onPointerUp={(event) => {
              if (activePointerIdRef.current !== event.pointerId) return
              activePointerIdRef.current = null
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
              reset()
            }}
            onPointerLeave={() => {
              activePointerIdRef.current = null
              reset()
            }}
            data-testid="touch-joystick"
          >
            <span className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--line-soft)]" />
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border border-[var(--accent-vermilion)] bg-[rgba(181,57,34,0.12)]" style={{ transform: `translate(calc(-50% + ${activeX * 28}px), calc(-50% + ${activeY * 28}px))` }} />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <span />
            <button className={`${buttonSecondaryClass} px-3 py-3`} onPointerDown={() => onMove(0, -1)} onPointerUp={onStop} onPointerLeave={onStop} type="button">上</button>
            <span />
            <button className={`${buttonSecondaryClass} px-3 py-3`} onPointerDown={() => onMove(-1, 0)} onPointerUp={onStop} onPointerLeave={onStop} type="button">左</button>
            <button className={`${buttonSecondaryClass} px-3 py-3`} onPointerDown={() => onMove(0, 1)} onPointerUp={onStop} onPointerLeave={onStop} type="button">下</button>
            <button className={`${buttonSecondaryClass} px-3 py-3`} onPointerDown={() => onMove(1, 0)} onPointerUp={onStop} onPointerLeave={onStop} type="button">右</button>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button className={`${buttonSecondaryClass} min-w-[5.5rem] px-3 py-3 text-sm`} onClick={onToggleWeapon} type="button">切武器</button>
          <button className={`${buttonSecondaryClass} min-w-[5.5rem] px-3 py-3 text-sm`} onClick={onPauseResume} type="button">{gameState === 'running' ? '暂停' : '继续'}</button>
        </div>
      </div>
    </section>
  )
})
