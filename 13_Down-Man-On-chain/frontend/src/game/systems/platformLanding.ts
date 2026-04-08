/**
 * 顶部落台基础判定。
 * 只回答“当前碰撞是否像是从上方踩到平台”，不处理 sweep 或地面支撑恢复。
 */
export type PlatformLandingCheckInput = {
  playerBottom: number
  playerPrevBottom: number
  platformTop: number
  velocityY: number
  topTolerancePx?: number
  maxPenetrationPx?: number
}

const DEFAULT_TOP_TOLERANCE_PX = 14
const DEFAULT_MAX_PENETRATION_PX = 42
const UPWARD_REJECT_VELOCITY_Y = -8

// 这个函数刻意保持简单：只回答“像不像从上方踩到”，不处理 sweep 和恢复链路。
export const isTopLandingContact = (input: PlatformLandingCheckInput): boolean => {
  if (
    !Number.isFinite(input.playerBottom) ||
    !Number.isFinite(input.playerPrevBottom) ||
    !Number.isFinite(input.platformTop) ||
    !Number.isFinite(input.velocityY)
  ) {
    return false
  }

  if (input.velocityY < UPWARD_REJECT_VELOCITY_Y) {
    return false
  }

  const topTolerancePx = input.topTolerancePx ?? DEFAULT_TOP_TOLERANCE_PX
  const maxPenetrationPx = input.maxPenetrationPx ?? DEFAULT_MAX_PENETRATION_PX
  const enteredFromAbove = input.playerPrevBottom <= input.platformTop + topTolerancePx
  const notTooDeep = input.playerBottom <= input.platformTop + maxPenetrationPx

  return enteredFromAbove && notTooDeep
}
