import { describe, expect, it } from 'vitest'
import {
  chooseLane,
  createSpawnDistributionState,
  laneToSpawnX,
  resetSpawnDistributionState,
} from './spawnDistribution'

/**
 * 生成确定性随机源，保障分布类统计测试可复现。
 */
const createSeededRandom = (seed: number): (() => number) => {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0x1_0000_0000
  }
}

describe('spawnDistribution', () => {
  it('covers multiple lanes under sustained spawning', () => {
    // 场景：持续刷怪时应覆盖足够多的 lane，避免玩法单调。
    const state = createSpawnDistributionState(9)
    const random = createSeededRandom(99)
    const lanes = new Set<number>()

    for (let index = 0; index < 200; index += 1) {
      const lane = chooseLane({
        state,
        nowMs: index * 180,
        minX: 42,
        maxX: 1238,
        playerX: 640,
        safeRadius: 130,
        threatLevel: 5,
        random,
      })
      lanes.add(lane)
    }

    // 断言：至少覆盖 6 条 lane，确保分布具有离散性。
    expect(lanes.size).toBeGreaterThanOrEqual(6)
  })

  it('controls same-lane streak length and balances left/right usage', () => {
    // 场景：验证局部公平性，既不能长时间同 lane，也不能长期偏向一侧。
    const state = createSpawnDistributionState(9)
    const random = createSeededRandom(2026)
    let lastLane = -1
    let streak = 0
    let maxStreak = 0
    let left = 0
    let right = 0

    for (let index = 0; index < 180; index += 1) {
      const lane = chooseLane({
        state,
        nowMs: index * 160,
        minX: 42,
        maxX: 1238,
        playerX: 640,
        safeRadius: 120,
        threatLevel: 6.2,
        random,
      })

      if (lane < 4) {
        left += 1
      } else if (lane > 4) {
        right += 1
      }

      if (lane === lastLane) {
        streak += 1
      } else {
        streak = 1
        lastLane = lane
      }

      maxStreak = Math.max(maxStreak, streak)
    }

    // 断言 A：同 lane 连续次数有上限。
    expect(maxStreak).toBeLessThanOrEqual(3)
    // 断言 B：左右两侧使用量差异受控。
    expect(Math.abs(left - right)).toBeLessThanOrEqual(4)
  })

  it('keeps near-player lane de-prioritized but prevents long starvation', () => {
    // 场景：靠近玩家 lane 应降权，但不能被长期饿死（仍需定期出现）。
    const state = createSpawnDistributionState(9)
    const random = createSeededRandom(8080)
    let centerLaneCount = 0
    let lastCenterAt = -1
    let maxCenterGapMs = 0

    for (let index = 0; index < 140; index += 1) {
      const nowMs = index * 150
      const lane = chooseLane({
        state,
        nowMs,
        minX: 42,
        maxX: 1238,
        playerX: 640,
        safeRadius: 210,
        threatLevel: 3.5,
        random,
      })
      if (lane === 4) {
        centerLaneCount += 1
        if (lastCenterAt >= 0) {
          maxCenterGapMs = Math.max(maxCenterGapMs, nowMs - lastCenterAt)
        }
        lastCenterAt = nowMs
      }
    }

    // 断言：中心 lane 既不会过热，也不会过冷。
    expect(centerLaneCount).toBeGreaterThanOrEqual(8)
    expect(centerLaneCount).toBeLessThanOrEqual(34)
    expect(maxCenterGapMs).toBeLessThanOrEqual(4200)
  })

  it('converts lane selection to bounded spawn x with jitter', () => {
    // 场景：lane -> x 转换应保留随机抖动，同时严格受边界约束。
    const random = createSeededRandom(7)
    const samples: number[] = []

    for (let index = 0; index < 60; index += 1) {
      samples.push(
        laneToSpawnX({
          laneIndex: 2,
          minX: 42,
          maxX: 1238,
          laneCount: 9,
          random,
        }),
      )
    }

    // 断言：所有采样点均在合法生成区间。
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(42)
    expect(Math.max(...samples)).toBeLessThanOrEqual(1238)

    // 校验 reset 接口可被调用（覆盖可回收状态分支）。
    resetSpawnDistributionState(createSpawnDistributionState(9))
  })
})
