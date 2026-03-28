import { describe, expect, it } from 'vitest'
import {
  createSpawnDirectorState,
  drawHazardType,
  drawWaveSpawnCount,
  resetSpawnDirectorState,
} from './spawnDirector'

/**
 * 构造确定性随机源，避免测试依赖运行时随机性而产生抖动。
 * 这里使用轻量 LCG，仅用于测试采样稳定，不参与业务逻辑。
 */
const createSeededRandom = (seed: number): (() => number) => {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0x1_0000_0000
  }
}

describe('spawnDirector wave pacing', () => {
  it('keeps low-threat waves stable without triple bursts', () => {
    // 前置：低威胁等级，验证刷怪导演不会突然进入三连爆发。
    const random = createSeededRandom(42)
    const state = createSpawnDirectorState()
    const samples: number[] = []

    // 动作：连续抽样多个波次，观察平均强度与上界。
    for (let index = 0; index < 120; index += 1) {
      samples.push(
        drawWaveSpawnCount({
          state,
          threatLevel: 2.5,
          availableSlots: 99,
          random,
        }),
      )
    }

    // 断言：低压阶段上限保持在 2，并维持稳定平均值区间。
    const average = samples.reduce((sum, value) => sum + value, 0) / samples.length
    expect(Math.max(...samples)).toBeLessThanOrEqual(2)
    expect(average).toBeGreaterThan(1.1)
    expect(average).toBeLessThan(1.35)
  })

  it('supports high-threat pressure while capping per-wave bursts', () => {
    // 前置：高威胁等级，验证可提升产量但仍受每波上限保护。
    const random = createSeededRandom(77)
    const state = createSpawnDirectorState()
    const samples: number[] = []

    // 动作：在高压区间持续采样，统计每波数量与平均值。
    for (let index = 0; index < 140; index += 1) {
      samples.push(
        drawWaveSpawnCount({
          state,
          threatLevel: 9.2,
          availableSlots: 99,
          random,
        }),
      )
    }

    // 断言：允许更高均值，但爆发仍不超过三连。
    const average = samples.reduce((sum, value) => sum + value, 0) / samples.length
    expect(Math.max(...samples)).toBeLessThanOrEqual(3)
    expect(average).toBeGreaterThan(2.05)
    expect(average).toBeLessThan(2.4)
  })

  it('limits short-window volatility under low threat', () => {
    // 前置：低威胁长序列，检查短窗口内的波动是否被平滑。
    const random = createSeededRandom(2026)
    const state = createSpawnDirectorState()
    const samples: number[] = []

    for (let index = 0; index < 90; index += 1) {
      samples.push(
        drawWaveSpawnCount({
          state,
          threatLevel: 2.2,
          availableSlots: 99,
          random,
        }),
      )
    }

    // 动作：按固定窗口聚合，计算窗口和的极差作为波动指标。
    const windowSize = 10
    const sums: number[] = []
    for (let start = 0; start <= samples.length - windowSize; start += 1) {
      const sum = samples
        .slice(start, start + windowSize)
        .reduce((acc, value) => acc + value, 0)
      sums.push(sum)
    }

    // 断言：极差受控，防止局部时间窗出现过高抖动。
    const volatility = Math.max(...sums) - Math.min(...sums)
    expect(volatility).toBeLessThanOrEqual(4)
  })

  it('uses bounded carry-over when capacity blocks spawning', () => {
    // 前置：连续无可用槽位，验证 carry-over 累积与恢复时的上界保护。
    const random = createSeededRandom(19)
    const state = createSpawnDirectorState()

    // 动作：多次在 capacity=0 下抽样，应全部返回 0。
    for (let index = 0; index < 8; index += 1) {
      expect(
        drawWaveSpawnCount({
          state,
          threatLevel: 8.8,
          availableSlots: 0,
          random,
        }),
      ).toBe(0)
    }

    // 动作：恢复可用槽位后再次抽样，观察恢复波是否受上限约束。
    const recovered = drawWaveSpawnCount({
      state,
      threatLevel: 8.8,
      availableSlots: 9,
      random,
    })
    // 断言：恢复后有产出，但依然维持导演上限边界。
    expect(recovered).toBeLessThanOrEqual(3)
    expect(recovered).toBeGreaterThanOrEqual(1)

    // 动作 + 断言：reset 应清空 carry-over，避免跨局污染。
    resetSpawnDirectorState(state)
    expect(state.carryOver).toBe(0)
  })
})

describe('spawnDirector type balancing', () => {
  it('keeps local spike/boulder mix near target and prevents long streaks', () => {
    // 前置：指定 spikeRatio=0.62，验证类型分布与连击约束是否同时成立。
    const random = createSeededRandom(1234)
    const state = createSpawnDirectorState()
    let spikes = 0
    let maxStreak = 0
    let streak = 0
    let last: 'spike' | 'boulder' | null = null

    for (let index = 0; index < 160; index += 1) {
      const type = drawHazardType({
        state,
        spikeRatio: 0.62,
        random,
      })

      if (type === 'spike') {
        spikes += 1
      }

      if (type === last) {
        streak += 1
      } else {
        streak = 1
        last = type
      }

      maxStreak = Math.max(maxStreak, streak)
    }

    // 断言：总体比例接近目标，且不会出现过长同类连续串。
    const spikeRatio = spikes / 160
    expect(spikeRatio).toBeGreaterThan(0.54)
    expect(spikeRatio).toBeLessThan(0.69)
    expect(maxStreak).toBeLessThanOrEqual(3)
  })
})
