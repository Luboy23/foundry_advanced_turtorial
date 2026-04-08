/**
 * 难度曲线与快照生成。
 * 所有平台比例、滚屏速度、生成节奏和密度上限都从这里派生。
 */
import type { DifficultySnapshot, PlatformDifficultySnapshot } from '../../game/types'
import { clamp } from '../utils/math'

// 威胁等级分三段抬升：前期给学习空间，中后期逐渐逼近上限。
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

export const resolveHazardRatio = (elapsedSec: number) => {
  const spikeRatio = clamp(0.82 - elapsedSec * 0.012, 0.35, 0.82)
  const boulderRatio = 1 - spikeRatio

  return {
    spikeRatio: Number(spikeRatio.toFixed(2)),
    boulderRatio: Number(boulderRatio.toFixed(2)),
  }
}

// 这里生成的是“平台系统快照”，滚屏速度、密度上限和平台占比都由它统一派生。
export const getPlatformDifficultySnapshot = (
  elapsedSec: number,
): PlatformDifficultySnapshot => {
  const t = Math.max(0, elapsedSec)
  const threatLevel = getThreatLevel(t)
  const normalizedThreat = clamp((threatLevel - 1) / 9, 0, 1)
  const stablePlatformRatio = clamp(0.62 - normalizedThreat * 0.22, 0.4, 0.62)
  const movingPlatformRatio = clamp(0.2 + normalizedThreat * 0.1, 0.2, 0.3)
  const vanishingPlatformRatio = Number(
    Math.max(0, 1 - stablePlatformRatio - movingPlatformRatio).toFixed(2),
  )
  const spawnCadenceMs = Math.round(clamp(520 - normalizedThreat * 350, 170, 520))
  const cameraScrollSpeed = Math.round(clamp(95 + normalizedThreat * 145, 95, 240))
  const platformDensityCap = Math.round(clamp(6 + normalizedThreat * 16, 6, 22))

  return {
    elapsedSec: Number(t.toFixed(2)),
    threatLevel: Number(threatLevel.toFixed(2)),
    spawnCadenceMs,
    cameraScrollSpeed,
    platformDensityCap,
    stablePlatformRatio: Number(stablePlatformRatio.toFixed(2)),
    movingPlatformRatio: Number(movingPlatformRatio.toFixed(2)),
    vanishingPlatformRatio,
  }
}

// 对外仍暴露 DifficultySnapshot，专门把旧字段映射到新平台难度快照上。
export const toDifficultySnapshot = (
  platformDifficulty: PlatformDifficultySnapshot,
): DifficultySnapshot => {
  const hazardRatio = resolveHazardRatio(platformDifficulty.elapsedSec)
  return {
    ...platformDifficulty,
    // 兼容旧 UI / 测试仍在读取的历史字段。
    spawnIntervalMs: platformDifficulty.spawnCadenceMs,
    fallSpeed: platformDifficulty.cameraScrollSpeed,
    activeCap: platformDifficulty.platformDensityCap,
    spikeRatio: hazardRatio.spikeRatio,
    boulderRatio: hazardRatio.boulderRatio,
  }
}

// 页面层拿到的仍是兼容版快照，但底层规则来源已经统一到 platformDifficulty。
export const getDifficultySnapshot = (elapsedSec: number): DifficultySnapshot =>
  toDifficultySnapshot(getPlatformDifficultySnapshot(elapsedSec))
