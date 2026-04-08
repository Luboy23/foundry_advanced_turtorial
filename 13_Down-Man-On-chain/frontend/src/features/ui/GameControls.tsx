/**
 * 桌面控制条与移动端触控模块。
 * 触控模块自身始终只在移动端断点下显示，具体操控模式由 settings 决定。
 */
import { memo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { GameState } from '../../game/types'
import type { TouchControlMode } from '../../shared/storage/types'
import { buttonPrimaryClass, buttonSecondaryClass } from './buttonStyles'

type GameControlsProps = {
  gameState: GameState
  startBlockedReason: string | null
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onOpenSettings: () => void
  onOpenLeaderboard: () => void
  onOpenHistory: () => void
}

export const GameControls = memo(function GameControls({
  gameState,
  startBlockedReason,
  onStart,
  onPause,
  onResume,
  onOpenSettings,
  onOpenLeaderboard,
  onOpenHistory,
}: GameControlsProps) {
  const pauseResumeLabel =
    gameState === 'running'
      ? '暂停'
      : gameState === 'paused'
        ? '继续'
        : '暂停/继续'
  const canTogglePauseResume = gameState === 'running' || gameState === 'paused'

  // 只暴露一个“暂停/继续”按钮，避免桌面和移动端出现两套主流程控制语义。
  const handlePauseResume = () => {
    if (gameState === 'running') {
      onPause()
      return
    }

    if (gameState === 'paused') {
      onResume()
    }
  }

  const canStart = (gameState === 'idle' || gameState === 'gameover') && !startBlockedReason

  return (
    <section className="mx-auto w-full max-w-[980px] px-2 py-4 sm:px-5 sm:py-5">
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        <button
          className={`${buttonPrimaryClass} w-full whitespace-nowrap px-1.5 py-2 text-[11px] sm:px-3 sm:py-2.5 sm:text-sm`}
          data-testid="control-start"
          disabled={!canStart}
          onClick={onStart}
          type="button"
        >
          开始
        </button>

        <button
          className={`${buttonSecondaryClass} w-full whitespace-nowrap px-1.5 py-2 text-[11px] sm:px-3 sm:py-2.5 sm:text-sm`}
          data-testid="control-pause-resume"
          disabled={!canTogglePauseResume}
          onClick={handlePauseResume}
          type="button"
        >
          {pauseResumeLabel}
        </button>

        <button
          className={`${buttonSecondaryClass} w-full whitespace-nowrap px-1.5 py-2 text-[11px] sm:px-3 sm:py-2.5 sm:text-sm`}
          data-testid="control-settings"
          onClick={onOpenSettings}
          type="button"
        >
          设置
        </button>

        <button
          className={`${buttonSecondaryClass} w-full whitespace-nowrap px-1.5 py-2 text-[11px] sm:px-3 sm:py-2.5 sm:text-sm`}
          data-testid="control-leaderboard"
          onClick={onOpenLeaderboard}
          type="button"
        >
          排行榜
        </button>

        <button
          className={`${buttonSecondaryClass} w-full whitespace-nowrap px-1.5 py-2 text-[11px] sm:px-3 sm:py-2.5 sm:text-sm`}
          data-testid="control-history"
          onClick={onOpenHistory}
          type="button"
        >
          历史成绩
        </button>
      </div>

      {startBlockedReason ? (
        <p className="mt-2 text-center text-[11px] text-[var(--accent-vermilion)]" data-testid="start-blocked-reason">
          {startBlockedReason}
        </p>
      ) : null}
    </section>
  )
})

type TouchControlsProps = {
  touchControlMode: TouchControlMode
  onTouchAxis: (axis: -1 | 0 | 1) => void
  onTouchFollowStart: (ratio: number) => void
  onTouchFollowMove: (ratio: number) => void
  onTouchFollowEnd: () => void
}

// 比例值是移动端触控条与游戏世界之间的中间语义，便于 React 与 Phaser 解耦。
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

const resolvePointerRatio = (event: ReactPointerEvent<HTMLDivElement>): number => {
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.width <= 0) {
    return 0.5
  }
  return clamp01((event.clientX - rect.left) / rect.width)
}

export const TouchControls = memo(function TouchControls({
  touchControlMode,
  onTouchAxis,
  onTouchFollowStart,
  onTouchFollowMove,
  onTouchFollowEnd,
}: TouchControlsProps) {
  const activePointerIdRef = useRef<number | null>(null)
  const [activeRatio, setActiveRatio] = useState<number | null>(null)

  // 跟随模式只认第一根有效手指，避免多指触控把目标点来回抢占。
  const handleFollowPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null) {
      return
    }
    activePointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    const ratio = resolvePointerRatio(event)
    setActiveRatio(ratio)
    onTouchFollowStart(ratio)
  }

  const handleFollowPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return
    }
    const ratio = resolvePointerRatio(event)
    setActiveRatio(ratio)
    onTouchFollowMove(ratio)
  }

  // 结束时无论是抬起、取消还是离开，都统一走同一套收尾逻辑。
  const handleFollowPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    activePointerIdRef.current = null
    setActiveRatio(null)
    onTouchFollowEnd()
  }

  return (
    <section className="border-t border-[var(--line-soft)] px-4 pb-4 pt-3 md:hidden">
      {/* 触控模块继续只在移动端断点显示，桌面端不占布局空间。 */}
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">
        移动端控制
      </p>
      {touchControlMode === 'follow' ? (
        <div className="space-y-2">
          <div
            className="relative h-14 w-full select-none rounded-xl border border-[var(--line-soft)] bg-[rgba(255,255,255,0.68)] shadow-sm shadow-black/5"
            data-testid="touch-follow-pad"
            onPointerCancel={handleFollowPointerEnd}
            onPointerDown={handleFollowPointerDown}
            onPointerLeave={handleFollowPointerEnd}
            onPointerMove={handleFollowPointerMove}
            onPointerUp={handleFollowPointerEnd}
            role="application"
          >
            {activeRatio !== null ? (
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 z-10 h-5 w-5 -translate-y-1/2 rounded-full border border-[var(--accent-vermilion)] bg-[rgba(244,63,94,0.18)] shadow-sm"
                style={{ left: `calc(${Math.round(activeRatio * 100)}% - 10px)` }}
              />
            ) : null}
            <span className="pointer-events-none absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-[var(--line-soft)]" />
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 text-xs font-semibold text-[var(--ink-700)]">
              {activeRatio === null ? '按住并左右滑动，角色跟随你的目标位置' : '跟随中，松开即减速停止'}
            </p>
          </div>
          <p className="text-center text-[10px] text-[var(--ink-500)]">
            可在设置中切换为按键模式
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`${buttonSecondaryClass} w-full px-3 py-3 text-base font-semibold active:scale-[0.98]`}
            data-testid="touch-left"
            onPointerCancel={() => onTouchAxis(0)}
            onPointerDown={() => onTouchAxis(-1)}
            onPointerLeave={() => onTouchAxis(0)}
            onPointerUp={() => onTouchAxis(0)}
            type="button"
          >
            向左
          </button>
          <button
            className={`${buttonSecondaryClass} w-full px-3 py-3 text-base font-semibold active:scale-[0.98]`}
            data-testid="touch-right"
            onPointerCancel={() => onTouchAxis(0)}
            onPointerDown={() => onTouchAxis(1)}
            onPointerLeave={() => onTouchAxis(0)}
            onPointerUp={() => onTouchAxis(0)}
            type="button"
          >
            向右
          </button>
        </div>
      )}
    </section>
  )
})
