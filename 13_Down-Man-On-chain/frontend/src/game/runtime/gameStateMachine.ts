/**
 * 游戏状态机白名单。
 * 只允许显式声明过的状态转换发生，避免 UI 与场景之间出现非法跳转。
 */
import type { GameState } from '../types'

const ALLOWED_TRANSITIONS: Record<GameState, Set<GameState>> = {
  idle: new Set(['countdown']),
  countdown: new Set(['running', 'idle', 'gameover']),
  running: new Set(['paused', 'gameover', 'idle']),
  paused: new Set(['countdown', 'idle', 'gameover']),
  gameover: new Set(['countdown', 'idle']),
}

// 场景与 UI 在切状态前统一走白名单校验，防止重复 begin/end round。
export const canTransitionGameState = (
  from: GameState,
  to: GameState,
): boolean => {
  if (from === to) {
    return true
  }
  return ALLOWED_TRANSITIONS[from].has(to)
}
