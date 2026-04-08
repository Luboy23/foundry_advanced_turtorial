import { describe, expect, it } from 'vitest'

import rulesetData from '../../lib/braveman-ruleset.generated.json'
import type { SessionHandshake } from '../types'
import { BrowserSimulator } from './browserSimulator'

// 测试内部敌人结构（通过类型断言访问模拟器私有状态）。
type InternalEnemy = {
  id: number
  kind: 'chaser' | 'charger'
  x: number
  y: number
  phase:
    | { kind: 'chase' }
    | { kind: 'tell'; remaining: number; dirX: number; dirY: number }
    | { kind: 'charge'; remaining: number; dirX: number; dirY: number }
  cooldown: number
}

type InternalState = Record<string, unknown> & {
  enemies: InternalEnemy[]
  kills: number
  goldEarned: number
  playerX: number
  playerY: number
  moveX: -1 | 0 | 1
  moveY: -1 | 0 | 1
  tick: number
  activeWeapon: 'sword' | 'hook_spear' | 'bow'
}

// 测试需要直接调用的内部动作入口。
type InternalActions = {
  resolveAutoAttack: () => void
  updatePlayerMovement: () => void
  spawnIfNeeded: () => void
  updateEnemies: () => void
}

// 构造固定会话，确保规则版本与 configHash 与生成文件一致。
const makeSession = (): SessionHandshake => ({
  sessionId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  seed: '1',
  expiresAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  rulesetVersion: rulesetData.meta.ruleset_version,
  configHash: rulesetData.meta.config_hash as `0x${string}`,
  bowUnlocked: false,
})

// 构造敌人桩数据，默认处于 chase 阶段。
const createEnemy = (id: number, x: number, y: number, kind: InternalEnemy['kind']): InternalEnemy => ({
  id,
  kind,
  x,
  y,
  phase: { kind: 'chase' },
  cooldown: 84,
})

describe('BrowserSimulator visual bounds', () => {
  it('clamps player movement to the shared combat rectangle', () => {
    // 场景：玩家移动越界后应被钳制在规则集定义的战斗矩形内。
    const simulator = new BrowserSimulator(makeSession())
    const state = simulator as unknown as InternalState
    const actions = simulator as unknown as InternalActions

    state.playerX = rulesetData.ruleset.player_bounds_inset_x - 12
    state.playerY = rulesetData.ruleset.arena_height - rulesetData.ruleset.player_bounds_inset_bottom + 18
    state.moveX = -1
    state.moveY = 1
    actions.updatePlayerMovement()

    expect(state.playerX).toBe(rulesetData.ruleset.player_bounds_inset_x)
    expect(state.playerY).toBe(rulesetData.ruleset.arena_height - rulesetData.ruleset.player_bounds_inset_bottom)

    state.playerX = rulesetData.ruleset.arena_width - rulesetData.ruleset.player_bounds_inset_x + 12
    state.playerY = rulesetData.ruleset.player_bounds_inset_top - 18
    state.moveX = 1
    state.moveY = -1
    actions.updatePlayerMovement()

    expect(state.playerX).toBe(rulesetData.ruleset.arena_width - rulesetData.ruleset.player_bounds_inset_x)
    expect(state.playerY).toBe(rulesetData.ruleset.player_bounds_inset_top)
  })

  it('spawns enemies inside the shared enemy rectangle', () => {
    // 场景：刷怪坐标必须落在 enemy bounds 内，避免前后端规则不一致。
    const simulator = new BrowserSimulator(makeSession())
    const state = simulator as unknown as InternalState
    const actions = simulator as unknown as InternalActions

    state.tick = 54
    actions.spawnIfNeeded()

    expect(state.enemies).toHaveLength(1)
    expect([
      rulesetData.ruleset.enemy_bounds_inset_x,
      rulesetData.ruleset.arena_width - rulesetData.ruleset.enemy_bounds_inset_x,
    ]).toContain(state.enemies[0].x)
    expect(state.enemies[0].y).toBeGreaterThanOrEqual(rulesetData.ruleset.enemy_bounds_inset_top)
    expect(state.enemies[0].y).toBeLessThanOrEqual(rulesetData.ruleset.arena_height - rulesetData.ruleset.enemy_bounds_inset_bottom)
  })

  it('keeps charger movement inside the shared enemy rectangle', () => {
    // 场景：charger 冲刺后也应受敌人活动边界钳制。
    const simulator = new BrowserSimulator(makeSession())
    const state = simulator as unknown as InternalState
    const actions = simulator as unknown as InternalActions

    state.enemies = [{
      id: 1,
      kind: 'charger',
      x: rulesetData.ruleset.arena_width - rulesetData.ruleset.enemy_bounds_inset_x - 2,
      y: rulesetData.ruleset.arena_height - rulesetData.ruleset.enemy_bounds_inset_bottom - 2,
      phase: { kind: 'charge', remaining: 18, dirX: 1, dirY: 1 },
      cooldown: 0,
    }]

    actions.updateEnemies()

    expect(state.enemies[0].x).toBe(rulesetData.ruleset.arena_width - rulesetData.ruleset.enemy_bounds_inset_x)
    expect(state.enemies[0].y).toBe(rulesetData.ruleset.arena_height - rulesetData.ruleset.enemy_bounds_inset_bottom)
  })
})

