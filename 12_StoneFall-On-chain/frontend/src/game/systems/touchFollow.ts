/**
 * 模块职责：提供 game/systems/touchFollow.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import { clamp } from '../../shared/utils/math'

/**
 * resolveTouchFollowVelocity：根据输入条件解析目标结果。
 */
export const resolveTouchFollowVelocity = (params: {
  targetX: number
  playerX: number
  maxDeltaPx: number
  deadZonePx: number
  gain: number
  maxSpeed: number
}): number => {
  const deltaX = clamp(
    params.targetX - params.playerX,
    -params.maxDeltaPx,
    params.maxDeltaPx,
  )
  if (Math.abs(deltaX) <= params.deadZonePx) {
    return 0
  }
  return clamp(deltaX * params.gain, -params.maxSpeed, params.maxSpeed)
}

/**
 * resolveAxisFromVelocity：根据输入条件解析目标结果。
 */
export const resolveAxisFromVelocity = (velocityX: number): -1 | 0 | 1 => {
  if (velocityX < -1) {
    return -1
  }
  if (velocityX > 1) {
    return 1
  }
  return 0
}
