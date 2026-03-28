/**
 * 模块职责：展示游戏进行中的核心 HUD 指标（分数、躲避数、时长、个人最佳）。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import { memo } from 'react'
import type { DifficultySnapshot } from '../../game/types'
import { formatDuration, formatScore } from '../../shared/utils/format'

type GameHudProps = {
  score: number
  survivalMs: number
  bestScore: number
  totalDodged: number
  difficulty: DifficultySnapshot
}

/**
 * 游戏头部指标面板。
 * 采用 `memo` 减少无关渲染，确保 Phaser 运行时 UI 足够轻量。
 */
export const GameHud = memo(function GameHud({
  score,
  survivalMs,
  bestScore,
  totalDodged,
  difficulty,
}: GameHudProps) {
  return (
    <section className="grid grid-cols-2 gap-2 border-b border-[var(--line-soft)] px-3 py-3 text-xs sm:grid-cols-4 sm:gap-3 sm:px-5 sm:py-4 sm:text-sm">
      <div className="rounded-lg border border-[var(--line-soft)] bg-[rgba(255,255,255,0.56)] px-3 py-2.5">
        <p className="text-[11px] font-medium text-[var(--ink-500)]">当前分</p>
        <p
          className="numeric-tabular mt-1 text-base font-semibold text-[var(--ink-900)] sm:text-[1.12rem]"
          data-testid="score-value"
        >
          {formatScore(score)}
        </p>
      </div>

      <div className="rounded-lg border border-[var(--line-soft)] bg-[rgba(255,255,255,0.56)] px-3 py-2.5">
        <p className="text-[11px] font-medium text-[var(--ink-500)]">已躲避</p>
        <p className="numeric-tabular mt-1 text-base font-semibold text-[var(--ink-900)] sm:text-[1.12rem]">
          {totalDodged}
        </p>
      </div>

      <div className="rounded-lg border border-[var(--line-soft)] bg-[rgba(255,255,255,0.56)] px-3 py-2.5">
        <p className="text-[11px] font-medium text-[var(--ink-500)]">生存时长</p>
        <p className="numeric-tabular mt-1 text-base font-semibold text-[var(--ink-900)] sm:text-[1.12rem]">
          {formatDuration(survivalMs)}
        </p>
      </div>

      <div className="rounded-lg border border-[var(--line-soft)] bg-[rgba(255,255,255,0.56)] px-3 py-2.5">
        <p className="text-[11px] font-medium text-[var(--ink-500)]">我的最佳成绩</p>
        <p className="numeric-tabular mt-1 text-base font-semibold text-[var(--ink-900)] sm:text-[1.12rem]">
          {formatScore(bestScore)}
        </p>
      </div>

      <span className="sr-only" data-testid="threat-density-value">
        {/* 该值主要供测试读取，不在 UI 上直接展示。 */}
        {difficulty.activeCap}
      </span>
    </section>
  )
})