describe('BrowserSimulator sword sweep', () => {
  it('kills multiple enemies inside one horizontal sweep', () => {
    // 场景：大剑横扫一次命中多个敌人，kills 与 gold 累加应正确。
    const simulator = new BrowserSimulator(makeSession())
    const state = simulator as unknown as InternalState
    const actions = simulator as unknown as InternalActions
    state.enemies = [
      createEnemy(1, state.playerX + 36, state.playerY - 18, 'chaser'),
      createEnemy(2, state.playerX + 58, state.playerY + 20, 'chaser'),
      createEnemy(3, state.playerX + 88, state.playerY + 6, 'charger'),
    ]

    actions.resolveAutoAttack()

    expect(state.kills).toBe(3)
    expect(state.goldEarned).toBe(4)
    expect(state.enemies).toHaveLength(0)
  })

  it('does not hit enemies behind or outside sweep width', () => {
    // 场景：背后目标与超宽度目标不应被误伤。
    const simulator = new BrowserSimulator(makeSession())
    const state = simulator as unknown as InternalState
    const actions = simulator as unknown as InternalActions
    state.enemies = [
      createEnemy(1, state.playerX + 24, state.playerY + 16, 'chaser'),
      createEnemy(2, state.playerX - 56, state.playerY + 10, 'chaser'),
      createEnemy(3, state.playerX + 32, state.playerY + rulesetData.ruleset.sword_cleave_half_width + 12, 'charger'),
    ]

    actions.resolveAutoAttack()

    expect(state.kills).toBe(1)
    expect(state.goldEarned).toBe(1)
    expect(state.enemies.map((enemy: InternalEnemy) => enemy.id)).toEqual([2, 3])
  })
})

describe('BrowserSimulator hook spear sweep', () => {
  it('kills multiple enemies inside one forward spear lane', () => {
    // 场景：钩镰枪前向扇区命中多个目标，统计应与规则一致。
    const simulator = new BrowserSimulator(makeSession())
    const state = simulator as unknown as InternalState
    const actions = simulator as unknown as InternalActions
    state.activeWeapon = 'hook_spear'
    state.enemies = [
      createEnemy(1, state.playerX + 52, state.playerY - 10, 'chaser'),
      createEnemy(2, state.playerX + 96, state.playerY + 8, 'chaser'),
      createEnemy(3, state.playerX + 132, state.playerY + 4, 'charger'),
    ]

    actions.resolveAutoAttack()

    expect(state.kills).toBe(3)
    expect(state.goldEarned).toBe(4)
    expect(state.enemies).toHaveLength(0)
  })

  it('does not hit enemies behind or outside the spear lane width', () => {
    // 场景：钩镰枪只命中前方走廊内目标，背后/过宽目标应保留。
    const simulator = new BrowserSimulator(makeSession())
    const state = simulator as unknown as InternalState
    const actions = simulator as unknown as InternalActions
    state.activeWeapon = 'hook_spear'
    state.enemies = [
      createEnemy(1, state.playerX + 72, state.playerY + 16, 'chaser'),
      createEnemy(2, state.playerX - 108, state.playerY + 8, 'chaser'),
      createEnemy(3, state.playerX + 92, state.playerY + rulesetData.ruleset.hook_spear_sweep_half_width + 12, 'charger'),
    ]

    actions.resolveAutoAttack()

    expect(state.kills).toBe(1)
    expect(state.goldEarned).toBe(1)
    expect(state.enemies.map((enemy: InternalEnemy) => enemy.id)).toEqual([2, 3])
  })
})
