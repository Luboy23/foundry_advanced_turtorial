/**
 * 固定步长模拟的核心规则常量与难度映射。
 * GameScene 通过这些纯函数把难度快照转成滚屏速度、平台间距和平台尺寸。
 */
import { clamp } from '../../shared/utils/math'
import type { PlatformDifficultySnapshot } from '../types'
import type { PlatformRuntimeType } from './platformRuntime'

export const FIXED_SIMULATION_STEP_MS = 1000 / 60
export const MAX_FRAME_DELTA_MS = 96
export const MAX_SIMULATION_CATCH_UP_MS = FIXED_SIMULATION_STEP_MS * 6
export const MAX_PLATFORM_SPAWNS_PER_STEP = 1
export const CAMERA_SCROLL_BASE_SPEED = 95
export const CAMERA_SCROLL_MAX_SPEED = 240

// 平台宽度和垂直间距都由难度快照驱动，保证配置与运行时只有一份规则来源。
const PLATFORM_MIN_GAP = 136
const PLATFORM_MAX_GAP = 230
const PLATFORM_MAX_WIDTH = 220
const PLATFORM_MIN_WIDTH = 120
const MOVING_PLATFORM_WIDTH_MULTIPLIER = 1.12
const MOVING_PLATFORM_MAX_WIDTH = 272

// 单帧 delta 会先被裁剪，避免浏览器切后台后一次性灌入过大的模拟步数。
export const clampSimulationFrameDelta = (deltaMs: number): number =>
  clamp(deltaMs, 0, MAX_FRAME_DELTA_MS)

// 滚屏速度最终仍做一次安全夹取，防止错误快照把镜头速度推到异常值。
export const resolveCameraScrollSpeed = (
  difficultySnapshot: PlatformDifficultySnapshot,
): number =>
  clamp(
    difficultySnapshot.cameraScrollSpeed,
    CAMERA_SCROLL_BASE_SPEED,
    CAMERA_SCROLL_MAX_SPEED,
  )

// 平台行距通过 spawn cadence 反推，保证生成节奏与视觉密度来自同一份快照。
export const resolvePlatformGap = (
  difficultySnapshot: PlatformDifficultySnapshot,
): number => {
  const cadenceRatio = clamp(
    (difficultySnapshot.spawnCadenceMs - 170) / (520 - 170),
    0,
    1,
  )
  const targetGap =
    PLATFORM_MIN_GAP + cadenceRatio * (PLATFORM_MAX_GAP - PLATFORM_MIN_GAP)
  return Math.round(targetGap)
}

// 不同平台类型共用一套基础宽度，再针对移动/消失平台做轻量修正。
export const resolvePlatformWidth = (
  difficultySnapshot: PlatformDifficultySnapshot,
  type: PlatformRuntimeType,
): number => {
  const normalized = clamp((difficultySnapshot.threatLevel - 1) / 9, 0, 1)
  const baseWidth =
    PLATFORM_MAX_WIDTH - normalized * (PLATFORM_MAX_WIDTH - PLATFORM_MIN_WIDTH)
  if (type === 'vanishing') {
    return Math.round(baseWidth * 0.88)
  }
  if (type === 'moving') {
    return Math.round(
      clamp(
        baseWidth * MOVING_PLATFORM_WIDTH_MULTIPLIER,
        PLATFORM_MIN_WIDTH,
        MOVING_PLATFORM_MAX_WIDTH,
      ),
    )
  }
  return Math.round(baseWidth)
}

// 平台类型选择完全由难度快照驱动，同时阻止 moving 连续刷屏。
export const resolvePlatformType = (params: {
  difficultySnapshot: PlatformDifficultySnapshot
  lastSpawnedPlatformType: PlatformRuntimeType
  roll: number
  blockedMovingFallbackRoll: number
}): PlatformRuntimeType => {
  const stableRatio = params.difficultySnapshot.stablePlatformRatio
  const movingRatio = params.difficultySnapshot.movingPlatformRatio
  const vanishingRatio = params.difficultySnapshot.vanishingPlatformRatio
  const blockedMovingStreak = params.lastSpawnedPlatformType === 'moving'

  if (params.roll < stableRatio) {
    return 'stable'
  }
  if (params.roll < stableRatio + movingRatio && !blockedMovingStreak) {
    return 'moving'
  }
  if (params.roll < stableRatio + movingRatio && blockedMovingStreak) {
    return params.blockedMovingFallbackRoll < 0.75 ? 'stable' : 'vanishing'
  }
  if (params.roll < stableRatio + movingRatio + vanishingRatio) {
    return 'vanishing'
  }
  return 'stable'
}
