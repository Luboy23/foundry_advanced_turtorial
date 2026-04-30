import Phaser from 'phaser'
import { type Body, type World } from 'planck'

import type {
  AudioMaterial,
  BirdType,
  LevelCatalogEntry,
  LevelPieceEntityType,
  RunCheckpointEvidence,
  RunDestroyEvidence,
  RunLaunchEvidence,
} from '../../types'
import type { BirdVisualState, PigVisualState } from '../../characterAnimations'
import type { LaunchState } from '../../launchModel'
import type { ReserveBirdSlot } from '../../reserveBirdQueue'
import type { SlingshotRig } from '../../slingshot'
import type { PrefabDefinition } from '../../prefabs'

export const FIXED_TIMESTEP = 1 / 60
export const MEANINGFUL_IMPACT_THRESHOLD = 1.5
export const STATIONARY_RETIRE_MS = 450
export const IMPACT_SETTLE_TIMEOUT_MS = 1600
export const NEXT_BIRD_READY_DELAY_MS = 220
export const STRUCTURE_ZONE_BUFFER_X = 120
export const STRUCTURE_ZONE_SLOW_SPEED = 3.8
export const STRUCTURE_ZONE_MIN_FLIGHT_MS = 220
export const GROUND_SETTLE_LINEAR_DAMPING_BOOST = 1.15
export const GROUND_SETTLE_ANGULAR_DAMPING_BOOST = 2.2
export const GROUND_SETTLE_FRICTION_BOOST = 0.55
export const PIECE_DAMAGE_LINEAR_SPEED_THRESHOLD = 1.8
export const PIECE_DAMAGE_ANGULAR_SPEED_THRESHOLD = 1.9
export const PIG_HIT_VISUAL_MS = 240
export const PIG_DEFEAT_HOLD_MS = 220
export const PIG_DEFEAT_FADE_MS = 180
export const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'

export type ShotPhase = 'idle' | 'dragging' | 'flying' | 'impact-settle' | 'retired'
export type BirdRetireReason = 'out-of-bounds' | 'stationary' | 'impact-settle-timeout'

export type RuntimePiece = {
  id: string
  entityType: LevelPieceEntityType
  audioMaterial: AudioMaterial
  body: Body
  sprite: Phaser.GameObjects.Sprite
  prefab: PrefabDefinition
  hp: number
  destroyed: boolean
  groundedLowEnergyMs: number
  settleBoostActive: boolean
  rollingOnGround: boolean
  visualState: PigVisualState | null
  hitUntilMs: number
}

export type RuntimeBird = {
  id: string
  birdType: BirdType
  birdIndex: number
  body: Body
  sprite: Phaser.GameObjects.Sprite
  launched: boolean
  stationaryMs: number
  visualState: BirdVisualState
}

export type ReserveBirdView = {
  slot: ReserveBirdSlot
  sprite: Phaser.GameObjects.Sprite
}

export type PhysicsBodyUserData = {
  kind: 'piece' | 'bird' | 'ground' | 'wall'
  id: string
  entityType?: LevelPieceEntityType
}

export type HudChipKey = 'time' | 'birds' | 'pigs'

export type HudChip = {
  background: Phaser.GameObjects.Graphics
  valueText: Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text
  iconSprite?: Phaser.GameObjects.Sprite
  iconGraphics?: Phaser.GameObjects.Graphics
  width: number
  height: number
}

export type HudMenuButton = {
  background: Phaser.GameObjects.Graphics
  icon: Phaser.GameObjects.Graphics
  label: Phaser.GameObjects.Text
  hitZone: Phaser.GameObjects.Zone
  width: number
  height: number
  hovered: boolean
}

export type HudLevelPill = {
  background: Phaser.GameObjects.Graphics
  label: Phaser.GameObjects.Text
  width: number
  height: number
}

export type PlaySceneRuntime = {
  world: World | null
  level: LevelCatalogEntry | null
  pieces: Map<string, RuntimePiece>
  currentBird: RuntimeBird | null
  rightWallBody: Body | null
  reserveBirdViews: ReserveBirdView[]
  pendingDamage: Map<string, number>
  collisionPairsThisStep: Set<string>
  accumulator: number
  runElapsedMs: number
  nextBirdIndex: number
  birdsUsed: number
  destroyedPigs: number
  nextBirdReadyAt: number
  pendingClearAt: number | null
  isDraggingBird: boolean
  activePointerId: number | null
  dragPointer: Phaser.Math.Vector2
  runCompleted: boolean
  hasLaunchedBird: boolean
  hudChips: Partial<Record<HudChipKey, HudChip>>
  hudLevelPill?: HudLevelPill
  hudMenuButton?: HudMenuButton
  slingshotRig?: SlingshotRig
  trajectoryDots: Phaser.GameObjects.Image[]
  lastLaunchState: LaunchState | null
  shotPhase: ShotPhase
  structureZoneStartX: number
  structureRightX: number
  effectiveRightBoundaryX: number
  effectiveRightBoundaryScreenX: number
  runtimeCameraZoom: number
  launchStartedAt: number | null
  impactSettleStartedAt: number | null
  hasMeaningfulImpact: boolean
  lastBirdRetireReason: BirdRetireReason | null
  activeRollingPigCount: number
  runStartedAtMs: number
  launchEvents: RunLaunchEvidence[]
  destroyEvents: RunDestroyEvidence[]
  checkpointEvents: RunCheckpointEvidence[]
  lastCheckpointAtMs: number
}

