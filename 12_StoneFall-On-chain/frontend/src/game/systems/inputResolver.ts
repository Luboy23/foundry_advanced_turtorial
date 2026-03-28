/**
 * 模块职责：提供 game/systems/inputResolver.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import type { InputMode, InputSource } from '../types'

type Axis = -1 | 0 | 1

type MovementInputSnapshot = {
  inputMode: InputMode
  recentInputSource: InputSource
  keyboardAxis: Axis
  touchAxis: Axis
  mouseAxis: Axis
}

const axisBySource = (
  source: InputSource,
  snapshot: MovementInputSnapshot,
): Axis => {
  if (source === 'touch') {
    return snapshot.touchAxis
  }
  if (source === 'mouse') {
    return snapshot.mouseAxis
  }
  return snapshot.keyboardAxis
}

/**
 * resolveMovementAxisFromSources：根据输入条件解析目标结果。
 */
export const resolveMovementAxisFromSources = (
  snapshot: MovementInputSnapshot,
): Axis => {
  if (snapshot.inputMode === 'touch') {
    return snapshot.touchAxis
  }

  if (snapshot.inputMode === 'keyboard') {
    return snapshot.keyboardAxis
  }

  const recentAxis = axisBySource(snapshot.recentInputSource, snapshot)
  if (recentAxis !== 0) {
    return recentAxis
  }

  if (snapshot.mouseAxis !== 0) {
    return snapshot.mouseAxis
  }

  if (snapshot.touchAxis !== 0) {
    return snapshot.touchAxis
  }

  return snapshot.keyboardAxis
}

/**
 * resolvePointerAxisFromPosition：根据输入条件解析目标结果。
 */
export const resolvePointerAxisFromPosition = (
  pointerX: number,
  playerX: number,
  deadZonePx: number,
): Axis => {
  const delta = pointerX - playerX
  if (Math.abs(delta) <= deadZonePx) {
    return 0
  }
  return delta < 0 ? -1 : 1
}
