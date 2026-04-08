/**
 * 输入缓冲与宽限工具。
 * 当实时输入在关键帧刚好抬起时，短暂保留最近一次有效输入，改善操作手感。
 */
import type { InputSource } from '../types'

type Axis = -1 | 0 | 1

export type BufferedAxisState = {
  axis: Axis
  source: InputSource | null
  expiresAtMs: number
}

// 跟随模式单独缓存 targetX，因为它与离散 axis 的过期策略不同。
export type BufferedTouchTargetState = {
  targetX: number | null
  expiresAtMs: number
}

// 空缓冲状态用于 round reset，避免残留上一局最后一次输入。
export const createEmptyBufferedAxisState = (): BufferedAxisState => ({
  axis: 0,
  source: null,
  expiresAtMs: 0,
})

export const createEmptyBufferedTouchTargetState = (): BufferedTouchTargetState => ({
  targetX: null,
  expiresAtMs: 0,
})

// 记录最近一次非零方向输入，并给它一个很短的宽限窗口。
export const bufferAxisInput = (params: {
  axis: Axis
  source: InputSource
  nowMs: number
  bufferMs: number
}): BufferedAxisState => ({
  axis: params.axis,
  source: params.source,
  expiresAtMs: params.nowMs + params.bufferMs,
})

// live 输入优先级高于缓冲，只有当这一帧刚好归零时才回退到缓存值。
export const resolveBufferedAxis = (params: {
  liveAxis: Axis
  bufferedAxis: BufferedAxisState
  nowMs: number
}): Axis => {
  if (params.liveAxis !== 0) {
    return params.liveAxis
  }

  if (params.bufferedAxis.axis === 0) {
    return 0
  }

  return params.nowMs <= params.bufferedAxis.expiresAtMs
    ? params.bufferedAxis.axis
    : 0
}

// 触控目标点也允许短暂续命，减少手指抬起瞬间角色立刻停死的割裂感。
export const bufferTouchTarget = (params: {
  targetX: number
  nowMs: number
  bufferMs: number
}): BufferedTouchTargetState => ({
  targetX: params.targetX,
  expiresAtMs: params.nowMs + params.bufferMs,
})

// follow 模式优先信任当前手指位置，只有松手后的短窗口才回读缓存目标点。
export const resolveBufferedTouchTarget = (params: {
  liveTargetX: number | null
  bufferedTouchTarget: BufferedTouchTargetState
  nowMs: number
}): number | null => {
  if (typeof params.liveTargetX === 'number') {
    return params.liveTargetX
  }

  if (params.bufferedTouchTarget.targetX === null) {
    return null
  }

  return params.nowMs <= params.bufferedTouchTarget.expiresAtMs
    ? params.bufferedTouchTarget.targetX
    : null
}
