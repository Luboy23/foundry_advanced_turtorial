import { describe, expect, it } from 'vitest'
import {
  getDifficultySnapshot,
  getThreatLevel,
  resolveHazardRatio,
} from './difficulty'

describe('getThreatLevel', () => {
  it('matches piecewise boundaries', () => {
    // 断言：威胁等级分段函数在关键边界点返回预期值。
    expect(getThreatLevel(0)).toBe(1)
    expect(getThreatLevel(10)).toBe(4)
    expect(getThreatLevel(25)).toBe(8)
    expect(getThreatLevel(40)).toBe(10)
    expect(getThreatLevel(99)).toBe(10)
  })
})

describe('getDifficultySnapshot', () => {
  it('returns bounded values at t=0', () => {
    // 场景：开局快照应匹配初始参数，不受后期钳制影响。
    const snapshot = getDifficultySnapshot(0)

    expect(snapshot.spawnIntervalMs).toBe(520)
    expect(snapshot.fallSpeed).toBe(95)
    expect(snapshot.activeCap).toBe(6)
    expect(snapshot.threatLevel).toBe(1)
    expect(snapshot.spikeRatio).toBe(0.82)
    expect(snapshot.boulderRatio).toBe(0.18)
  })

  it('clamps values for long sessions', () => {
    // 场景：超长会话后参数应命中上/下界，避免无界增长。
    const snapshot = getDifficultySnapshot(999)

    expect(snapshot.spawnIntervalMs).toBe(170)
    expect(snapshot.fallSpeed).toBe(240)
    expect(snapshot.activeCap).toBe(22)
    expect(snapshot.threatLevel).toBe(10)
    expect(snapshot.spikeRatio).toBe(0.35)
    expect(snapshot.boulderRatio).toBe(0.65)
  })
})

describe('resolveHazardRatio', () => {
  it('matches expected ratios at key moments', () => {
    // 断言：障碍物比例曲线在关键时间点符合设计预期。
    expect(resolveHazardRatio(0)).toEqual({ spikeRatio: 0.82, boulderRatio: 0.18 })
    expect(resolveHazardRatio(20)).toEqual({ spikeRatio: 0.58, boulderRatio: 0.42 })
    expect(resolveHazardRatio(40)).toEqual({ spikeRatio: 0.35, boulderRatio: 0.65 })
    expect(resolveHazardRatio(60)).toEqual({ spikeRatio: 0.35, boulderRatio: 0.65 })
  })
})
