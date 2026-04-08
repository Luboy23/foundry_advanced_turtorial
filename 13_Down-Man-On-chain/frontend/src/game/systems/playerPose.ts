/**
 * 玩家姿态决策。
 * 根据 grounded、速度和落地锁定窗口决定 idle / run / fall / land 的切换。
 */
import type { PlayerPose } from '../types'

export type PlayerPoseDecisionInput = {
  currentPose: PlayerPose
  grounded: boolean
  velocityY: number
  horizontalSpeedAbs: number
  nowMs: number
  wasGroundedLastFrame: boolean
  landingAnimUntil: number
  landingCooldownUntil: number
  fallTriggerVelocityY: number
  stationaryVelocityEpsilon: number
}

export type PlayerPoseDecision = {
  shouldTriggerLanding: boolean
  landingLocked: boolean
  nextPose: PlayerPose
}

// 落地姿态会被短暂锁定，防止 grounded 抖动时 land 动画瞬间被 idle/run 打断。
export const resolvePlayerPoseDecision = (
  input: PlayerPoseDecisionInput,
): PlayerPoseDecision => {
  const shouldTriggerLanding =
    !input.wasGroundedLastFrame &&
    input.grounded &&
    input.nowMs >= input.landingCooldownUntil

  const landingLocked =
    input.currentPose === 'land' &&
    input.nowMs < input.landingAnimUntil

  if (landingLocked) {
    return {
      shouldTriggerLanding,
      landingLocked,
      nextPose: 'land',
    }
  }

  if (!input.grounded && input.velocityY > input.fallTriggerVelocityY) {
    return {
      shouldTriggerLanding,
      landingLocked: false,
      nextPose: 'fall',
    }
  }

  if (input.grounded) {
    return {
      shouldTriggerLanding,
      landingLocked: false,
      nextPose:
        input.horizontalSpeedAbs <= input.stationaryVelocityEpsilon
          ? 'idle'
          : 'run',
    }
  }

  return {
    shouldTriggerLanding,
    landingLocked: false,
    nextPose: input.currentPose,
  }
}
