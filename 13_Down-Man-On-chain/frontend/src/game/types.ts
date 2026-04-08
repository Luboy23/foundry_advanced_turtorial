/**
 * 游戏领域类型集合。
 * 定义场景、UI、调试桥与链上提交共用的事件和统计结构。
 */
export type GameState = 'idle' | 'countdown' | 'running' | 'paused' | 'gameover'

// inputMode 描述“当前采用哪一类控制方案”，inputSource 描述“最近一次实际输入来自哪里”。
export type InputMode = 'auto' | 'keyboard' | 'touch'
export type InputSource = 'keyboard' | 'touch' | 'mouse'

// 玩家姿态只驱动表现层动画，不直接决定物理行为。
export type PlayerPose = 'idle' | 'run' | 'fall' | 'land' | 'hit' | 'death'

// 命令总线统一收口所有 React -> Phaser 的控制消息。
export type GameCommand =
  | 'startGame'
  | 'pauseGame'
  | 'resumeGame'
  | 'restartGame'
  | 'returnToIdle'
  | 'setInputMode'
  | 'setAudioSettings'
  | 'debugForceGameOver'
  | 'debugSetElapsed'
  | 'debugSetPlayerState'
  | 'debugSpawnTestPlatform'
  | 'debugClearTestPlatforms'

// 调试接口允许测试直接指定玩家位置与速度，便于构造极端碰撞场景。
export type DebugSetPlayerStatePayload = {
  x: number
  y: number
  velocityX?: number
  velocityY?: number
}

// 调试平台生成只服务于本地验证，不影响正式生成链路。
export type DebugSpawnTestPlatformPayload = {
  id?: number
  x: number
  y: number
  width: number
  type: 'stable' | 'moving' | 'vanishing'
  moveSpeed?: number
  direction?: -1 | 1
}

export type DebugLandingSource = 'collider' | 'swept-cross' | 'swept-late' | 'unknown'

// 最近一次落地事件快照会挂在调试状态上，方便定位“为什么被判定落地/漏判”。
export type DebugLandingEvent = {
  atMs: number
  platformId: number | null
  source: DebugLandingSource
}

// 调试玩家快照把物理体与相机位置一起暴露，便于 e2e 验证边界死亡与落台恢复。
export type DebugPlayerStateSnapshot = {
  x: number
  y: number
  bodyLeft: number
  bodyRight: number
  bodyWidth: number
  bodyHeight: number
  velocityX: number
  velocityY: number
  cameraScrollY: number
  blockedDown: boolean
  touchingDown: boolean
  grounded: boolean
  currentGroundPlatformId: number | null
  currentGroundSource: DebugLandingSource | null
  lastLandingEvent: DebugLandingEvent | null
}

// 平台调试快照关注的是行为状态，而不是渲染材质。
export type DebugPlatformStateSnapshot = {
  platformId: number
  x: number
  y: number
  velocityX: number
  moves: boolean
  active: boolean
  enabled: boolean
  type: 'stable' | 'moving' | 'vanishing'
  moveDirection: number
  moveMinX: number
  moveMaxX: number
}

// 平台难度快照是 GameScene 运行时真正消费的单一事实来源。
export type PlatformDifficultySnapshot = {
  elapsedSec: number
  threatLevel: number
  spawnCadenceMs: number
  cameraScrollSpeed: number
  platformDensityCap: number
  stablePlatformRatio: number
  movingPlatformRatio: number
  vanishingPlatformRatio: number
}

export type DifficultySnapshot = PlatformDifficultySnapshot & {
  // 兼容旧 HUD / 测试仍在读取的历史字段。
  spawnIntervalMs: number
  fallSpeed: number
  activeCap: number
  spikeRatio: number
  boulderRatio: number
}

export type PlatformSessionStats = {
  score: number
  survivalMs: number
  maxDifficulty: number
  hitCount: 0 | 1
  peakThreatLevel: number
  stablePlatformsSpawned: number
  movingPlatformsSpawned: number
  vanishingPlatformsSpawned: number
  totalLandings: number
  totalDodged: number
}

export type SessionStats = PlatformSessionStats & {
  // 兼容旧 UI / 测试仍在读取的历史字段。
  spikeSpawned: number
  boulderSpawned: number
  spikeDodged: number
  boulderDodged: number
}

export type GameStatePayload = {
  state: GameState
}

export type ScoreTickPayload = {
  score: number
  survivalMs: number
  totalLandings: number
  totalDodged: number
  // 兼容旧消费者仍在读取的历史字段。
  spikeDodged: number
  boulderDodged: number
}

export type CountdownPayload = {
  value: number
}

export type PlayerHitPayload = {
  delayMs: number
}

export type GameOverPayload = {
  stats: SessionStats
  inputType: InputSource
}

// 低频状态切换和高频分数更新共用一个事件表，供 OverlayBridgeScene 选择性转发。
export type GameEvents = {
  onGameState: GameStatePayload
  onScoreTick: ScoreTickPayload
  onCountdown: CountdownPayload
  onPlayerHit: PlayerHitPayload
  onGameOver: GameOverPayload
  onSessionStats: SessionStats
}

// 每个命令都显式声明 payload 形状，避免 emit/subscribe 时丢失类型约束。
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
  debugSetPlayerState: DebugSetPlayerStatePayload
  debugSpawnTestPlatform: DebugSpawnTestPlatformPayload
  debugClearTestPlatforms: undefined
}
