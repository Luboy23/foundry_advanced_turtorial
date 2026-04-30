import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import planck from 'planck'
import { describe, expect, it } from 'vitest'
import { LEVEL_PREFABS } from './prefabs'
import { getPlayfieldGroundBodyCenterY, PLAYFIELD_GROUND_HALF_HEIGHT } from './playfield'
import type { LevelGameplayDefinition, LevelPiece } from './types'

const loadLevel = (levelId: string) => {
  const levelPath = resolve(process.cwd(), `public/levels/${levelId}.gameplay.json`)
  return JSON.parse(readFileSync(levelPath, 'utf8')) as LevelGameplayDefinition
}

const baselineLevel = loadLevel('level-0')

const buildShape = (piece: LevelPiece, pixelsPerMeter: number) => {
  const prefab = LEVEL_PREFABS[piece.prefabKey]
  const toMeters = (value: number) => value / pixelsPerMeter

  if (prefab.shape === 'circle') {
    return planck.Circle(toMeters(prefab.radius ?? prefab.width / 2))
  }

  if (prefab.shape === 'triangle') {
    const halfWidth = toMeters(prefab.width / 2)
    const halfHeight = toMeters(prefab.height / 2)
    return planck.Polygon([
      planck.Vec2(0, -halfHeight),
      planck.Vec2(halfWidth, halfHeight),
      planck.Vec2(-halfWidth, halfHeight),
    ])
  }

  return planck.Box(toMeters(prefab.width / 2), toMeters(prefab.height / 2))
}

describe('level-0 idle stability', () => {
  it('does not free-fall before the player launches a bird', () => {
    const level = baselineLevel
    const toMeters = (value: number) => value / level.world.pixelsPerMeter
    const world = new planck.World(planck.Vec2(0, level.world.gravityY))

    const ground = world.createBody()
    ground.createFixture(
      planck.Box(toMeters(level.world.width / 2 + 120), toMeters(PLAYFIELD_GROUND_HALF_HEIGHT)),
      {
        friction: 1,
        restitution: 0.02,
      },
    )
    ground.setPosition(
      planck.Vec2(toMeters(level.world.width / 2), toMeters(getPlayfieldGroundBodyCenterY(level.world.groundY))),
    )

    const bodies = level.pieces.map((piece) => {
      const prefab = LEVEL_PREFABS[piece.prefabKey]
      const body = world.createDynamicBody({
        position: planck.Vec2(toMeters(piece.x), toMeters(piece.y)),
        angle: piece.rotation,
        linearDamping: prefab.linearDamping ?? 0.08,
        angularDamping: prefab.angularDamping ?? 0.08,
      })
      body.createFixture(buildShape(piece, level.world.pixelsPerMeter), {
        density: prefab.density,
        friction: prefab.friction,
        restitution: prefab.restitution,
      })
      return {
        id: piece.id,
        startX: piece.x,
        startY: piece.y,
        body,
      }
    })

    for (let index = 0; index < 180; index += 1) {
      world.step(1 / 60, 8, 3)
    }

    const drifts = bodies.map(({ id, startX, startY, body }) => {
      const position = body.getPosition()
      return {
        id,
        dx: Math.abs(position.x * level.world.pixelsPerMeter - startX),
        dy: Math.abs(position.y * level.world.pixelsPerMeter - startY),
      }
    })

    expect(Math.max(...drifts.map((entry) => entry.dy))).toBeLessThan(12)
    expect(Math.max(...drifts.map((entry) => entry.dx))).toBeLessThan(2)
  })
})

describe('late-game level idle stability', () => {
  const lateGameLevels: Array<{
    levelId: string
    maxBlockDx: number
    maxBlockDy: number
    maxPigDx: number
    maxPigDy: number
  }> = [
    { levelId: 'level-2', maxBlockDx: 1, maxBlockDy: 5, maxPigDx: 1, maxPigDy: 5 },
    { levelId: 'level-3', maxBlockDx: 18, maxBlockDy: 12, maxPigDx: 26, maxPigDy: 12 },
    { levelId: 'level-4', maxBlockDx: 10, maxBlockDy: 12, maxPigDx: 26, maxPigDy: 10 },
  ]

  lateGameLevels.forEach(({ levelId, maxBlockDx, maxBlockDy, maxPigDx, maxPigDy }) => {
    it(`${levelId} stays stable for 3 seconds before launch`, () => {
      const level = loadLevel(levelId)
      const toMeters = (value: number) => value / level.world.pixelsPerMeter
      const world = new planck.World(planck.Vec2(0, level.world.gravityY))

      const ground = world.createBody()
      ground.createFixture(
        planck.Box(toMeters(level.world.width / 2 + 120), toMeters(PLAYFIELD_GROUND_HALF_HEIGHT)),
        {
          friction: 1,
          restitution: 0.02,
        },
      )
      ground.setPosition(
        planck.Vec2(toMeters(level.world.width / 2), toMeters(getPlayfieldGroundBodyCenterY(level.world.groundY))),
      )

      const bodies = level.pieces.map((piece) => {
        const prefab = LEVEL_PREFABS[piece.prefabKey]
        const body = world.createDynamicBody({
          position: planck.Vec2(toMeters(piece.x), toMeters(piece.y)),
          angle: piece.rotation,
          linearDamping: prefab.linearDamping ?? 0.08,
          angularDamping: prefab.angularDamping ?? 0.08,
        })
        body.createFixture(buildShape(piece, level.world.pixelsPerMeter), {
          density: prefab.density,
          friction: prefab.friction,
          restitution: prefab.restitution,
        })
        return {
          id: piece.id,
          entityType: piece.entityType,
          startX: piece.x,
          startY: piece.y,
          body,
        }
      })

      for (let index = 0; index < 180; index += 1) {
        world.step(1 / 60, 8, 3)
      }

      const drifts = bodies.map(({ id, entityType, startX, startY, body }) => {
        const position = body.getPosition()
        return {
          id,
          entityType,
          dx: Math.abs(position.x * level.world.pixelsPerMeter - startX),
          dy: Math.abs(position.y * level.world.pixelsPerMeter - startY),
        }
      })

      const blockDrifts = drifts.filter((entry) => entry.entityType === 'block')
      const pigDrifts = drifts.filter((entry) => entry.entityType === 'pig')

      expect(Math.max(...blockDrifts.map((entry) => entry.dy))).toBeLessThan(maxBlockDy)
      expect(Math.max(...blockDrifts.map((entry) => entry.dx))).toBeLessThan(maxBlockDx)
      expect(Math.max(...pigDrifts.map((entry) => entry.dy))).toBeLessThan(maxPigDy)
      expect(Math.max(...pigDrifts.map((entry) => entry.dx))).toBeLessThan(maxPigDx)
    })
  })
})
