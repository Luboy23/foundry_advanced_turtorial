import { describe, expect, it } from 'vitest'
import {
  getMaxSpawnGapMs,
  getSpawnRatePerSec,
  resolveSpawnBurstCount,
  sampleNextSpawnGapMs,
} from './spawnCadence'

describe('spawnCadence', () => {
  it('increases spawn rate with threat level', () => {
    // 场景：威胁等级递增时，期望每秒刷怪率单调上升。
    const low = getSpawnRatePerSec(1)
    const mid = getSpawnRatePerSec(5)
    const high = getSpawnRatePerSec(10)

    expect(low).toBeLessThan(mid)
    expect(mid).toBeLessThan(high)
  })

  it('samples spawn gap with bounded jitter', () => {
    // 前置：基于中高威胁速率计算理论基础间隔。
    const rate = getSpawnRatePerSec(6)
    const baseGap = 1000 / rate

    // 动作：分别注入随机最小值/最大值，覆盖 jitter 两端。
    const minGap = sampleNextSpawnGapMs(rate, () => 0)
    const maxGap = sampleNextSpawnGapMs(rate, () => 1)

    // 断言：随机抖动范围与全局硬边界同时成立。
    expect(minGap).toBeGreaterThanOrEqual(Math.floor(baseGap * 0.82) - 1)
    expect(maxGap).toBeLessThanOrEqual(Math.ceil(baseGap * 1.18) + 1)
    expect(minGap).toBeGreaterThanOrEqual(120)
    expect(maxGap).toBeLessThanOrEqual(560)
  })

  it('keeps single spawn below threat threshold or cooldown window', () => {
    // 场景 A：威胁不足阈值时，必须保持单次刷怪。
    expect(
      resolveSpawnBurstCount({
        threatLevel: 5.9,
        availableSlots: 2,
        sinceLastDoubleMs: 5000,
      }),
    ).toBe(1)

    // 场景 B：威胁已高但冷却未满足，也必须维持单次刷怪。
    expect(
      resolveSpawnBurstCount({
        threatLevel: 8.5,
        availableSlots: 2,
        sinceLastDoubleMs: 500,
        random: () => 0,
      }),
    ).toBe(1)
  })

  it('allows occasional double spawn at high threat with cooldown satisfied', () => {
    // 场景 A：高威胁 + 冷却满足 + 可用槽位足够，允许触发双刷。
    expect(
      resolveSpawnBurstCount({
        threatLevel: 9.8,
        availableSlots: 2,
        sinceLastDoubleMs: 1200,
        random: () => 0,
      }),
    ).toBe(2)

    // 场景 B：即使命中双刷概率，槽位不足也必须降级为单刷。
    expect(
      resolveSpawnBurstCount({
        threatLevel: 9.8,
        availableSlots: 1,
        sinceLastDoubleMs: 1200,
        random: () => 0,
      }),
    ).toBe(1)
  })

  it('uses hard max-gap tiers for starvation protection', () => {
    // 断言：不同威胁分段采用不同“最大断粮间隔”，避免长时间不刷怪。
    expect(getMaxSpawnGapMs(2)).toBe(460)
    expect(getMaxSpawnGapMs(6.5)).toBe(380)
    expect(getMaxSpawnGapMs(9.5)).toBe(320)
  })
})
