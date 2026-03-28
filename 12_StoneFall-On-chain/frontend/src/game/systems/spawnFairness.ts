/**
 * 模块职责：提供 game/systems/spawnFairness.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import { clamp } from '../../shared/utils/math'

type SpawnFairnessInput = {
  minX: number
  maxX: number
  playerX: number
  exclusionRadius: number
  maxAttempts?: number
  random?: () => number
}

const randomBetween = (min: number, max: number, random: () => number): number => {
  return Math.round(min + (max - min) * random())
}

/**
 * resolveFairSpawnX：根据输入条件解析目标结果。
 */
export const resolveFairSpawnX = ({
  minX,
  maxX,
  playerX,
  exclusionRadius,
  maxAttempts = 8,
  random = Math.random,
}: SpawnFairnessInput): number => {
  const clampedPlayerX = clamp(playerX, minX, maxX)
  const safeRadius = Math.max(0, exclusionRadius)

  let fallbackX = minX
  let bestDistance = -1

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = randomBetween(minX, maxX, random)
    const distance = Math.abs(candidate - clampedPlayerX)

    if (distance > bestDistance) {
      fallbackX = candidate
      bestDistance = distance
    }

    if (distance >= safeRadius) {
      return candidate
    }
  }

  if (bestDistance > 0) {
    return fallbackX
  }

  const leftEdge = clamp(clampedPlayerX - safeRadius, minX, maxX)
  const rightEdge = clamp(clampedPlayerX + safeRadius, minX, maxX)
  return Math.abs(rightEdge - clampedPlayerX) >= Math.abs(clampedPlayerX - leftEdge)
    ? rightEdge
    : leftEdge
}
