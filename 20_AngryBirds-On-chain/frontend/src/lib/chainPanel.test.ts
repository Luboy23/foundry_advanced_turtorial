import { describe, expect, it } from 'vitest'
import type { ChainPanelState, LevelCatalogEntry, RunSummary } from '../game/types'
import { decorateChainPanelState } from './chainPanel'

const createLevel = (levelId: string, label: string, order = 1): LevelCatalogEntry => ({
  levelId,
  version: 1,
  world: {
    width: 1280,
    height: 720,
    groundY: 612,
    gravityY: 22,
    pixelsPerMeter: 32,
  },
  camera: {
    minX: 0,
    maxX: 1280,
    defaultZoom: 1,
  },
  slingshot: {
    anchorX: 240,
    anchorY: 520,
    maxDrag: 130,
    launchVelocityScale: 14,
  },
  birdQueue: ['red'],
  audioMaterials: {},
  pieces: [],
  manifest: {
    levelId,
    version: 1,
    file: `/levels/${levelId}.json`,
    contentHash: '0x1234',
    order,
    enabled: true,
  },
  map: {
    levelId,
    order,
    label,
    title: `${label} title`,
    mapX: 640,
    mapY: 320,
  },
})

const createSummary = (overrides: Partial<RunSummary> = {}): RunSummary => ({
  runId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  levelId: 'level-2',
  levelVersion: 1,
  birdsUsed: 2,
  destroyedPigs: 4,
  durationMs: 18_000,
  evidenceHash: '0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  cleared: true,
  evidence: {
    sessionId: '0x3234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    levelId: 'level-2',
    levelVersion: 1,
    levelContentHash: '0x4234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    clientBuildHash: '0x5234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    startedAtMs: 1_000,
    finishedAtMs: 19_000,
    summary: {
      birdsUsed: 2,
      destroyedPigs: 4,
      durationMs: 18_000,
      cleared: true,
    },
    launches: [],
    abilities: [],
    destroys: [],
    checkpoints: [],
  },
  ...overrides,
})

const createBaseState = (): ChainPanelState => ({
  isLoading: false,
  error: null,
  leaderboardLoading: false,
  historyLoading: false,
  leaderboardRefreshing: false,
  historyRefreshing: false,
  leaderboardSyncMessage: null,
  historySyncMessage: null,
  leaderboard: [],
  history: [],
})

describe('decorateChainPanelState', () => {
  it.each(['synced', 'finalizing'] as const)(
    'prepends a pending history row and leaderboard sync hint while submit stage is %s',
    (submitStage) => {
      const result = decorateChainPanelState({
        baseState: createBaseState(),
        levels: [createLevel('level-2', '第2关')],
        latestSummary: createSummary(),
        submitStage,
        forceChainReadActive: false,
      })

      expect(result.history[0]).toMatchObject({
        levelId: 'level-2',
        levelLabel: '第2关',
        pending: true,
        evidenceHash: '0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      })
      expect(result.historySyncMessage).toBe('本局最新战绩同步中…')
      expect(result.leaderboardSyncMessage).toBe('正在同步最新成绩到排行榜…')
    },
  )

  it('prepends a pending history row while a confirmed run has not appeared in history yet', () => {
    const result = decorateChainPanelState({
      baseState: createBaseState(),
      levels: [createLevel('level-2', '第2关')],
      latestSummary: createSummary(),
      submitStage: 'confirmed',
      forceChainReadActive: true,
    })

    expect(result.history[0]).toMatchObject({
      levelId: 'level-2',
      levelLabel: '第2关',
      pending: true,
      evidenceHash: '0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    })
    expect(result.historySyncMessage).toBe('本局最新战绩已确认，正在同步到历史记录…')
    expect(result.leaderboardSyncMessage).toBe('正在同步最新成绩到排行榜…')
  })

  it('drops the pending history row once the confirmed chain row is present', () => {
    const summary = createSummary()
    const result = decorateChainPanelState({
      baseState: {
        ...createBaseState(),
        history: [
          {
            levelId: 'level-2',
            levelLabel: '第2关',
            birdsUsed: 2,
            destroyedPigs: 4,
            durationMs: 18_000,
            evidenceHash: summary.evidenceHash,
            submittedAt: 19,
          },
        ],
      },
      levels: [createLevel('level-2', '第2关')],
      latestSummary: summary,
      submitStage: 'confirmed',
      forceChainReadActive: false,
    })

    expect(result.history).toHaveLength(1)
    expect(result.history[0].pending).toBeUndefined()
    expect(result.historySyncMessage).toBeNull()
  })
})
