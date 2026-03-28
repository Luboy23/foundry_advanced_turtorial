import { describe, expect, it } from 'vitest'
import { getDifficultySnapshot } from '../../shared/game/difficulty'
import { buildBoulderMotionConfig, buildSpikeMotionConfig } from './hazardPhysics'

describe('hazard physics motion config', () => {
  it('spike config enforces vertical non-rotating fall', () => {
    // 前置：使用中后期难度快照，覆盖较高下落速度区间。
    const snapshot = getDifficultySnapshot(18)

    // 动作：重复采样配置，确保随机扰动不突破运动边界。
    for (let index = 0; index < 60; index += 1) {
      const config = buildSpikeMotionConfig(snapshot)

      // 断言：尖刺必须保持“垂直坠落 + 不旋转”的教学规则。
      expect(config.velocityX).toBe(0)
      expect(config.velocityY).toBeGreaterThanOrEqual(snapshot.fallSpeed * 0.58 + 18)
      expect(config.velocityY).toBeLessThanOrEqual(snapshot.fallSpeed * 0.58 + 76)
      expect(config.gravityY).toBeGreaterThan(600)
      expect(config.terminalVelocityY).toBeGreaterThan(config.velocityY + 120)
      expect(config.angle).toBe(0)
      expect(config.angularVelocity).toBe(0)
    }
  })

  it('boulder config enforces vertical fall with bounded motion values', () => {
    // 前置：同样难度下，验证巨石配置的速度/角速度包络。
    const snapshot = getDifficultySnapshot(18)

    // 动作：多轮采样，防止概率边缘值越界。
    for (let index = 0; index < 60; index += 1) {
      const config = buildBoulderMotionConfig(snapshot)

      // 断言：横向速度固定为 0，仅允许受限角速度旋转。
      expect(config.velocityX).toBe(0)
      expect(config.velocityY).toBeGreaterThanOrEqual(snapshot.fallSpeed * 0.52 - 8)
      expect(config.velocityY).toBeLessThanOrEqual(snapshot.fallSpeed * 0.52 + 48)
      expect(config.gravityY).toBeGreaterThan(560)
      expect(config.terminalVelocityY).toBeGreaterThan(config.velocityY + 120)
      expect(config.angularVelocity).toBeGreaterThanOrEqual(-55)
      expect(config.angularVelocity).toBeLessThanOrEqual(55)
    }
  })
})
