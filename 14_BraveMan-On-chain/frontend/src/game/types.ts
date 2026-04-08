// 游戏主状态机：覆盖开局、倒计时、运行、暂停与结算阶段。
export type GameState = 'idle' | 'countdown' | 'running' | 'paused' | 'gameover'
// 输入来源用于统计与回放一致性校验。
export type InputSource = 'keyboard' | 'touch' | 'mouse'
// 结算终局原因：死亡或主动撤离。
export type EndReason = 'death' | 'retreat'
// 当前支持武器类型，需与后端规则与前端资源保持一致。
export type WeaponType = 'sword' | 'hook_spear' | 'bow'
export type PlayerPose =
  | 'sword_idle'
  | 'sword_move'
  | 'sword_attack'
  | 'hook_spear_idle'
  | 'hook_spear_move'
  | 'hook_spear_attack'
  | 'bow_idle'
  | 'bow_move'
  | 'bow_attack'
  | 'death'

// 输入日志事件：用于后端 replay 与结算验签的数据源。
export type InputEvent =
  | { kind: 'move'; tick: number; x: -1 | 0 | 1; y: -1 | 0 | 1 }
  | { kind: 'toggle_weapon'; tick: number }
  | { kind: 'unlock_bow'; tick: number }
  | { kind: 'pause'; tick: number }
  | { kind: 'resume'; tick: number }
  | { kind: 'retreat'; tick: number }

// 开局握手信息：由后端签发，绑定会话与规则版本。
export type SessionHandshake = {
  sessionId: `0x${string}`
  seed: string
  expiresAt: string
  rulesetVersion: number
  configHash: `0x${string}`
  bowUnlocked: boolean
}

// 对局统计：前端提交 verify 的主体 payload。
export type SessionStats = {
  sessionId: `0x${string}`
  rulesetVersion: number
  configHash: `0x${string}`
  kills: number
  survivalMs: number
  goldEarned: number
  endReason: EndReason
  inputSource: InputSource
  logs: InputEvent[]
}

// 高频快照：用于 UI HUD 展示，不直接作为链上真值。
export type SnapshotStats = {
  kills: number
  survivalMs: number
  goldEarned: number
  activeWeapon: WeaponType
  pose: PlayerPose
  targetId: number | null
  projectileCount: number
  enemyCount: number
}

export type GameStatePayload = { state: GameState }
export type CountdownPayload = { value: number }
export type SnapshotPayload = SnapshotStats
export type GameOverPayload = { stats: SessionStats }

// 场景发出的事件总线定义（Phaser -> React）。
export type GameEvents = {
  onGameState: GameStatePayload
  onCountdown: CountdownPayload
  onSnapshot: SnapshotPayload
  onGameOver: GameOverPayload
}

// React 发往场景的命令总线定义（React -> Phaser）。
export type GameCommandPayloads = {
  startGame: { session: SessionHandshake }
  pauseGame: undefined
  resumeGame: undefined
  returnToIdle: undefined
  setMovement: { x: -1 | 0 | 1; y: -1 | 0 | 1; source: InputSource }
  setEquipmentModalOpen: { open: boolean }
  setBowAvailability: { available: boolean }
  toggleWeapon: undefined
  equipWeapon: { weapon: WeaponType }
  unlockBowAndEquip: undefined
  retreat: undefined
  debugForceGameOver: undefined
}
