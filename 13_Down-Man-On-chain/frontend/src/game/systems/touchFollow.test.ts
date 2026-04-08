import { describe, expect, it } from 'vitest'
import {
  resolveAxisFromVelocity,
  resolveTouchFollowVelocity,
} from './touchFollow'

describe('resolveTouchFollowVelocity', () => {
  it('returns 0 in dead zone', () => {
    // 场景：目标点和玩家几乎重合，触控跟随应输出 0 以抑制抖动。
    expect(resolveTouchFollowVelocity({
      targetX: 505,
      playerX: 500,
      maxDeltaPx: 460,
      deadZonePx: 10,
      gain: 2.4,
      maxSpeed: 620,
    })).toBe(0)
  })

  it('returns signed velocity outside dead zone and clamps max speed', () => {
    // 场景：目标在右侧远点，速度应为正值且按增益计算。
    expect(resolveTouchFollowVelocity({
      targetX: 800,
      playerX: 500,
      maxDeltaPx: 460,
      deadZonePx: 10,
      gain: 2.4,
      maxSpeed: 620,
    })).toBeGreaterThan(0)

    // 场景：目标超远左侧，在高增益下也必须受 maxSpeed 钳制。
    expect(resolveTouchFollowVelocity({
      targetX: -2000,
      playerX: 500,
      maxDeltaPx: 460,
      deadZonePx: 10,
      gain: 5,
      maxSpeed: 620,
    })).toBe(-620)
  })
})

describe('resolveAxisFromVelocity', () => {
  it('maps velocity to -1/0/1 axis', () => {
    // 断言：速度符号与阈值映射为离散轴，用于统一输入层状态机。
    expect(resolveAxisFromVelocity(-12)).toBe(-1)
    expect(resolveAxisFromVelocity(0.5)).toBe(0)
    expect(resolveAxisFromVelocity(20)).toBe(1)
  })
})
