/**
 * 纯展示型 HUD。
 * 不直接订阅 controller，只负责把分数/时长/链上最佳渲染成四宫格。
 */
import { memo } from 'react'
import { formatDuration, formatScore } from '../../shared/utils/format'

type GameHudProps = {
  score: number
  survivalMs: number
  bestScore: number
  totalDodged: number
}

export const GameHud = memo(function GameHud({
  score,
  survivalMs,
  bestScore,
  totalDodged,
}: GameHudProps) {
  return (
    <section className="border-b border-[var(--line-soft)] px-3 py-2.5 text-xs sm:px-5 sm:py-3 sm:text-sm">
      {/* 四宫格维持稳定布局，保证高频分数刷新时页面结构不抖动。 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <div className="rounded-lg border border-[var(--line-soft)] bg-[rgba(255,255,255,0.56)] px-3 py-2">
          <p className="text-[11px] font-medium text-[var(--ink-500)]">当前分</p>
          <p
            className="numeric-tabular mt-1 text-base font-semibold text-[var(--ink-900)] sm:text-[1.12rem]"
            data-testid="score-value"
          >
            {formatScore(score)}
          </p>
        </div>

        <div className="rounded-lg border border-[var(--line-soft)] bg-[rgba(255,255,255,0.56)] px-3 py-2">
          <p className="text-[11px] font-medium text-[var(--ink-500)]">落台数</p>
          <p className="numeric-tabular mt-1 text-base font-semibold text-[var(--ink-900)] sm:text-[1.12rem]">
            {totalDodged}
          </p>
        </div>

        <div className="rounded-lg border border-[var(--line-soft)] bg-[rgba(255,255,255,0.56)] px-3 py-2">
          <p className="text-[11px] font-medium text-[var(--ink-500)]">生存时长</p>
          <p className="numeric-tabular mt-1 text-base font-semibold text-[var(--ink-900)] sm:text-[1.12rem]">
            {formatDuration(survivalMs)}
          </p>
        </div>

        <div className="rounded-lg border border-[var(--line-soft)] bg-[rgba(255,255,255,0.56)] px-3 py-2">
          <p className="text-[11px] font-medium text-[var(--ink-500)]">我的最佳成绩</p>
          <p className="numeric-tabular mt-1 text-base font-semibold text-[var(--ink-900)] sm:text-[1.12rem]">
            {formatScore(bestScore)}
          </p>
        </div>
      </div>
    </section>
  )
})
