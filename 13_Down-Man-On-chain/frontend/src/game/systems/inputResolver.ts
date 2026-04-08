/**
 * 多输入源归并策略。
 * 在 auto 模式下按最近活跃来源优先，再回退到其余输入源。
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

// auto 模式下需要按输入源读取轴值，因此先做一个小型 source -> axis 映射。
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

// 优先最近活跃来源，再回退到 mouse / touch / keyboard，兼顾自然手感与可预测性。
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

// 鼠标/触控位置离玩家足够远才会产生方向，dead zone 用来抑制微抖动。
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
