import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildLaunchState, estimateIdealLaunchRangePx, getLaunchExtents } from './launchModel'
import type { LevelGameplayDefinition } from './types'

const levelPath = resolve(process.cwd(), 'public/levels/level-0.gameplay.json')
const level = JSON.parse(readFileSync(levelPath, 'utf8')) as LevelGameplayDefinition

describe('launch model', () => {
  it('uses demo-like asymmetric drag extents for level-0', () => {
    const extents = getLaunchExtents(level.slingshot.maxDrag)

    expect(extents.left).toBe(level.slingshot.maxDrag)
    expect(extents.left).toBeGreaterThanOrEqual(190)
    expect(extents.right).toBeGreaterThanOrEqual(88)
    expect(extents.right).toBeLessThanOrEqual(92)
    expect(extents.up).toBeGreaterThanOrEqual(104)
    expect(extents.up).toBeLessThanOrEqual(106)
    expect(extents.down).toBeGreaterThanOrEqual(149)
    expect(extents.down).toBeLessThanOrEqual(151)
    expect(extents.left).toBeGreaterThan(extents.right)
    expect(extents.down).toBeGreaterThan(extents.up)
  })

  it('keeps level-0 max launch materially stronger than the previous tuning', () => {
    const launchState = buildLaunchState({
      anchorX: level.slingshot.anchorX,
      anchorY: level.slingshot.anchorY,
      pointerX: level.slingshot.anchorX - 320,
      pointerY: level.slingshot.anchorY + 260,
      maxDrag: level.slingshot.maxDrag,
      launchVelocityScale: level.slingshot.launchVelocityScale,
      pixelsPerMeter: level.world.pixelsPerMeter,
    })

    const idealRangePx = estimateIdealLaunchRangePx({
      velocityMetersPerSecond: launchState.velocityMetersPerSecond,
      gravityY: level.world.gravityY,
      pixelsPerMeter: level.world.pixelsPerMeter,
    })
    const firstStructureX = Math.min(...level.pieces.map((piece) => piece.x))

    expect(launchState.velocityPxPerSecond.x).toBeGreaterThan(1000)
    expect(launchState.velocityPxPerSecond.y).toBeLessThan(0)
    expect(idealRangePx).toBeGreaterThan(firstStructureX - level.slingshot.anchorX + 260)
  })
})
