import { describe, expect, it } from 'vitest'
import { resolveFairSpawnX } from './spawnFairness'

/**
 * 固定序列随机源。
 * 用于精确复现“多次尝试后退化到兜底策略”的路径，避免 flaky。
 */
const sequenceRandom = (values: number[]) => {
  let index = 0
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0
    index += 1
    return value
  }
}

describe('resolveFairSpawnX', () => {
  it('prefers spawn points outside the exclusion radius', () => {
    // 场景：前两次样本仍靠近玩家，第三次命中安全区，函数应立即接受。
    const x = resolveFairSpawnX({
      minX: 0,
      maxX: 100,
      playerX: 50,
      exclusionRadius: 20,
      maxAttempts: 5,
      random: sequenceRandom([0.51, 0.53, 0.1]),
    })

    expect(x).toBe(10)
  })

  it('falls back to farthest sampled point when all attempts are inside radius', () => {
    // 场景：所有采样点都落在排除半径内，应选择“离玩家最远”的候选值。
    const x = resolveFairSpawnX({
      minX: 40,
      maxX: 60,
      playerX: 50,
      exclusionRadius: 18,
      maxAttempts: 4,
      random: sequenceRandom([0.5, 0.45, 0.55, 0.42]),
    })

    expect(x).toBe(48)
  })

  it('clamps to an edge when no valid sample exists', () => {
    // 场景：完全无采样机会（maxAttempts=0），应直接退化到边界点。
    const x = resolveFairSpawnX({
      minX: 40,
      maxX: 60,
      playerX: 50,
      exclusionRadius: 30,
      maxAttempts: 0,
    })

    expect([40, 60]).toContain(x)
  })
})
