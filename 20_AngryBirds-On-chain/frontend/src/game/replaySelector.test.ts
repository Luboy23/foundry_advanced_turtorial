import { describe, expect, it } from 'vitest'
import { createDefaultProgress, type LevelCatalogEntry } from './types'
import { getReplayableLevels, resolveReplaySelection } from './replaySelector'

const createLevel = ({
  levelId,
  order,
  enabled = true,
}: {
  levelId: string
  order: number
  enabled?: boolean
}): LevelCatalogEntry => ({
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
    file: `/levels/${levelId}.gameplay.json`,
    contentHash: '0x1234',
    order,
    enabled,
  },
  map: {
    levelId,
    order,
    label: `${order}`,
    title: `Level ${order}`,
    mapX: 640,
    mapY: 320,
  },
})

describe('getReplayableLevels', () => {
  it('only returns enabled completed levels ordered by campaign order', () => {
    const levels = [
      createLevel({ levelId: 'level-3', order: 4 }),
      createLevel({ levelId: 'level-1', order: 2 }),
      createLevel({ levelId: 'level-2', order: 3, enabled: false }),
      createLevel({ levelId: 'level-0', order: 1 }),
    ]
    const progress = {
      ...createDefaultProgress(),
      completedLevelIds: ['level-3', 'level-2', 'level-0'],
    }

    expect(getReplayableLevels(levels, progress).map((level) => level.levelId)).toEqual(['level-0', 'level-3'])
  })
})

describe('resolveReplaySelection', () => {
  const replayableLevels = [
    createLevel({ levelId: 'level-0', order: 1 }),
    createLevel({ levelId: 'level-1', order: 2 }),
    createLevel({ levelId: 'level-2', order: 3 }),
  ]

  it('keeps the current selection when it is still valid', () => {
    expect(
      resolveReplaySelection({
        replayableLevels,
        selectedReplayLevelId: 'level-1',
        currentLevelId: 'level-2',
      }),
    ).toBe('level-1')
  })

  it('falls back to the current completed level when the previous selection is invalid', () => {
    expect(
      resolveReplaySelection({
        replayableLevels,
        selectedReplayLevelId: 'level-9',
        currentLevelId: 'level-1',
      }),
    ).toBe('level-1')
  })

  it('falls back to the highest completed order when selection and current level are unavailable', () => {
    expect(
      resolveReplaySelection({
        replayableLevels,
        selectedReplayLevelId: 'level-9',
        currentLevelId: 'level-8',
      }),
    ).toBe('level-2')
  })

  it('returns null when there are no replayable levels', () => {
    expect(
      resolveReplaySelection({
        replayableLevels: [],
        selectedReplayLevelId: 'level-1',
        currentLevelId: 'level-1',
      }),
    ).toBeNull()
  })
})
