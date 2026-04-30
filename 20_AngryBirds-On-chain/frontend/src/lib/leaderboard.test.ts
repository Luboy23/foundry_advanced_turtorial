import { describe, expect, it } from 'vitest'
import type { LevelCatalogEntry } from '../game/types'
import type { ChainLeaderboardEntry, ChainLevelConfig } from './contract'
import { attachLeaderboardMetadata } from './leaderboard'

const createLevel = (
  levelId: string,
  order: number,
  label: string,
  enabled = true,
  version = 1,
): LevelCatalogEntry => ({
  levelId,
  version,
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
  audioMaterials: {
    'pig-basic': 'pig',
  },
  pieces: [
    {
      id: `${levelId}-piece-0`,
      entityType: 'pig',
      prefabKey: 'pig-basic',
      x: 960,
      y: 560,
      rotation: 0,
    },
  ],
  manifest: {
    levelId,
    version,
    file: `/levels/${levelId}.json`,
    contentHash: '0x1234' as `0x${string}`,
    order,
    enabled,
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

const createChainLevel = (
  levelId: string,
  order: number,
  enabled = true,
  version = 1,
): ChainLevelConfig => ({
  levelId,
  version,
  contentHash: '0x1234' as `0x${string}`,
  order,
  enabled,
})

const createEntry = (
  levelId: string,
  levelVersion: number,
  birdsUsed: number,
  durationMs: number,
  submittedAt: number,
  playerSuffix: string,
): ChainLeaderboardEntry => ({
  player: `0x${playerSuffix.padStart(40, '0')}` as `0x${string}`,
  result: {
    levelId,
    levelVersion,
    birdsUsed,
    destroyedPigs: 3,
    durationMs,
    evidenceHash: '0x1234' as `0x${string}`,
    submittedAt,
  },
})

describe('leaderboard helpers', () => {
  it('prefers chain order and local labels when attaching leaderboard metadata', () => {
    const localLevels = [createLevel('level-1', 1, '1'), createLevel('level-3', 3, '3')]
    const chainCatalog = [createChainLevel('level-3', 30), createChainLevel('level-1', 10, false)]
    const entries = [createEntry('level-3', 1, 1, 8000, 100, 'abc')]

    expect(attachLeaderboardMetadata(entries, chainCatalog, localLevels)).toEqual([
      {
        ...entries[0],
        levelOrder: 30,
        levelLabel: '3',
      },
    ])
  })

  it('falls back to enabled local metadata when chain catalog is unavailable', () => {
    const localLevels = [createLevel('level-1', 1, '1'), createLevel('level-2', 2, '2', false), createLevel('level-3', 3, '3')]
    const entries = [createEntry('level-1', 1, 2, 12000, 200, 'def')]

    expect(attachLeaderboardMetadata(entries, [], localLevels)).toEqual([
      {
        ...entries[0],
        levelOrder: 1,
        levelLabel: '1',
      },
    ])
  })

  it('keeps chain ordering untouched while only enriching leaderboard rows', () => {
    const localLevels = [createLevel('level-3', 3, '3'), createLevel('level-9', 9, '9')]
    const chainCatalog = [createChainLevel('level-3', 30), createChainLevel('level-9', 90)]
    const entries = [
      createEntry('level-3', 1, 1, 8000, 100, '111'),
      createEntry('level-9', 1, 2, 9000, 200, '222'),
    ]

    const leaderboard = attachLeaderboardMetadata(entries, chainCatalog, localLevels)

    expect(leaderboard).toHaveLength(2)
    expect(leaderboard[0].result.levelId).toBe('level-3')
    expect(leaderboard[0].levelOrder).toBe(30)
    expect(leaderboard[1].result.levelId).toBe('level-9')
    expect(leaderboard[1].levelOrder).toBe(90)
  })

  it('falls back to level id when a label is unavailable', () => {
    const leaderboard = attachLeaderboardMetadata(
      [createEntry('level-secret', 1, 2, 14_000, 100, 'abc')],
      [createChainLevel('level-secret', 7)],
      [],
    )

    expect(leaderboard[0].levelLabel).toBe('level-secret')
  })
})
