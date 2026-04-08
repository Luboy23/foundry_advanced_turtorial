import { describe, expect, it } from 'vitest'
import { resolvePlayerPoseDecision } from './playerPose'
import type { PlayerPose } from '../types'

// 与运行时常量保持一致：用于验证落地/静止分支触发边界。
const FALL_THRESHOLD = 120
const STATIONARY_EPSILON = 18

/**
 * 构造默认决策输入，调用方只覆盖当前用例关心的字段。
 * 这样能减少样板代码，避免测试读者被无关参数干扰。
 */
const runDecision = (overrides: Partial<Parameters<typeof resolvePlayerPoseDecision>[0]> = {}) =>
  resolvePlayerPoseDecision({
    currentPose: 'idle',
    grounded: false,
    velocityY: 0,
    horizontalSpeedAbs: 0,
    nowMs: 0,
    wasGroundedLastFrame: false,
    landingAnimUntil: 0,
    landingCooldownUntil: 0,
    fallTriggerVelocityY: FALL_THRESHOLD,
    stationaryVelocityEpsilon: STATIONARY_EPSILON,
    ...overrides,
  })

describe('resolvePlayerPoseDecision', () => {
  it('enters fall pose when airborne and vertical speed exceeds threshold', () => {
    // 场景：空中下落速度超过阈值，应切换为 fall 姿态。
    const decision = runDecision({
      currentPose: 'run',
      grounded: false,
      velocityY: 180,
    })

    expect(decision.nextPose).toBe('fall')
    expect(decision.shouldTriggerLanding).toBe(false)
  })

  it('keeps previous pose when airborne but not fast enough to trigger fall', () => {
    // 场景：仍在空中但速度不足，不应强制切换到 fall。
    const decision = runDecision({
      currentPose: 'run',
      grounded: false,
      velocityY: 80,
    })

    expect(decision.nextPose).toBe('run')
  })

  it('triggers landing only on first grounded frame and outside cooldown', () => {
    // 场景：首次接地且冷却结束，允许触发落地动画。
    const decision = runDecision({
      grounded: true,
      wasGroundedLastFrame: false,
      nowMs: 800,
      landingCooldownUntil: 700,
      horizontalSpeedAbs: 0,
    })

    expect(decision.shouldTriggerLanding).toBe(true)
    expect(decision.nextPose).toBe('idle')
  })

  it('suppresses landing trigger during cooldown window', () => {
    // 场景：落地冷却未结束时，即使接地也不得重复触发。
    const decision = runDecision({
      grounded: true,
      wasGroundedLastFrame: false,
      nowMs: 650,
      landingCooldownUntil: 700,
    })

    expect(decision.shouldTriggerLanding).toBe(false)
  })

  it('prevents repeated landing trigger when already grounded in previous frame', () => {
    // 场景：上一帧已接地，当前帧不应再次触发落地事件。
    const decision = runDecision({
      grounded: true,
      wasGroundedLastFrame: true,
      nowMs: 1200,
      landingCooldownUntil: 0,
    })

    expect(decision.shouldTriggerLanding).toBe(false)
  })

  it('keeps land pose while landing animation is locked', () => {
    // 场景：落地动画锁定窗口内，姿态应保持 land，不被移动速度打断。
    const decision = runDecision({
      currentPose: 'land',
      grounded: true,
      horizontalSpeedAbs: 120,
      nowMs: 1000,
      landingAnimUntil: 1080,
    })

    expect(decision.landingLocked).toBe(true)
    expect(decision.nextPose).toBe('land')
  })

  it('returns to run/idle after landing lock ends without input lock', () => {
    // 场景：动画锁结束后，根据水平速度在 run/idle 间恢复。
    const runPose = runDecision({
      currentPose: 'land',
      grounded: true,
      horizontalSpeedAbs: 120,
      nowMs: 1200,
      landingAnimUntil: 1080,
    })
    const idlePose = runDecision({
      currentPose: 'land',
      grounded: true,
      horizontalSpeedAbs: 0,
      nowMs: 1200,
      landingAnimUntil: 1080,
    })

    expect(runPose.nextPose satisfies PlayerPose).toBe('run')
    expect(idlePose.nextPose satisfies PlayerPose).toBe('idle')
  })
})