// 初始化 Play 场景运行态：每次进入关卡都从干净状态开始。
export const createInitialPlaySceneRuntime = (): PlaySceneRuntime => ({
  world: null,
  level: null,
  pieces: new Map(),
  currentBird: null,
  rightWallBody: null,
  reserveBirdViews: [],
  pendingDamage: new Map(),
  collisionPairsThisStep: new Set(),
  accumulator: 0,
  runElapsedMs: 0,
  nextBirdIndex: 0,
  birdsUsed: 0,
  destroyedPigs: 0,
  nextBirdReadyAt: 0,
  pendingClearAt: null,
  isDraggingBird: false,
  activePointerId: null,
  dragPointer: new Phaser.Math.Vector2(),
  runCompleted: false,
  hasLaunchedBird: false,
  hudChips: {},
  hudLevelPill: undefined,
  hudMenuButton: undefined,
  slingshotRig: undefined,
  trajectoryDots: [],
  lastLaunchState: null,
  shotPhase: 'idle',
  structureZoneStartX: 0,
  structureRightX: 0,
  effectiveRightBoundaryX: 0,
  effectiveRightBoundaryScreenX: 0,
  runtimeCameraZoom: 1,
  launchStartedAt: null,
  impactSettleStartedAt: null,
  hasMeaningfulImpact: false,
  lastBirdRetireReason: null,
  activeRollingPigCount: 0,
  runStartedAtMs: Date.now(),
  launchEvents: [],
  destroyEvents: [],
  checkpointEvents: [],
  lastCheckpointAtMs: 0,
})

// 原地重置运行态引用，避免替换对象导致外部持有引用失效。
export const resetPlaySceneRuntime = (runtime: PlaySceneRuntime) => {
  const next = createInitialPlaySceneRuntime()
  runtime.world = next.world
  runtime.level = next.level
  runtime.pieces = next.pieces
  runtime.currentBird = next.currentBird
  runtime.rightWallBody = next.rightWallBody
  runtime.reserveBirdViews = next.reserveBirdViews
  runtime.pendingDamage = next.pendingDamage
  runtime.collisionPairsThisStep = next.collisionPairsThisStep
  runtime.accumulator = next.accumulator
  runtime.runElapsedMs = next.runElapsedMs
  runtime.nextBirdIndex = next.nextBirdIndex
  runtime.birdsUsed = next.birdsUsed
  runtime.destroyedPigs = next.destroyedPigs
  runtime.nextBirdReadyAt = next.nextBirdReadyAt
  runtime.pendingClearAt = next.pendingClearAt
  runtime.isDraggingBird = next.isDraggingBird
  runtime.activePointerId = next.activePointerId
  runtime.dragPointer = next.dragPointer
  runtime.runCompleted = next.runCompleted
  runtime.hasLaunchedBird = next.hasLaunchedBird
  runtime.hudChips = next.hudChips
  runtime.hudLevelPill = next.hudLevelPill
  runtime.hudMenuButton = next.hudMenuButton
  runtime.slingshotRig = next.slingshotRig
  runtime.trajectoryDots = next.trajectoryDots
  runtime.lastLaunchState = next.lastLaunchState
  runtime.shotPhase = next.shotPhase
  runtime.structureZoneStartX = next.structureZoneStartX
  runtime.structureRightX = next.structureRightX
  runtime.effectiveRightBoundaryX = next.effectiveRightBoundaryX
  runtime.effectiveRightBoundaryScreenX = next.effectiveRightBoundaryScreenX
  runtime.runtimeCameraZoom = next.runtimeCameraZoom
  runtime.launchStartedAt = next.launchStartedAt
  runtime.impactSettleStartedAt = next.impactSettleStartedAt
  runtime.hasMeaningfulImpact = next.hasMeaningfulImpact
  runtime.lastBirdRetireReason = next.lastBirdRetireReason
  runtime.activeRollingPigCount = next.activeRollingPigCount
  runtime.runStartedAtMs = next.runStartedAtMs
  runtime.launchEvents = next.launchEvents
  runtime.destroyEvents = next.destroyEvents
  runtime.checkpointEvents = next.checkpointEvents
  runtime.lastCheckpointAtMs = next.lastCheckpointAtMs
}

// 统计剩余猪数量，作为通关判定核心输入。
export const countRemainingPigs = (pieces: Map<string, RuntimePiece>) => {
  let total = 0
  pieces.forEach((piece) => {
    if (piece.entityType === 'pig') {
      total += 1
    }
  })
  return total
}

// 统一读取物理 body 的 userData 并收敛类型。
export const getBodyData = (body: Body) => body.getUserData() as PhysicsBodyUserData | undefined
