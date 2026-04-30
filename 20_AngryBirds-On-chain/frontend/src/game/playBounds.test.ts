import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  computePlayRightBoundaryLayout,
  computeStructureBounds,
  PLAYFIELD_RIGHT_SCREEN_INSET_PX,
  PLAYFIELD_STRUCTURE_RIGHT_PADDING_PX,
} from './playBounds'
import type { LevelGameplayDefinition } from './types'

const loadLevel = (levelId: string) => {
  const levelPath = resolve(process.cwd(), `public/levels/${levelId}.gameplay.json`)
  return JSON.parse(readFileSync(levelPath, 'utf8')) as LevelGameplayDefinition
}

const level = loadLevel('level-0')
const structureBounds = computeStructureBounds(level)

describe('computePlayRightBoundaryLayout', () => {
  it('keeps the default zoom when the viewport already fits the right boundary', () => {
    const layout = computePlayRightBoundaryLayout({
      viewportWidth: 1400,
      worldWidth: level.world.width,
      defaultZoom: level.camera.defaultZoom,
      cameraMinX: level.camera.minX,
      cameraMaxX: level.camera.maxX,
      structureRightX: structureBounds.right,
    })

    expect(layout.targetZoom).toBe(level.camera.defaultZoom)
    expect(layout.requiredRightBoundaryX).toBe(structureBounds.right + PLAYFIELD_STRUCTURE_RIGHT_PADDING_PX)
    expect(layout.effectiveRightBoundaryX).toBeGreaterThanOrEqual(layout.requiredRightBoundaryX)
    expect(layout.effectiveRightBoundaryScreenX).toBeCloseTo(1400 - PLAYFIELD_RIGHT_SCREEN_INSET_PX, 4)
  })

  it('slightly zooms out when the viewport is too narrow to keep the right boundary visible', () => {
    const layout = computePlayRightBoundaryLayout({
      viewportWidth: 960,
      worldWidth: level.world.width,
      defaultZoom: level.camera.defaultZoom,
      cameraMinX: level.camera.minX,
      cameraMaxX: level.camera.maxX,
      structureRightX: structureBounds.right,
    })

    expect(layout.targetZoom).toBeLessThan(level.camera.defaultZoom)
    expect(layout.effectiveRightBoundaryX).toBeGreaterThanOrEqual(structureBounds.right + PLAYFIELD_STRUCTURE_RIGHT_PADDING_PX)
    expect(layout.effectiveRightBoundaryScreenX).toBeCloseTo(960 - PLAYFIELD_RIGHT_SCREEN_INSET_PX, 4)
  })

  ;['level-2', 'level-3', 'level-4'].forEach((levelId) => {
    it(`keeps ${levelId} fully visible on a narrow viewport`, () => {
      const changedLevel = loadLevel(levelId)
      const changedStructureBounds = computeStructureBounds(changedLevel)
      const layout = computePlayRightBoundaryLayout({
        viewportWidth: 960,
        worldWidth: changedLevel.world.width,
        defaultZoom: changedLevel.camera.defaultZoom,
        cameraMinX: changedLevel.camera.minX,
        cameraMaxX: changedLevel.camera.maxX,
        structureRightX: changedStructureBounds.right,
      })

      expect(layout.effectiveRightBoundaryX).toBeGreaterThanOrEqual(
        changedStructureBounds.right + PLAYFIELD_STRUCTURE_RIGHT_PADDING_PX,
      )
      expect(layout.effectiveRightBoundaryScreenX).toBeCloseTo(960 - PLAYFIELD_RIGHT_SCREEN_INSET_PX, 4)
    })
  })
})
