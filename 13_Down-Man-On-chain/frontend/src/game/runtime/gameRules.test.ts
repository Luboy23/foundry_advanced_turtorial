import { describe, expect, it } from 'vitest'
import { getPlatformDifficultySnapshot } from '../../shared/game/difficulty'
import {
  MAX_FRAME_DELTA_MS,
  clampSimulationFrameDelta,
  resolveCameraScrollSpeed,
  resolvePlatformGap,
  resolvePlatformType,
  resolvePlatformWidth,
} from './gameRules'

describe('gameRules', () => {
  it('clamps frame delta spikes before simulation catch-up', () => {
    // 断言：帧间隔预处理需裁剪异常尖峰，防止 fixed-step 积压爆炸。
    expect(clampSimulationFrameDelta(-12)).toBe(0)
    expect(clampSimulationFrameDelta(16)).toBe(16)
    expect(clampSimulationFrameDelta(240)).toBe(MAX_FRAME_DELTA_MS)
  })

  it('derives camera speed and gap from the same difficulty snapshot', () => {
    // 场景：镜头速度与平台间距应同源于难度快照，保持节奏一致性。
    const easy = getPlatformDifficultySnapshot(0)
    const hard = getPlatformDifficultySnapshot(999)

    expect(resolveCameraScrollSpeed(easy)).toBe(95)
    expect(resolveCameraScrollSpeed(hard)).toBe(240)
    expect(resolvePlatformGap(easy)).toBe(230)
    expect(resolvePlatformGap(hard)).toBe(136)
  })

  it('resolves platform widths consistently by type', () => {
    // 场景：不同平台类型宽度存在稳定相对关系，且会随难度收缩。
    const easy = getPlatformDifficultySnapshot(0)
    const hard = getPlatformDifficultySnapshot(999)

    const easyStable = resolvePlatformWidth(easy, 'stable')
    const easyMoving = resolvePlatformWidth(easy, 'moving')
    const easyVanishing = resolvePlatformWidth(easy, 'vanishing')
    const hardStable = resolvePlatformWidth(hard, 'stable')

    expect(easyStable).toBeGreaterThan(hardStable)
    expect(easyMoving).toBeGreaterThanOrEqual(easyStable)
    expect(easyVanishing).toBeLessThan(easyStable)
  })

  it('uses difficulty ratios and moving-streak fallback when choosing types', () => {
    // 场景：类型选择同时受概率分布和“连续 moving 限制”约束。
    const snapshot = getPlatformDifficultySnapshot(0)

    expect(
      resolvePlatformType({
        difficultySnapshot: snapshot,
        lastSpawnedPlatformType: 'stable',
        roll: 0.2,
        blockedMovingFallbackRoll: 0.1,
      }),
    ).toBe('stable')

    expect(
      resolvePlatformType({
        difficultySnapshot: snapshot,
        lastSpawnedPlatformType: 'stable',
        roll: 0.7,
        blockedMovingFallbackRoll: 0.1,
      }),
    ).toBe('moving')

    expect(
      resolvePlatformType({
        difficultySnapshot: snapshot,
        lastSpawnedPlatformType: 'moving',
        roll: 0.7,
        blockedMovingFallbackRoll: 0.2,
      }),
    ).toBe('stable')

    expect(
      resolvePlatformType({
        difficultySnapshot: snapshot,
        lastSpawnedPlatformType: 'moving',
        roll: 0.7,
        blockedMovingFallbackRoll: 0.9,
      }),
    ).toBe('vanishing')
  })
})
