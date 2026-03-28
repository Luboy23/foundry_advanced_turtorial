/**
 * 模块职责：提供 shared/game/hazardBounds.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

export type HazardExitReason = 'bottom' | 'side' | 'none'

type HazardBoundsConfig = {
  bottomLimit: number
  leftLimit: number
  rightLimit: number
}

const defaultConfig: HazardBoundsConfig = {
  bottomLimit: 760,
  leftLimit: -120,
  rightLimit: 1400,
}

/**
 * resolveHazardExitReason：根据输入条件解析目标结果。
 */
export const resolveHazardExitReason = (
  x: number,
  y: number,
  displayWidth: number,
  displayHeight: number,
  config: HazardBoundsConfig = defaultConfig,
): HazardExitReason => {
  const halfWidth = displayWidth * 0.5
  const halfHeight = displayHeight * 0.5

  if (y - halfHeight > config.bottomLimit) {
    return 'bottom'
  }

  if (x + halfWidth < config.leftLimit || x - halfWidth > config.rightLimit) {
    return 'side'
  }

  return 'none'
}
