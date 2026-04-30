import type {
  ChainPanelState,
  LevelCatalogEntry,
  RunSummary,
  SubmissionStage,
} from '../game/types'

const HISTORY_PENDING_STAGES = new Set<SubmissionStage>(['synced', 'finalizing', 'confirmed'])

const buildLevelLabelById = (levels: LevelCatalogEntry[]) =>
  new Map(levels.map((level) => [level.levelId, level.map.label] as const))

// 将“本局最新 summary”叠加到链面板状态，补齐同步中的历史/排行榜提示。
export const decorateChainPanelState = ({
  baseState,
  levels,
  latestSummary,
  submitStage,
  forceChainReadActive,
}: {
  baseState: ChainPanelState
  levels: LevelCatalogEntry[]
  latestSummary: RunSummary | null
  submitStage: SubmissionStage
  forceChainReadActive: boolean
}): ChainPanelState => {
  const nextState: ChainPanelState = {
    ...baseState,
    leaderboard: [...baseState.leaderboard],
    history: [...baseState.history],
  }

  const hasPendingSummary = Boolean(latestSummary?.cleared)
  if (!hasPendingSummary || !latestSummary) {
    return nextState
  }

  const historyHasConfirmedMatch = nextState.history.some((entry) => entry.evidenceHash === latestSummary.evidenceHash)
  const shouldShowPendingHistory =
    HISTORY_PENDING_STAGES.has(submitStage) && !historyHasConfirmedMatch

  if (shouldShowPendingHistory) {
    // 在历史顶部插入一条 pending 记录，解决索引器延迟造成的“提交后空窗”。
    const levelLabelById = buildLevelLabelById(levels)
    nextState.history = [
      {
        levelId: latestSummary.levelId,
        levelLabel: levelLabelById.get(latestSummary.levelId) ?? latestSummary.levelId,
        birdsUsed: latestSummary.birdsUsed,
        destroyedPigs: latestSummary.destroyedPigs,
        durationMs: latestSummary.durationMs,
        evidenceHash: latestSummary.evidenceHash,
        submittedAt: Math.max(1, Math.floor(latestSummary.evidence.finishedAtMs / 1000)),
        pending: true,
      },
      ...nextState.history.filter((entry) => entry.evidenceHash !== latestSummary.evidenceHash),
    ]
    nextState.historySyncMessage =
      submitStage === 'confirmed' ? '本局最新战绩已确认，正在同步到历史记录…' : '本局最新战绩同步中…'
  }

  const shouldShowLeaderboardSync =
    submitStage === 'synced' || submitStage === 'finalizing' || (submitStage === 'confirmed' && forceChainReadActive)
  if (shouldShowLeaderboardSync) {
    nextState.leaderboardSyncMessage = '正在同步最新成绩到排行榜…'
  }

  return nextState
}
