/**
 * 模块职责：提供 game/systems/spawnCadence.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import { clamp } from '../../shared/utils/math'

type RandomFn = () => number

const RATE_BOOST = 1.1
const BASE_RATE_MIN = 1000 / 520
const BASE_RATE_MAX = 1000 / 170
const GAP_JITTER_MIN = 0.82
const GAP_JITTER_MAX = 1.18
const DOUBLE_SPAWN_COOLDOWN_MS = 900
const DOUBLE_SPAWN_PROB_MIN = 0.06
const DOUBLE_SPAWN_PROB_MAX = 0.22

const randomRange = (min: number, max: number, random: RandomFn): number => {
  return min + (max - min) * random()
}

/**
 * getSpawnRatePerSec：读取并返回对应数据。
 */
export const getSpawnRatePerSec = (threatLevel: number): number => {
  const normalized = clamp((threatLevel - 1) / 9, 0, 1)
  const baseRate = BASE_RATE_MIN + (BASE_RATE_MAX - BASE_RATE_MIN) * normalized
  return baseRate * RATE_BOOST
}

/**
 * sampleNextSpawnGapMs：导出可复用能力。
 */
export const sampleNextSpawnGapMs = (
  ratePerSec: number,
  random: RandomFn = Math.random,
): number => {
  const safeRate = Math.max(0.1, ratePerSec)
  const baseGapMs = 1000 / safeRate
  const jitter = randomRange(GAP_JITTER_MIN, GAP_JITTER_MAX, random)
  return Math.round(clamp(baseGapMs * jitter, 120, 560))
}

/**
 * getMaxSpawnGapMs：读取并返回对应数据。
 */
export const getMaxSpawnGapMs = (threatLevel: number): number => {
  if (threatLevel < 4) {
    return 460
  }

  if (threatLevel < 8) {
    return 380
  }

  return 320
}

/**
 * resolveSpawnBurstCount：根据输入条件解析目标结果。
 */
export const resolveSpawnBurstCount = ({
  threatLevel,
  availableSlots,
  sinceLastDoubleMs,
  random = Math.random,
}: {
  threatLevel: number
  availableSlots: number
  sinceLastDoubleMs: number
  random?: RandomFn
}): 0 | 1 | 2 => {
  if (availableSlots <= 0) {
    return 0
  }

  if (availableSlots === 1) {
    return 1
  }

  if (threatLevel < 6 || sinceLastDoubleMs < DOUBLE_SPAWN_COOLDOWN_MS) {
    return 1
  }

  const normalized = clamp((threatLevel - 6) / 4, 0, 1)
  const doubleProb =
    DOUBLE_SPAWN_PROB_MIN +
    (DOUBLE_SPAWN_PROB_MAX - DOUBLE_SPAWN_PROB_MIN) * normalized

  return random() < doubleProb ? 2 : 1
}

