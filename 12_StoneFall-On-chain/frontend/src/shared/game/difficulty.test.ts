import { describe, expect, it } from 'vitest'
import {
  getDifficultySnapshot,
  getThreatLevel,
  resolveHazardRatio,
  resolveHazardType,
  resolveSpawnCount,
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
    // 场景：开局时刻应命中初始参数，不受后期钳制影响。
    const snapshot = getDifficultySnapshot(0)

    expect(snapshot.spawnIntervalMs).toBe(520)
    expect(snapshot.fallSpeed).toBe(260)
    expect(snapshot.activeCap).toBe(6)
    expect(snapshot.threatLevel).toBe(1)
    expect(snapshot.spikeRatio).toBe(0.82)
    expect(snapshot.boulderRatio).toBe(0.18)
  })

  it('clamps values for long sessions', () => {
    // 场景：超长存活后应命中上/下限，避免无界增长。
    const snapshot = getDifficultySnapshot(999)

    expect(snapshot.spawnIntervalMs).toBe(170)
    expect(snapshot.fallSpeed).toBe(700)
    expect(snapshot.activeCap).toBe(22)
    expect(snapshot.threatLevel).toBe(10)
    expect(snapshot.spikeRatio).toBe(0.35)
    expect(snapshot.boulderRatio).toBe(0.65)
  })
})

describe('resolveHazardRatio', () => {
  it('matches expected ratios at key moments', () => {
    // 断言：尖刺/巨石比例在关键时间点满足设计曲线。
    expect(resolveHazardRatio(0)).toEqual({ spikeRatio: 0.82, boulderRatio: 0.18 })
    expect(resolveHazardRatio(20)).toEqual({ spikeRatio: 0.58, boulderRatio: 0.42 })
    expect(resolveHazardRatio(40)).toEqual({ spikeRatio: 0.35, boulderRatio: 0.65 })
    expect(resolveHazardRatio(60)).toEqual({ spikeRatio: 0.35, boulderRatio: 0.65 })
  })
})

describe('resolveSpawnCount', () => {
  it('biases toward single spawn at low threat', () => {
    // 场景：低威胁时多数为单刷，少量随机值可触发双刷。
    expect(resolveSpawnCount(1, 0.01)).toBe(2)
    expect(resolveSpawnCount(1, 0.9)).toBe(1)
  })

  it('supports triple spawn at high threat', () => {
    // 场景：高威胁允许三刷分支，用于后期压强提升。
    expect(resolveSpawnCount(10, 0.1)).toBe(3)
    expect(resolveSpawnCount(10, 0.5)).toBe(2)
    expect(resolveSpawnCount(10, 0.95)).toBe(1)
  })
})

describe('resolveHazardType', () => {
  it('uses spike ratio as threshold', () => {
    // 断言：随机值与 spikeRatio 比较后正确映射障碍类型。
    expect(resolveHazardType(0.6, 0.4)).toBe('spike')
    expect(resolveHazardType(0.6, 0.9)).toBe('boulder')
  })
})
