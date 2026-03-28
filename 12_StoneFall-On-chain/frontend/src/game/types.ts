/**
 * 模块职责：提供 game/types.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

/**
 * 游戏主状态机。
 * idle -> countdown -> running -> (paused <-> running) -> gameover
 */
export type GameState = 'idle' | 'countdown' | 'running' | 'paused' | 'gameover'

/**
 * 输入模式：
 * - auto: 根据最近输入来源自动切换
 * - keyboard: 强制键盘轴输入
 * - touch: 强制触控输入（按钮或跟随）
 */
export type InputMode = 'auto' | 'keyboard' | 'touch'
/**
 * 最近一次实际输入来源（用于统计与 auto 模式决策）。
 */
export type InputSource = 'keyboard' | 'touch' | 'mouse'

/**
 * 类型定义：HazardType。
 */
export type HazardType = 'spike' | 'boulder'

/**
 * React 层可发送给 GameScene 的命令集合。
 */
export type GameCommand =
  | 'startGame'
  | 'pauseGame'
  | 'resumeGame'
  | 'restartGame'
  | 'returnToIdle'
  | 'setInputMode'
  | 'setAudioSettings'
  | 'debugSetElapsed'

/**
 * 难度快照：每帧更新后广播给 UI 与生成系统。
 */
export type DifficultySnapshot = {
  elapsedSec: number
  spawnIntervalMs: number
  fallSpeed: number
  activeCap: number
  threatLevel: number
  spikeRatio: number
  boulderRatio: number
}

/**
 * 单局结算统计：用于结算弹窗与链上提交。
 */
export type SessionStats = {
  score: number
  survivalMs: number
  maxDifficulty: number
  hitCount: 0 | 1
  peakThreatLevel: number
  spikeSpawned: number
  boulderSpawned: number
  spikeDodged: number
  boulderDodged: number
  totalDodged: number
}

/**
 * 类型定义：GameStatePayload。
 */
export type GameStatePayload = {
  state: GameState
}

/**
 * 类型定义：ScoreTickPayload。
 */
export type ScoreTickPayload = {
  score: number
  survivalMs: number
  spikeDodged: number
  boulderDodged: number
  totalDodged: number
}

/**
 * 类型定义：CountdownPayload。
 */
export type CountdownPayload = {
  value: number
}

/**
 * 类型定义：PlayerHitPayload。
 */
export type PlayerHitPayload = {
  delayMs: number
}

/**
 * 类型定义：GameOverPayload。
 */
export type GameOverPayload = {
  stats: SessionStats
  inputType: InputSource
}

/**
 * 场景向 UI 层广播的事件定义。
 */
export type GameEvents = {
  onGameState: GameStatePayload
  onScoreTick: ScoreTickPayload
  onDifficultyTick: DifficultySnapshot
  onCountdown: CountdownPayload
  onPlayerHit: PlayerHitPayload
  onGameOver: GameOverPayload
  onSessionStats: SessionStats
}

/**
 * 命令负载结构定义。
 * 每条命令的 payload 由该映射统一约束。
 */
export type GameCommandPayloads = {
  startGame: undefined
  pauseGame: undefined
  resumeGame: undefined
  restartGame: undefined
  returnToIdle: undefined
  setInputMode: {
    mode: InputMode
    axis?: -1 | 0 | 1
    targetX?: number
  }
  setAudioSettings: {
    musicEnabled: boolean
    sfxEnabled: boolean
  }
  debugForceGameOver: undefined
  debugSetElapsed: {
    elapsedMs: number
  }
}
