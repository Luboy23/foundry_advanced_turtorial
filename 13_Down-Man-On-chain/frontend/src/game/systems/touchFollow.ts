/**
 * 触控跟随系统。
 * 把触控条上的目标位置转换为横向速度，再映射回展示朝向。
 */
import { clamp } from '../../shared/utils/math'

// 跟随模式把“目标点距离”转换成速度，既保留惯性感又避免瞬移。
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

// 展示层只需要离散朝向，因此这里把连续速度压回 -1/0/1。
export const resolveAxisFromVelocity = (velocityX: number): -1 | 0 | 1 => {
  if (velocityX < -1) {
    return -1
  }
  if (velocityX > 1) {
    return 1
  }
  return 0
}
