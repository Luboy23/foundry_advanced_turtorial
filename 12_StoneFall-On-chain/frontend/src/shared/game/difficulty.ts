/**
 * 模块职责：提供 shared/game/difficulty.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import type { DifficultySnapshot, HazardType } from '../../game/types'
import { clamp } from '../utils/math'

/**
 * getThreatLevel：读取并返回对应数据。
 */
export const getThreatLevel = (elapsedSec: number): number => {
  const t = Math.max(0, elapsedSec)

  if (t <= 10) {
    return 1 + (t / 10) * 3
  }

  if (t <= 25) {
    return 4 + ((t - 10) / 15) * 4
  }

  if (t <= 40) {
    return 8 + ((t - 25) / 15) * 2
  }

  return 10
}

/**
 * resolveHazardRatio：根据输入条件解析目标结果。
 */
export const resolveHazardRatio = (elapsedSec: number) => {
  const spikeRatio = clamp(0.82 - elapsedSec * 0.012, 0.35, 0.82)
  const boulderRatio = 1 - spikeRatio

  return {
    spikeRatio: Number(spikeRatio.toFixed(2)),
    boulderRatio: Number(boulderRatio.toFixed(2)),
  }
}

/**
 * resolveHazardType：根据输入条件解析目标结果。
 */
export const resolveHazardType = (
  spikeRatio: number,
  randomValue = Math.random(),
): HazardType => {
  return randomValue < spikeRatio ? 'spike' : 'boulder'
}

/**
 * resolveSpawnCount：根据输入条件解析目标结果。
 */
export const resolveSpawnCount = (
  threatLevel: number,
  randomValue = Math.random(),
): 1 | 2 | 3 => {
  const normalized = clamp((threatLevel - 1) / 9, 0, 1)
  const tripleProb = clamp((normalized - 0.28) * 0.58, 0, 0.42)
  const doubleProb = clamp(0.2 + normalized * 0.33, 0.2, 0.53)

  if (randomValue < tripleProb) {
    return 3
  }

  if (randomValue < tripleProb + doubleProb) {
    return 2
  }

  return 1
}

/**
 * getDifficultySnapshot：读取并返回对应数据。
 */
export const getDifficultySnapshot = (elapsedSec: number): DifficultySnapshot => {
  const t = Math.max(0, elapsedSec)
  const threatLevel = getThreatLevel(t)
  const normalizedThreat = clamp((threatLevel - 1) / 9, 0, 1)
  const hazardRatio = resolveHazardRatio(t)

  return {
    elapsedSec: Number(t.toFixed(2)),
    threatLevel: Number(threatLevel.toFixed(2)),
    spawnIntervalMs: Math.round(clamp(520 - normalizedThreat * 350, 170, 520)),
    fallSpeed: Math.round(clamp(260 + normalizedThreat * 440, 260, 700)),
    activeCap: Math.round(clamp(6 + normalizedThreat * 16, 6, 22)),
    spikeRatio: hazardRatio.spikeRatio,
    boulderRatio: hazardRatio.boulderRatio,
  }
}
