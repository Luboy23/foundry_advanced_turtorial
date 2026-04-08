/**
 * 游戏主场景。
 * 负责固定步长模拟、平台生成/救援、玩家物理与 Phaser -> UI 的事件桥接。
 */
import Phaser from 'phaser'
import { TypedEventBus } from '../events/TypedEventBus'
import {
  INK_SPLASH_TEXTURE_KEY,
  INK_WASH_TEXTURE_KEY,
  PAPER_TEXTURE_KEY,
  PLATFORM_MOVING_TEXTURE_KEY,
  PLATFORM_STABLE_TEXTURE_KEY,
  PLATFORM_VANISHING_TEXTURE_KEY,
  STICKMAN_ANIM,
  STICKMAN_IDLE_FRAMES,
} from '../entities/assetKeys'
import type {
  DebugLandingEvent,
  DebugPlatformStateSnapshot,
  DebugLandingSource,
  DebugPlayerStateSnapshot,
  DebugSetPlayerStatePayload,
  DebugSpawnTestPlatformPayload,
  GameCommandPayloads,
  GameEvents,
  GameState,
  InputMode,
  InputSource,
  PlatformDifficultySnapshot,
  PlayerPose,
  SessionStats,
} from '../types'
import { getPlatformDifficultySnapshot } from '../../shared/game/difficulty'
import { clamp } from '../../shared/utils/math'
import {
  type PlatformRuntimeData,
  type PlatformRuntimeEntry,
  type PlatformRuntimeType,
} from '../runtime/platformRuntime'
import {
  collectPlatformBucketEntriesInRange,
  createPlatformBucketIndex,
  registerPlatformBucketEntry,
  unregisterPlatformBucketEntry,
  type PlatformBucketIndex,
} from '../runtime/platformBuckets'
import {
  createReachabilityState,
  planSpawnRow,
  type ReachabilityState,
  type ReachableWindow,
} from '../runtime/platformPathPlanner'
import {
  clampSimulationFrameDelta,
  FIXED_SIMULATION_STEP_MS,
  MAX_PLATFORM_SPAWNS_PER_STEP,
  MAX_SIMULATION_CATCH_UP_MS,
  resolveCameraScrollSpeed,
  resolvePlatformGap,
  resolvePlatformType,
  resolvePlatformWidth,
} from '../runtime/gameRules'
import { canTransitionGameState } from '../runtime/gameStateMachine'
import {
  resolveMovementAxisFromSources,
  resolvePointerAxisFromPosition,
} from '../systems/inputResolver'
import {
  bufferAxisInput,
  bufferTouchTarget,
  createEmptyBufferedAxisState,
  createEmptyBufferedTouchTargetState,
  resolveBufferedAxis,
  resolveBufferedTouchTarget,
  type BufferedAxisState,
  type BufferedTouchTargetState,
} from '../systems/inputForgiveness'
import {
  resolveAxisFromVelocity,
  resolveTouchFollowVelocity,
} from '../systems/touchFollow'
import { resolvePlayerPoseDecision } from '../systems/playerPose'
import { isTopLandingContact } from '../systems/platformLanding'
import {
  resolveLandingImpactTier,
  type LandingImpactTier,
} from '../systems/landingImpact'
import {
  resolveSweptLanding,
  type SweptLandingPlatformSnapshot,
} from '../systems/sweptLanding'
import { ENABLE_DEBUG_BRIDGE } from '../debugBridge'

type GameSceneOptions = {
  internalBus: TypedEventBus<GameEvents>
  commandBus: TypedEventBus<GameCommandPayloads>
}

// ArcadeOverlapTarget 兼容 Phaser collider/process 回调可能给出的几种对象形态。
type ArcadeOverlapTarget =
  | Phaser.Types.Physics.Arcade.GameObjectWithBody
  | Phaser.Physics.Arcade.Body
  | Phaser.Physics.Arcade.StaticBody
  | Phaser.Tilemaps.Tile

type SpawnTelemetryEntry = {
  timestampMs: number
  lane: number
  x: number
  count: 1 | 2
}

// 玩家 sweep 只需要保存上一帧底边与左右边界即可。
type SweepPlayerFrameSnapshot = {
  bottom: number
  left: number
  right: number
}

type PlatformType = PlatformRuntimeType
type GroundContactSource = 'collider' | 'swept-cross' | 'swept-late'

// 角色、世界尺寸与基础物理参数。
const PLAYER_SPEED = 480
const PLAYER_GRAVITY_Y = 1900
const PLAYER_MAX_VELOCITY_Y = 1600
const PLAYER_DISPLAY_WIDTH = 56
const PLAYER_DISPLAY_HEIGHT = 126
const RUN_MAX_TILT_DEG = 10
const WORLD_WIDTH = 1280
const WORLD_HEIGHT = 720
const WORLD_MAX_HEIGHT = 300_000
const PLAYER_START_X = WORLD_WIDTH * 0.5
const PLAYER_START_Y = 176

// 落地判定与 swept landing 修正参数。
const PLATFORM_HEIGHT = 32
const PLATFORM_EDGE_LANDING_FORGIVENESS_PX = 8
const PLATFORM_FORCE_LANDING_EDGE_BONUS_PX = 12
const PLATFORM_TOP_LANDING_TOLERANCE_PX = 18
const PLATFORM_SWEEP_CROSS_EPSILON_PX = 2
const PLATFORM_SWEEP_MIN_VELOCITY_Y = 120
const PLATFORM_SWEEP_DYNAMIC_EDGE_PER_FALL_PX = 0.045
const PLATFORM_SWEEP_DYNAMIC_EDGE_MAX_BONUS_PX = 24
const PLATFORM_SWEEP_LATE_RESCUE_BASE_PENETRATION_PX = 56
const PLATFORM_SWEEP_LATE_RESCUE_PER_AIRBORNE_FRAME_PX = 10
const PLATFORM_SWEEP_FORCE_LATE_RESCUE_BONUS_PX = 42
const PLATFORM_AIRBORNE_RESCUE_WINDOW_FRAMES = 8

// 平台生成、分散和密度控制参数。
const PLATFORM_MIN_X = 92
const PLATFORM_MAX_X = WORLD_WIDTH - 92
const PLATFORM_SPAWN_BUFFER = 340
const PLATFORM_CULL_OFFSET = 180
const PLATFORM_MIN_WIDTH = 120
const MOVING_PLATFORM_MAX_WIDTH = 272
const MOVING_PLATFORM_BASE_SPEED_MIN = 160
const MOVING_PLATFORM_BASE_SPEED_MAX = 240
const MOVING_PLATFORM_SIDE_PADDING = 18
const PLATFORM_ROW_EPSILON = 0.5
const SPAWN_X_CANDIDATE_COUNT = 9
const RECENT_SPAWN_X_WINDOW = 6

// 消失平台表现、倒计时和碰撞偏置参数。
const VANISHING_HOLD_TO_BREAK_MS = 760
const VANISHING_FLASH_MIN_ALPHA = 0.28
const VANISHING_IDLE_PULSE_MIN_ALPHA = 0.78
const VANISHING_IDLE_PULSE_SPEED = 0.008
const COUNTDOWN_TOTAL_MS = 3000
const COUNTDOWN_TICK_MS = 16
const FALL_TRIGGER_VELOCITY_Y = 120
const LANDING_POSE_MS = 240
const LANDING_COOLDOWN_MS = 120
const PHYSICS_OVERLAP_BIAS = 16
const PHYSICS_TILE_BIAS = 24

// 输入宽限、触控跟随和边界死亡保护参数。
const MOUSE_DEAD_ZONE_PX = 6
const TOUCH_FOLLOW_DEAD_ZONE_PX = 10
const TOUCH_FOLLOW_GAIN = 2.4
const TOUCH_FOLLOW_LERP = 0.2
const TOUCH_FOLLOW_MAX_DELTA_PX = 460
const INPUT_AXIS_BUFFER_MS = 72
const TOUCH_TARGET_GRACE_MS = 96
const SCREEN_TOP_DEATH_MARGIN = 20
const SCREEN_BOTTOM_DEATH_MARGIN = 20
const BOTTOM_DEATH_GRACE_FRAMES = 1
const SPAWN_TELEMETRY_LIMIT = 256
const STATIONARY_VELOCITY_EPSILON = 18
const PLATFORM_STRICT_SUPPORT_OVERLAP_PX = 10
const PLATFORM_GROUND_SUPPORT_TOP_SLACK_ABOVE_PX = 6
const PLATFORM_GROUND_SUPPORT_TOP_SLACK_BELOW_PX = 6
const PLATFORM_UNSUPPORTED_RELEASE_GRACE_FRAMES = 2
const PLATFORM_LATE_RESCUE_RETRY_BLOCK_FRAMES = 10
const PLATFORM_RECENT_RELEASE_REACQUIRE_FRAMES = 8
const PLATFORM_RELEASE_FALL_NUDGE_PX = 2
const PLATFORM_RELEASE_MIN_FALL_VELOCITY_Y = 140

export class GameScene extends Phaser.Scene {
  private readonly internalBus: TypedEventBus<GameEvents>
  private readonly commandBus: TypedEventBus<GameCommandPayloads>

  // 输入来源和表现态完全由场景内部维护，React 只消费收敛后的低频事件。
  private state: GameState = 'idle'
  private inputMode: InputMode = 'auto'
  private touchAxis: -1 | 0 | 1 = 0
  private touchTargetX: number | null = null
  private mouseAxis: -1 | 0 | 1 = 0
  private keyboardAxis: -1 | 0 | 1 = 0
  private isMousePointerDown = false
  private recentInputSource: InputSource = 'keyboard'
  private lastInputSource: InputSource = 'keyboard'
  private bufferedAxisState: BufferedAxisState = createEmptyBufferedAxisState()
  private bufferedTouchTargetState: BufferedTouchTargetState = createEmptyBufferedTouchTargetState()
  private playerPose: PlayerPose = 'idle'

  // Phaser 对象与本局统计数据。
  private player!: Phaser.Physics.Arcade.Sprite
  private playerBaseScaleX = 1
  private playerBaseScaleY = 1
  private platforms!: Phaser.Physics.Arcade.Group
  private paperLayer?: Phaser.GameObjects.TileSprite
  private inkWashLayer?: Phaser.GameObjects.TileSprite
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
  private keyA?: Phaser.Input.Keyboard.Key
  private keyD?: Phaser.Input.Keyboard.Key

  private score = 0
  private survivalMs = 0
  private maxDifficulty = 4
  private peakThreatLevel = 1
  private hitCount: 0 | 1 = 0
  private stablePlatformsSpawned = 0
  private movingPlatformsSpawned = 0
  private vanishingPlatformsSpawned = 0
  private totalLandings = 0
  private lastScoreTickTenths = -1
  private spawnTelemetry: SpawnTelemetryEntry[] = []
  private recentSpawnXs: number[] = []

  // 平台生成与落地恢复需要跨帧保留的运行时状态。
  private nextPlatformSpawnY = 0
  private platformIdSeq = 0
  private lastSpawnedPlatformType: PlatformType = 'stable'
  private spawnReachabilityState: ReachabilityState = createReachabilityState({
    y: PLAYER_START_Y,
    minCenterX: PLAYER_START_X,
    maxCenterX: PLAYER_START_X,
  })
  private currentGroundPlatformId: number | null = null
  private lastLandedPlatformId: number | null = null
  private lastAirborneVelocityY = 0
  private wasGroundedLastFrame = false
  private landingAnimUntil = 0
  private landingCooldownUntil = 0
  private stationaryDurationMs = 0
  private bottomDeathGraceFrames = 0
  private airborneRescueFrameCount = 0
  private currentGroundSource: GroundContactSource | null = null
  private lastLandingEvent: DebugLandingEvent | null = null
  private unsupportedGroundFrameCount = 0
  private releasedUnsupportedGroundThisFrame = false
  private recentUnsupportedReleasePlatformId: number | null = null
  private recentUnsupportedReleaseCooldownFrames = 0
  private recentLateRescuePlatformId: number | null = null
  private recentLateRescueCooldownFrames = 0
  private lockedLateRescuePlatformId: number | null = null
  private sweepPrevPlayerFrame: SweepPlayerFrameSnapshot | null = null
  private difficultySnapshot: PlatformDifficultySnapshot = getPlatformDifficultySnapshot(0)
  private simulationAccumulatorMs = 0

  // 热路径 scratch/index，避免固定步长里反复创建临时对象。
  private activePlatformEntries: PlatformRuntimeEntry[] = []
  private activePlatformById = new Map<number, PlatformRuntimeEntry>()
  private activePlatformBySprite = new WeakMap<
    Phaser.Physics.Arcade.Sprite,
    PlatformRuntimeEntry
  >()
  private platformBucketIndex: PlatformBucketIndex = createPlatformBucketIndex()
  private platformBucketScratch: PlatformRuntimeEntry[] = []
  private sweepPlatformScratch: SweptLandingPlatformSnapshot[] = []

  private countdownTimer?: Phaser.Time.TimerEvent
  private roundEndTimers: Phaser.Time.TimerEvent[] = []
  private commandUnsubscribers: Array<() => void> = []
  private pauseByBlur = false
  private isEndingRound = false
  private debugInvulnerableUntil = 0

  constructor(options: GameSceneOptions) {
    super({ key: 'game-scene' })
    this.internalBus = options.internalBus
    this.commandBus = options.commandBus
  }

  // create 只做一次性初始化和事件接线；真正的规则推进交给 update + 固定步长。
  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_MAX_HEIGHT)
    this.physics.world.OVERLAP_BIAS = PHYSICS_OVERLAP_BIAS
    this.physics.world.TILE_BIAS = PHYSICS_TILE_BIAS
    this.createInkBackdrop()

    this.platforms = this.physics.add.group({
      maxSize: 220,
      allowGravity: false,
      immovable: true,
    })

    this.player = this.physics.add.sprite(PLAYER_START_X, PLAYER_START_Y, STICKMAN_IDLE_FRAMES[0])
    this.player.setDisplaySize(PLAYER_DISPLAY_WIDTH, PLAYER_DISPLAY_HEIGHT)
    this.playerBaseScaleX = this.player.scaleX
    this.playerBaseScaleY = this.player.scaleY
    this.player.setDepth(5)
    this.player.setCollideWorldBounds(true)
    this.setIdleStaticPose()
    this.configurePlayerBody()

    this.physics.add.collider(
      this.player,
      this.platforms,
      this.handlePlatformCollision,
      this.shouldProcessPlatformCollision,
      this,
    )

    this.cursors = this.input.keyboard?.createCursorKeys()
    this.keyA = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.keyD = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D)

    this.registerCommandHandlers()
    this.registerPointerHandlers()

    this.game.events.on(Phaser.Core.Events.BLUR, this.handleBlur, this)
    this.game.events.on(Phaser.Core.Events.FOCUS, this.handleFocus, this)
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this)
    this.events.on(Phaser.Scenes.Events.DESTROY, this.handleShutdown, this)

    this.resetRoundData()
    this.physics.world.pause()
    this.setState('idle')
  }

  // 每帧先采样输入和背景，再按 accumulator 驱动固定步长结算。
  update(_: number, delta: number): void {
    const frameDeltaMs = clampSimulationFrameDelta(delta)

    this.updateBackdropLayers(frameDeltaMs)
    this.updateFrameInput()

    if (this.state === 'running' && !this.isEndingRound) {
      this.advanceRunningSimulation(frameDeltaMs)
      return
    }

    this.simulationAccumulatorMs = 0

    if ((this.state === 'running' || this.state === 'paused') && !this.isEndingRound) {
      this.updatePlayerMovement(frameDeltaMs)
      this.updatePlayerPoseFromPhysics()
    }

    this.snapshotCurrentSweepFrames()
  }

  private updateBackdropLayers(deltaMs: number): void {
    if (this.paperLayer) {
      this.paperLayer.tilePositionY += deltaMs * 0.002
      this.paperLayer.tilePositionX += deltaMs * 0.0005
    }
    if (this.inkWashLayer) {
      this.inkWashLayer.tilePositionX += deltaMs * 0.00025
    }
  }

  // 键盘输入先采样为瞬时状态，再写入缓冲，降低单帧漏按造成的手感抖动。
  private updateFrameInput(): void {
    const leftPressed = Boolean(this.cursors?.left.isDown || this.keyA?.isDown)
    const rightPressed = Boolean(this.cursors?.right.isDown || this.keyD?.isDown)

    let nextKeyboardAxis: -1 | 0 | 1 = 0
    if (leftPressed && !rightPressed) {
      nextKeyboardAxis = -1
    } else if (rightPressed && !leftPressed) {
      nextKeyboardAxis = 1
    }

    if (nextKeyboardAxis === this.keyboardAxis) {
      return
    }

    this.keyboardAxis = nextKeyboardAxis
    if (nextKeyboardAxis === 0) {
      return
    }

    this.markRecentInputSource('keyboard')
    this.bufferedAxisState = bufferAxisInput({
      axis: nextKeyboardAxis,
      source: 'keyboard',
      nowMs: this.time.now,
      bufferMs: INPUT_AXIS_BUFFER_MS,
    })
  }

  // 渲染帧只推进累计器，真实玩法统一在固定步长里结算。
  private advanceRunningSimulation(frameDeltaMs: number): void {
    this.simulationAccumulatorMs = Math.min(
      this.simulationAccumulatorMs + frameDeltaMs,
      MAX_SIMULATION_CATCH_UP_MS,
    )

    while (this.simulationAccumulatorMs >= FIXED_SIMULATION_STEP_MS) {
      this.stepRunningSimulation(FIXED_SIMULATION_STEP_MS)
      this.simulationAccumulatorMs -= FIXED_SIMULATION_STEP_MS
    }

    const currentTenths = Math.floor(this.survivalMs / 100)
    if (currentTenths !== this.lastScoreTickTenths) {
      this.emitScoreTick()
    }
  }

  // 单个固定步长的顺序固定为：难度/平台 -> 玩家/物理 -> 相机 -> 清理/补生成 -> HUD。
  private stepRunningSimulation(stepMs: number): void {
    if (this.state !== 'running' || this.isEndingRound) {
      return
    }

    this.releasedUnsupportedGroundThisFrame = false
    this.survivalMs += stepMs
    this.updateDifficulty(getPlatformDifficultySnapshot(this.survivalMs / 1000))
    this.updateMovingAndVanishingPlatforms(stepMs)
    this.updatePlayerMovement(stepMs)
    this.physics.world.singleStep()

    const scrollSpeed = this.resolveCameraScrollSpeed()
    this.cameras.main.scrollY += (scrollSpeed * stepMs) / 1000

    this.cleanupPlatforms()
    this.tickRecentUnsupportedReleaseCooldown()
    this.refreshLockedLateRescuePlatform()
    this.releaseUnsupportedGroundIfNeeded()
    this.applySweptLandingCorrection()
    this.checkBoundaryDeath()
    if (this.isEndingRound) {
      this.snapshotCurrentSweepFrames()
      return
    }
    this.spawnPlatformsAhead()
    this.recalculateScore()
    this.updatePlayerPoseFromPhysics()
    this.snapshotCurrentSweepFrames()
  }

  private configurePlayerBody(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(true)
    body.setGravityY(PLAYER_GRAVITY_Y)
    body.setSize(22, 62)
    body.setOffset(
      (this.player.displayWidth - body.width) / 2,
      this.player.displayHeight * 0.37,
    )
    body.setMaxVelocity(PLAYER_SPEED, PLAYER_MAX_VELOCITY_Y)
    body.setCollideWorldBounds(true)
  }

  private createInkBackdrop(): void {
    this.inkWashLayer = this.add
      .tileSprite(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, WORLD_WIDTH, WORLD_HEIGHT, INK_WASH_TEXTURE_KEY)
      .setDepth(0)
      .setAlpha(0.2)
      .setScrollFactor(0)

    this.paperLayer = this.add
      .tileSprite(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, WORLD_WIDTH, WORLD_HEIGHT, PAPER_TEXTURE_KEY)
      .setDepth(1)
      .setAlpha(0.16)
      .setScrollFactor(0)
  }

  // 每个平台实例都会挂一份独立 runtime data，供移动/消失/救援逻辑读写。
  private buildPlatformRuntimeData(params: {
    type: PlatformType
    moveMinX: number
    moveMaxX: number
    moveSpeed: number
    moveDirection: -1 | 0 | 1
  }): PlatformRuntimeData {
    return {
      type: params.type,
      moveMinX: params.moveMinX,
      moveMaxX: params.moveMaxX,
      moveSpeed: params.moveSpeed,
      moveDirection: params.moveDirection,
      vanishingHoldMs: 0,
      broken: false,
      prevLeft: 0,
      prevRight: 0,
    }
  }

  // 平台加入活跃列表时同时进入 id 索引、sprite 索引和分桶索引。
  private registerActivePlatform(
    platform: Phaser.Physics.Arcade.Sprite,
    body: Phaser.Physics.Arcade.Body,
    platformId: number,
    data: PlatformRuntimeData,
  ): PlatformRuntimeEntry {
    const existingEntry = this.activePlatformBySprite.get(platform)
    if (existingEntry) {
      this.unregisterActivePlatform(existingEntry)
    }

    const entry: PlatformRuntimeEntry = {
      index: this.activePlatformEntries.length,
      bucketId: -1,
      bucketSlot: -1,
      platformId,
      platform,
      body,
      data,
    }

    this.activePlatformEntries.push(entry)
    this.activePlatformById.set(platformId, entry)
    this.activePlatformBySprite.set(platform, entry)
    data.prevLeft = body.left
    data.prevRight = body.right
    registerPlatformBucketEntry(this.platformBucketIndex, entry, platform.y)
    return entry
  }

  // 注销逻辑与注册对称，确保 bucket/index/sprite 引用不会残留脏状态。
  private unregisterActivePlatform(
    target: Phaser.Physics.Arcade.Sprite | PlatformRuntimeEntry,
  ): PlatformRuntimeEntry | null {
    const entry =
      target instanceof Phaser.Physics.Arcade.Sprite
        ? this.activePlatformBySprite.get(target) ?? null
        : target

    if (!entry) {
      return null
    }

    unregisterPlatformBucketEntry(this.platformBucketIndex, entry)

    const lastEntry =
      this.activePlatformEntries[this.activePlatformEntries.length - 1] ?? null
    if (!lastEntry) {
      return null
    }

    const removeIndex = entry.index
    this.activePlatformEntries.pop()
    if (lastEntry !== entry) {
      lastEntry.index = removeIndex
      this.activePlatformEntries[removeIndex] = lastEntry
    }

    this.activePlatformById.delete(entry.platformId)
    this.activePlatformBySprite.delete(entry.platform)
    return entry
  }

  private getActivePlatformEntryById(platformId: number | null): PlatformRuntimeEntry | null {
    if (platformId === null) {
      return null
    }
    return this.activePlatformById.get(platformId) ?? null
  }

  private getActivePlatformEntryForSprite(
    platform: Phaser.Physics.Arcade.Sprite,
  ): PlatformRuntimeEntry | null {
    return this.activePlatformBySprite.get(platform) ?? null
  }

  private updateDifficulty(nextDifficulty: PlatformDifficultySnapshot): void {
    this.difficultySnapshot = nextDifficulty
    this.maxDifficulty = Math.max(this.maxDifficulty, Math.floor(nextDifficulty.threatLevel * 10))
    this.peakThreatLevel = Math.max(this.peakThreatLevel, nextDifficulty.threatLevel)
  }

  // 实际镜头速度统一从难度快照解析，场景内不再维护第二套滚屏规则。
  private resolveCameraScrollSpeed(): number {
    return resolveCameraScrollSpeed(this.difficultySnapshot)
  }

  // 视觉边界与物理世界边界略有不同，这里按显示尺寸限制角色不要半身出界。
  private resolvePlayerVisualBoundsX(): { minX: number; maxX: number } {
    const halfDisplayWidth = (this.player?.displayWidth ?? PLAYER_DISPLAY_WIDTH) * 0.5
    return {
      minX: halfDisplayWidth,
      maxX: WORLD_WIDTH - halfDisplayWidth,
    }
  }

  private clampPlayerWithinVisualBounds(): void {
    if (!this.player?.body) {
      return
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body
    const { minX, maxX } = this.resolvePlayerVisualBoundsX()
    const clampedX = clamp(this.player.x, minX, maxX)
    if (Math.abs(clampedX - this.player.x) < 1e-3) {
      return
    }

    this.player.setX(clampedX)
    body.updateFromGameObject()
    if ((clampedX <= minX && body.velocity.x < 0) || (clampedX >= maxX && body.velocity.x > 0)) {
      body.setVelocityX(0)
    }
  }

  // React 控制层发来的命令统一在这里翻译为场景内动作，避免 UI 直接触碰 Phaser 状态。
  private registerCommandHandlers(): void {
    this.commandUnsubscribers.push(
      this.commandBus.on('startGame', () => {
        if (this.state === 'idle' || this.state === 'gameover') {
          this.beginCountdown(true)
        }
      }),
      this.commandBus.on('restartGame', () => {
        this.beginCountdown(true)
      }),
      this.commandBus.on('returnToIdle', () => {
        this.returnToIdleState()
      }),
      this.commandBus.on('pauseGame', () => {
        this.pauseByBlur = false
        this.pauseGame()
      }),
      this.commandBus.on('resumeGame', () => {
        if (this.state === 'paused' && !this.isEndingRound) {
          this.pauseByBlur = false
          this.beginCountdown(false)
        }
      }),
      this.commandBus.on('setInputMode', (payload) => {
        const modeChanged = this.inputMode !== payload.mode
        this.inputMode = payload.mode

        if (modeChanged) {
          this.bufferedAxisState = createEmptyBufferedAxisState()
          this.bufferedTouchTargetState = createEmptyBufferedTouchTargetState()
        }

        if (payload.mode === 'keyboard') {
          this.touchAxis = 0
          this.touchTargetX = null
          this.clearMouseInput()
        } else if (payload.mode === 'touch') {
          this.clearMouseInput()
          if (typeof payload.targetX === 'number') {
            const { minX, maxX } = this.resolvePlayerVisualBoundsX()
            this.touchTargetX = clamp(payload.targetX, minX, maxX)
            this.markRecentInputSource('touch')
            this.bufferedTouchTargetState = bufferTouchTarget({
              targetX: this.touchTargetX,
              nowMs: this.time.now,
              bufferMs: TOUCH_TARGET_GRACE_MS,
            })
          }
        } else {
          this.touchTargetX = null
        }

        if (typeof payload.axis === 'number') {
          this.touchAxis = payload.axis
          if (payload.axis === 0) {
            this.touchTargetX = null
          }
          if (payload.axis !== 0) {
            this.markRecentInputSource('touch')
            this.bufferedAxisState = bufferAxisInput({
              axis: payload.axis,
              source: 'touch',
              nowMs: this.time.now,
              bufferMs: INPUT_AXIS_BUFFER_MS,
            })
          }
        }
      }),
      this.commandBus.on('setAudioSettings', () => {
        // 音频由 React 层管理，场景层只保持命令接口兼容。
      }),
    )

    if (!ENABLE_DEBUG_BRIDGE) {
      return
    }

    this.registerDebugCommandHandlers()
  }

  private registerDebugCommandHandlers(): void {
    this.commandUnsubscribers.push(
      this.commandBus.on('debugForceGameOver', () => {
        if (this.state === 'running' && !this.isEndingRound) {
          this.hitCount = 1
          this.beginBoundaryGameOver()
          return
        }

        if (this.state === 'countdown' || this.state === 'paused') {
          this.hitCount = 1
          this.gameOver()
        }
      }),
      this.commandBus.on('debugSetElapsed', ({ elapsedMs }) => {
        this.applyDebugElapsed(elapsedMs)
      }),
      this.commandBus.on('debugSetPlayerState', (payload) => {
        this.applyDebugPlayerState(payload)
      }),
      this.commandBus.on('debugSpawnTestPlatform', (payload) => {
        this.applyDebugSpawnTestPlatform(payload)
      }),
      this.commandBus.on('debugClearTestPlatforms', () => {
        this.clearAllPlatformsForDebug()
      }),
    )
  }

  // 鼠标输入只在 auto 模式下启用，触摸模式完全由 React 触控区接管。
  private registerPointerHandlers(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this)
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this)
    this.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this)
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this)
    this.input.on(Phaser.Input.Events.GAME_OUT, this.handlePointerCancel, this)
  }

  // 恢复游戏也复用倒计时流程，这样音效、物理恢复和 UI 时序保持一致。
  private beginCountdown(resetRound: boolean): void {
    this.clearRoundEndTimers()
    this.stopCountdown()
    this.isEndingRound = false
    this.tweens.killTweensOf(this.player)
    this.resetPlayerPresentation()

    if (resetRound) {
      this.resetRoundData()
      this.player.setPosition(PLAYER_START_X, PLAYER_START_Y)
      this.player.setVelocity(0, 0)
      this.player.setAlpha(1)
      this.player.clearTint()
      this.setIdleStaticPose()
    }

    this.physics.world.pause()
    this.setState('countdown')

    const countdownStartedAtMs = this.time.now
    let countdownValue = Math.ceil(COUNTDOWN_TOTAL_MS / 1000)
    this.internalBus.emit('onCountdown', { value: countdownValue })

    this.countdownTimer = this.time.addEvent({
      delay: COUNTDOWN_TICK_MS,
      loop: true,
      callback: () => {
        const elapsedMs = this.time.now - countdownStartedAtMs
        const remainingMs = COUNTDOWN_TOTAL_MS - elapsedMs
        if (remainingMs <= 0) {
          this.stopCountdown()
          this.enterRunningState()
          return
        }

        const nextValue = Math.ceil(remainingMs / 1000)
        if (nextValue !== countdownValue) {
          countdownValue = nextValue
          this.internalBus.emit('onCountdown', { value: countdownValue })
        }
      },
    })
  }

  private enterRunningState(): void {
    this.physics.world.resume()
    this.setState('running')
  }

  private pauseGame(): void {
    if (this.state !== 'running' || this.isEndingRound) {
      return
    }

    this.player.setVelocityX(0)
    this.resetPlayerPresentation()
    this.setIdleStaticPose()
    this.physics.world.pause()
    this.setState('paused')
  }

  // 开局铺台同样走 planner，保证初始几行就存在连续可达链路。
  private seedInitialPlatforms(): void {
    this.spawnPlannedRow(PLAYER_START_Y + 80, {
      forcedType: 'stable',
      forcedX: PLAYER_START_X,
    })

    let y = PLAYER_START_Y + 80 + this.resolvePlatformGap()
    while (y < WORLD_HEIGHT + PLATFORM_SPAWN_BUFFER) {
      this.spawnPlannedRow(y)
      y += this.resolvePlatformGap()
    }
    this.nextPlatformSpawnY = y
  }

  private resolvePlatformGap(): number {
    return resolvePlatformGap(this.difficultySnapshot)
  }

  private hasPlatformInRow(y: number): boolean {
    const candidates = collectPlatformBucketEntriesInRange(
      this.platformBucketIndex,
      y - PLATFORM_ROW_EPSILON,
      y + PLATFORM_ROW_EPSILON,
      this.platformBucketScratch,
    )

    for (const entry of candidates) {
      const platform = entry.platform
      if (Math.abs(platform.y - y) <= PLATFORM_ROW_EPSILON) {
        return true
      }
    }
    return false
  }

  private resolveMovingPlatformBounds(width: number): { minX: number; maxX: number } {
    const halfWidth = width * 0.5
    const minX = halfWidth + MOVING_PLATFORM_SIDE_PADDING
    const maxX = WORLD_WIDTH - halfWidth - MOVING_PLATFORM_SIDE_PADDING
    if (maxX - minX < 60) {
      return { minX: PLATFORM_MIN_X, maxX: PLATFORM_MAX_X }
    }
    return { minX, maxX }
  }

  // 普通候选只负责“尽量分散”，真正的可达性与救援节奏由 planner 兜底。
  private resolveDispersedSpawnX(minX: number, maxX: number): number {
    const span = maxX - minX
    if (span <= 1) {
      return Math.round(minX)
    }

    if (this.recentSpawnXs.length === 0) {
      return Phaser.Math.Between(Math.round(minX), Math.round(maxX))
    }

    let bestX = Phaser.Math.Between(Math.round(minX), Math.round(maxX))
    let bestScore = -1
    const latestX = this.recentSpawnXs[this.recentSpawnXs.length - 1] ?? bestX

    for (let attempt = 0; attempt < SPAWN_X_CANDIDATE_COUNT; attempt += 1) {
      const candidate = Phaser.Math.Between(Math.round(minX), Math.round(maxX))
      let score = Number.POSITIVE_INFINITY

      for (let index = 0; index < this.recentSpawnXs.length; index += 1) {
        const historyX = this.recentSpawnXs[this.recentSpawnXs.length - 1 - index]
        const weight = 1 + (this.recentSpawnXs.length - 1 - index) * 0.2
        const weightedDistance = Math.abs(candidate - historyX) * weight
        score = Math.min(score, weightedDistance)
      }

      if (score > bestScore) {
        bestScore = score
        bestX = candidate
      }
    }

    const minSeparation = span * 0.18
    if (Math.abs(bestX - latestX) < minSeparation) {
      const pushToRight = bestX <= latestX
      const target = latestX + (pushToRight ? minSeparation : -minSeparation)
      bestX = Math.round(clamp(target, minX, maxX))
    }

    return bestX
  }

  private registerSpawnX(x: number): void {
    this.recentSpawnXs.push(x)
    if (this.recentSpawnXs.length > RECENT_SPAWN_X_WINDOW) {
      this.recentSpawnXs.shift()
    }
  }

  private resolvePlatformWidth(type: PlatformType): number {
    return resolvePlatformWidth(this.difficultySnapshot, type)
  }

  // 类型选择完全托管给 runtime/gameRules，场景层只负责提供随机数与上下文。
  private resolvePlatformType(): PlatformType {
    return resolvePlatformType({
      difficultySnapshot: this.difficultySnapshot,
      lastSpawnedPlatformType: this.lastSpawnedPlatformType,
      roll: Math.random(),
      blockedMovingFallbackRoll: Math.random(),
    })
  }

  // 纹理 key 与玩法类型做一层显式映射，避免调用方散落条件判断。
  private getPlatformTexture(type: PlatformType): string {
    if (type === 'moving') {
      return PLATFORM_MOVING_TEXTURE_KEY
    }
    if (type === 'vanishing') {
      return PLATFORM_VANISHING_TEXTURE_KEY
    }
    return PLATFORM_STABLE_TEXTURE_KEY
  }

  // 先构造普通候选，再交给 planner 判定是 normal、dry 还是 rescue。
  private buildPlatformSpawnCandidate(options?: {
    forcedType?: PlatformType
    forcedX?: number
  }): {
    x: number
    width: number
    type: PlatformType
    minX: number
    maxX: number
  } {
    const type = options?.forcedType ?? this.resolvePlatformType()
    const width = this.resolvePlatformWidth(type)
    const movingBounds = this.resolveMovingPlatformBounds(width)
    const minX = type === 'moving' ? movingBounds.minX : PLATFORM_MIN_X
    const maxX = type === 'moving' ? movingBounds.maxX : PLATFORM_MAX_X
    const x =
      options?.forcedX === undefined
        ? this.resolveDispersedSpawnX(minX, maxX)
        : clamp(options.forcedX, minX, maxX)

    return {
      x,
      width,
      type,
      minX,
      maxX,
    }
  }

  // 真正的 spawn 只负责把计划落到 Phaser 世界，并同步 runtime data 与统计。
  private spawnResolvedPlatform(params: {
    x: number
    y: number
    width: number
    type: PlatformType
  }): boolean {
    const movingBounds = this.resolveMovingPlatformBounds(params.width)
    const minX = params.type === 'moving' ? movingBounds.minX : PLATFORM_MIN_X
    const maxX = params.type === 'moving' ? movingBounds.maxX : PLATFORM_MAX_X
    const x = clamp(params.x, minX, maxX)

    const platform = this.platforms.get(x, params.y, this.getPlatformTexture(params.type)) as
      | Phaser.Physics.Arcade.Sprite
      | null
    if (!platform) {
      return false
    }

    platform.setTexture(this.getPlatformTexture(params.type))
    platform.setActive(true)
    platform.setVisible(true)
    platform.setAlpha(1)
    platform.clearTint()
    platform.setDisplaySize(params.width, PLATFORM_HEIGHT)
    platform.setDepth(3)

    const body = platform.body as Phaser.Physics.Arcade.Body
    body.enable = true
    body.setAllowGravity(false)
    body.setImmovable(true)
    body.setVelocity(0, 0)
    body.setSize(params.width, PLATFORM_HEIGHT, true)
    body.reset(x, params.y)

    const platformId = this.platformIdSeq++
    const moveSpeed =
      params.type === 'moving'
        ? Phaser.Math.Between(MOVING_PLATFORM_BASE_SPEED_MIN, MOVING_PLATFORM_BASE_SPEED_MAX)
        : 0
    const moveDirection = (params.type === 'moving' ? Phaser.Math.RND.sign() : 0) as -1 | 0 | 1
    const runtimeData = this.buildPlatformRuntimeData({
      type: params.type,
      moveMinX: minX,
      moveMaxX: maxX,
      moveSpeed,
      moveDirection,
    })
    this.registerActivePlatform(platform, body, platformId, runtimeData)
    if (params.type === 'moving') {
      body.setVelocityX(moveDirection * moveSpeed)
    }

    if (params.type === 'stable') {
      this.stablePlatformsSpawned += 1
    } else if (params.type === 'moving') {
      this.movingPlatformsSpawned += 1
    } else {
      this.vanishingPlatformsSpawned += 1
    }
    this.lastSpawnedPlatformType = params.type
    this.registerSpawnX(x)
    return true
  }

  // planner 统一处理单平台、dry row 与救援双平台；场景层只消费它的结果。
  private spawnPlannedRow(
    y: number,
    options?: {
      forcedType?: PlatformType
      forcedX?: number
    },
  ): number {
    if (this.hasPlatformInRow(y)) {
      return 0
    }

    const normalCandidate = this.buildPlatformSpawnCandidate(options)
    const stableWidth = this.resolvePlatformWidth('stable')
    const availableRowSlots = Math.max(
      0,
      this.difficultySnapshot.platformDensityCap - this.activePlatformEntries.length,
    )
    if (availableRowSlots <= 0) {
      return 0
    }

    const rowPlan = planSpawnRow({
      y,
      currentState: this.spawnReachabilityState,
      normalCandidate,
      stableWidth,
      stableMinX: PLATFORM_MIN_X,
      stableMaxX: PLATFORM_MAX_X,
      maxPlatformsForRow: availableRowSlots,
      playerSpeed: PLAYER_SPEED,
      gravityY: PLAYER_GRAVITY_Y,
      worldMinX: PLATFORM_MIN_X,
      worldMaxX: PLATFORM_MAX_X,
      recentSpawnXs: this.recentSpawnXs,
    })

    let spawnedCount: 0 | 1 | 2 = 0
    let telemetryX = 0
    for (const platformPlan of rowPlan.platforms) {
      const spawned = this.spawnResolvedPlatform({
        x: platformPlan.x,
        y,
        width: platformPlan.width,
        type: platformPlan.type,
      })
      if (!spawned) {
        continue
      }

      if (spawnedCount === 0) {
        telemetryX = platformPlan.x
      }
      spawnedCount = (spawnedCount + 1) as 0 | 1 | 2
    }

    if (spawnedCount <= 0) {
      return 0
    }

    this.spawnReachabilityState = rowPlan.nextState
    this.recordSpawnTelemetry({
      timestampMs: Math.round(this.time.now),
      lane: this.resolveLaneFromX(telemetryX),
      x: Math.round(telemetryX),
      count: spawnedCount as 1 | 2,
    })

    return spawnedCount
  }

  // 固定步长里限制单步补生成数量，避免掉帧恢复后 while 连续补台造成尖峰。
  private spawnPlatformsAhead(): void {
    const spawnBoundary = this.cameras.main.scrollY + WORLD_HEIGHT + PLATFORM_SPAWN_BUFFER
    let spawnedThisStep = 0
    while (
      this.nextPlatformSpawnY < spawnBoundary &&
      spawnedThisStep < MAX_PLATFORM_SPAWNS_PER_STEP &&
      this.activePlatformEntries.length < this.difficultySnapshot.platformDensityCap
    ) {
      this.spawnPlannedRow(this.nextPlatformSpawnY)
      this.nextPlatformSpawnY += this.resolvePlatformGap()
      spawnedThisStep += 1
    }
  }

  private updateMovingAndVanishingPlatforms(deltaMs: number): void {
    const normalized = clamp((this.difficultySnapshot.threatLevel - 1) / 9, 0, 1)

    // 这里统一推进两类“会自己变化”的平台，避免多次遍历活跃平台列表。
    for (let index = 0; index < this.activePlatformEntries.length; ) {
      const entry = this.activePlatformEntries[index]
      const platform = entry.platform
      const runtimeData = entry.data
      const type = runtimeData.type
      const body = entry.body

      if (type === 'moving') {
        const minX = runtimeData.moveMinX
        const maxX = runtimeData.moveMaxX
        const speed = runtimeData.moveSpeed * (1 + normalized * 0.12)
        let direction = runtimeData.moveDirection
        if (direction !== -1 && direction !== 1) {
          direction = 1
        }
        const EDGE_DETECT_EPSILON_PX = 0.5
        const EDGE_RELEASE_NUDGE_PX = 1.5
        if (platform.x <= minX + EDGE_DETECT_EPSILON_PX) {
          platform.setX(minX + EDGE_RELEASE_NUDGE_PX)
          body.updateFromGameObject()
          direction = 1
        } else if (platform.x >= maxX - EDGE_DETECT_EPSILON_PX) {
          platform.setX(maxX - EDGE_RELEASE_NUDGE_PX)
          body.updateFromGameObject()
          direction = -1
        }

        runtimeData.moveDirection = direction
        body.setVelocityX(direction * speed)
      } else {
        body.setVelocityX(0)
      }

      if (type === 'vanishing') {
        const occupied = this.currentGroundPlatformId === entry.platformId
        if (occupied && !runtimeData.broken) {
          const nextHoldMs = runtimeData.vanishingHoldMs + deltaMs
          runtimeData.vanishingHoldMs = nextHoldMs

          const progress = clamp(nextHoldMs / VANISHING_HOLD_TO_BREAK_MS, 0, 1)
          const pulse = (Math.sin(this.time.now * (0.02 + progress * 0.03)) + 1) * 0.5
          const targetAlpha = Phaser.Math.Linear(1, VANISHING_FLASH_MIN_ALPHA, progress)
          platform.setAlpha(Phaser.Math.Linear(targetAlpha, 1, pulse))

          if (nextHoldMs >= VANISHING_HOLD_TO_BREAK_MS) {
            runtimeData.broken = true
            this.disablePlatform(platform)
            continue
          }
        } else {
          runtimeData.vanishingHoldMs = 0
          const idlePulse =
            (Math.sin(
              this.time.now * VANISHING_IDLE_PULSE_SPEED +
              entry.platformId * 0.85,
            ) + 1) * 0.5
          platform.setAlpha(
            Phaser.Math.Linear(VANISHING_IDLE_PULSE_MIN_ALPHA, 1, idlePulse),
          )
        }
      }

      index += 1
    }
  }

  // 平台一旦滚出屏幕上边界就立刻回收，维持密度上限与对象池复用空间。
  private cleanupPlatforms(): void {
    const cullY = this.cameras.main.scrollY - PLATFORM_CULL_OFFSET
    for (let index = this.activePlatformEntries.length - 1; index >= 0; index -= 1) {
      const platform = this.activePlatformEntries[index].platform
      if (platform.y + platform.displayHeight * 0.5 < cullY) {
        this.disablePlatform(platform)
      }
    }
  }

  // disableBody(true, true) 交还给 Arcade.Group 池，后续新平台可直接复用。
  private disablePlatform(platform: Phaser.Physics.Arcade.Sprite): void {
    if (!platform.active) {
      return
    }
    this.unregisterActivePlatform(platform)
    platform.disableBody(true, true)
  }

  // round reset 与 debug clear 都复用同一套“清空所有活跃平台”路径。
  private clearAllActivePlatforms(): void {
    while (this.activePlatformEntries.length > 0) {
      const entry = this.activePlatformEntries[this.activePlatformEntries.length - 1]
      this.disablePlatform(entry.platform)
    }
  }

  // 记录上一帧玩家和平台边界，供下一步 swept landing 计算穿越/迟到落地。
  private snapshotCurrentSweepFrames(): void {
    if (!this.player?.body || !this.platforms) {
      return
    }

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    this.sweepPrevPlayerFrame = {
      bottom: playerBody.bottom,
      left: playerBody.left,
      right: playerBody.right,
    }

    for (const entry of this.activePlatformEntries) {
      entry.data.prevLeft = entry.body.left
      entry.data.prevRight = entry.body.right
    }
  }

  private resolveHorizontalOverlapPx(
    playerBody: Phaser.Physics.Arcade.Body,
    platformBody: Phaser.Physics.Arcade.Body,
  ): number {
    return Math.min(playerBody.right, platformBody.right) - Math.max(playerBody.left, platformBody.left)
  }

  private resolveTopLandingMaxPenetrationPx(playerBody: Phaser.Physics.Arcade.Body): number {
    const playerPrevBottom = playerBody.prevFrame.y + playerBody.height
    // Keep the same dynamic penetration model as collision callback to avoid process/callback drift.
    const fallDistancePx = Math.max(0, playerBody.bottom - playerPrevBottom)
    const dynamicPenetrationPx = Math.ceil(fallDistancePx + PLATFORM_HEIGHT * 0.75 + 12)
    return Math.max(PLATFORM_HEIGHT + 14, dynamicPenetrationPx)
  }

  private isBodyTopLandingContact(
    playerBody: Phaser.Physics.Arcade.Body,
    platformBody: Phaser.Physics.Arcade.Body,
  ): boolean {
    return isTopLandingContact({
      playerBottom: playerBody.bottom,
      playerPrevBottom: playerBody.prevFrame.y + playerBody.height,
      platformTop: platformBody.top,
      velocityY: playerBody.velocity.y,
      topTolerancePx: PLATFORM_TOP_LANDING_TOLERANCE_PX,
      maxPenetrationPx: this.resolveTopLandingMaxPenetrationPx(playerBody),
    })
  }

  // 支撑判定只扫描玩家脚下附近的分桶区域，避免每帧全量遍历所有活跃平台。
  private resolveGroundSupportPlatform(
    playerBody: Phaser.Physics.Arcade.Body,
  ): { platformId: number; topDeltaAbs: number; overlapWidth: number } | null {
    let best: { platformId: number; topDeltaAbs: number; overlapWidth: number } | null = null

    const candidates = collectPlatformBucketEntriesInRange(
      this.platformBucketIndex,
      playerBody.bottom - PLATFORM_GROUND_SUPPORT_TOP_SLACK_BELOW_PX,
      playerBody.bottom + PLATFORM_GROUND_SUPPORT_TOP_SLACK_ABOVE_PX,
      this.platformBucketScratch,
    )

    for (const entry of candidates) {
      const platformBody = entry.body

      const overlapWidth = this.resolveHorizontalOverlapPx(playerBody, platformBody)
      if (overlapWidth < PLATFORM_STRICT_SUPPORT_OVERLAP_PX) {
        continue
      }

      const topDelta = playerBody.bottom - platformBody.top
      if (
        topDelta < -PLATFORM_GROUND_SUPPORT_TOP_SLACK_ABOVE_PX ||
        topDelta > PLATFORM_GROUND_SUPPORT_TOP_SLACK_BELOW_PX
      ) {
        continue
      }

      const topDeltaAbs = Math.abs(topDelta)
      const platformId = entry.platformId
      if (!best) {
        best = { platformId, topDeltaAbs, overlapWidth }
        continue
      }

      if (topDeltaAbs < best.topDeltaAbs - 0.01) {
        best = { platformId, topDeltaAbs, overlapWidth }
        continue
      }

      if (Math.abs(topDeltaAbs - best.topDeltaAbs) <= 0.01 && overlapWidth > best.overlapWidth) {
        best = { platformId, topDeltaAbs, overlapWidth }
      }
    }

    return best
  }

  // 看似踩住平台但脚下已无有效支撑时，经过宽限后主动释放，避免“空气托举”。
  private releaseUnsupportedGroundIfNeeded(): void {
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    const grounded = playerBody.blocked.down || playerBody.touching.down
    if (!grounded) {
      this.unsupportedGroundFrameCount = 0
      return
    }

    const support = this.resolveGroundSupportPlatform(playerBody)
    if (support) {
      this.unsupportedGroundFrameCount = 0
      this.currentGroundPlatformId = support.platformId
      return
    }

    this.unsupportedGroundFrameCount += 1
    if (this.unsupportedGroundFrameCount < PLATFORM_UNSUPPORTED_RELEASE_GRACE_FRAMES) {
      return
    }

    this.unsupportedGroundFrameCount = 0
    this.releasedUnsupportedGroundThisFrame = true
    const releasedPlatformId = this.currentGroundPlatformId
    playerBody.blocked.down = false
    playerBody.touching.down = false
    playerBody.wasTouching.down = false
    const nudgedY = Math.min(this.player.y + PLATFORM_RELEASE_FALL_NUDGE_PX, WORLD_MAX_HEIGHT - 1)
    this.player.setY(nudgedY)
    playerBody.updateFromGameObject()
    if (playerBody.velocity.y < PLATFORM_RELEASE_MIN_FALL_VELOCITY_Y) {
      playerBody.setVelocityY(PLATFORM_RELEASE_MIN_FALL_VELOCITY_Y)
    }
    this.currentGroundPlatformId = null
    this.currentGroundSource = null
    this.recentUnsupportedReleasePlatformId = releasedPlatformId
    this.recentUnsupportedReleaseCooldownFrames = PLATFORM_RECENT_RELEASE_REACQUIRE_FRAMES
  }

  private tickRecentUnsupportedReleaseCooldown(): void {
    if (this.recentUnsupportedReleaseCooldownFrames <= 0) {
      this.recentUnsupportedReleasePlatformId = null
    } else {
      this.recentUnsupportedReleaseCooldownFrames -= 1
      if (this.recentUnsupportedReleaseCooldownFrames <= 0) {
        this.recentUnsupportedReleasePlatformId = null
      }
    }

    if (this.recentLateRescueCooldownFrames <= 0) {
      this.recentLateRescuePlatformId = null
      return
    }

    this.recentLateRescueCooldownFrames -= 1
    if (this.recentLateRescueCooldownFrames <= 0) {
      this.recentLateRescuePlatformId = null
    }
  }

  private refreshLockedLateRescuePlatform(): void {
    if (this.lockedLateRescuePlatformId === null) {
      return
    }

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    const lockedPlatformBody =
      this.getActivePlatformEntryById(this.lockedLateRescuePlatformId)?.body ?? null

    if (!lockedPlatformBody) {
      this.lockedLateRescuePlatformId = null
      return
    }

    const horizontallySeparated =
      playerBody.right < lockedPlatformBody.left - PLATFORM_EDGE_LANDING_FORGIVENESS_PX ||
      playerBody.left > lockedPlatformBody.right + PLATFORM_EDGE_LANDING_FORGIVENESS_PX
    const safelyBelow = playerBody.top > lockedPlatformBody.bottom + PLATFORM_HEIGHT
    if (horizontallySeparated || safelyBelow) {
      this.lockedLateRescuePlatformId = null
    }
  }

  // swept landing 负责弥补 Arcade collider 的离散误差，优先保证高速下落仍能稳定落台。
  private applySweptLandingCorrection(options?: { force?: boolean; trackAirborne?: boolean }): boolean {
    const force = options?.force === true
    const trackAirborne = options?.trackAirborne !== false
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    const grounded = playerBody.blocked.down || playerBody.touching.down
    if (trackAirborne) {
      if (grounded) {
        this.airborneRescueFrameCount = 0
      } else {
        this.airborneRescueFrameCount = Math.min(
          this.airborneRescueFrameCount + 1,
          PLATFORM_AIRBORNE_RESCUE_WINDOW_FRAMES,
        )
      }
    }
    if (!force && grounded) {
      return false
    }
    if (!force && this.releasedUnsupportedGroundThisFrame) {
      return false
    }

    const lateRescuePenetrationPx =
      PLATFORM_SWEEP_LATE_RESCUE_BASE_PENETRATION_PX +
      Math.min(this.airborneRescueFrameCount, PLATFORM_AIRBORNE_RESCUE_WINDOW_FRAMES) *
      PLATFORM_SWEEP_LATE_RESCUE_PER_AIRBORNE_FRAME_PX
    const playerPrevBottom =
      this.sweepPrevPlayerFrame?.bottom ?? playerBody.prevFrame.y + playerBody.height
    const playerPrevLeft = this.sweepPrevPlayerFrame?.left ?? playerBody.prevFrame.x
    const playerPrevRight =
      this.sweepPrevPlayerFrame?.right ?? playerBody.prevFrame.x + playerBody.width
    const minCandidateY =
      Math.min(playerPrevBottom, playerBody.bottom) -
      PLATFORM_HEIGHT -
      PLATFORM_TOP_LANDING_TOLERANCE_PX
    const maxCandidateY =
      Math.max(playerPrevBottom, playerBody.bottom) +
      lateRescuePenetrationPx +
      PLATFORM_TOP_LANDING_TOLERANCE_PX
    const activePlatforms = collectPlatformBucketEntriesInRange(
      this.platformBucketIndex,
      minCandidateY,
      maxCandidateY,
      this.platformBucketScratch,
    )
    const platformScratch = this.sweepPlatformScratch
    platformScratch.length = activePlatforms.length

    for (let index = 0; index < activePlatforms.length; index += 1) {
      const entry = activePlatforms[index]
      const scratch = platformScratch[index] ?? {
        platformId: entry.platformId,
        active: true,
        enabled: true,
        top: 0,
        prevLeft: 0,
        prevRight: 0,
        left: 0,
        right: 0,
      }
      scratch.platformId = entry.platformId
      scratch.active = entry.platform.active
      scratch.enabled = entry.body.enable
      scratch.top = entry.body.top
      scratch.prevLeft = entry.data.prevLeft
      scratch.prevRight = entry.data.prevRight
      scratch.left = entry.body.left
      scratch.right = entry.body.right
      platformScratch[index] = scratch
    }

    const sweptResult = resolveSweptLanding({
      force,
      player: {
        velocityY: playerBody.velocity.y,
        blockedDown: playerBody.blocked.down,
        touchingDown: playerBody.touching.down,
        prevBottom: playerPrevBottom,
        bottom: playerBody.bottom,
        prevLeft: playerPrevLeft,
        prevRight: playerPrevRight,
        left: playerBody.left,
        right: playerBody.right,
      },
      platforms: platformScratch,
      config: {
        minVelocityY: PLATFORM_SWEEP_MIN_VELOCITY_Y,
        topTolerancePx: PLATFORM_TOP_LANDING_TOLERANCE_PX,
        crossEpsilonPx: PLATFORM_SWEEP_CROSS_EPSILON_PX,
        edgeForgivenessPx: force
          ? PLATFORM_EDGE_LANDING_FORGIVENESS_PX + PLATFORM_FORCE_LANDING_EDGE_BONUS_PX
          : PLATFORM_EDGE_LANDING_FORGIVENESS_PX,
        dynamicEdgePerFallPx: PLATFORM_SWEEP_DYNAMIC_EDGE_PER_FALL_PX,
        maxDynamicEdgeBonusPx: PLATFORM_SWEEP_DYNAMIC_EDGE_MAX_BONUS_PX,
        lateRescueMaxPenetrationPx: lateRescuePenetrationPx,
        forceLateRescueBonusPx: PLATFORM_SWEEP_FORCE_LATE_RESCUE_BONUS_PX,
      },
    })

    if (!sweptResult) {
      return false
    }

    const landingBody = this.getActivePlatformEntryById(sweptResult.platformId)?.body
    if (!landingBody?.enable) {
      return false
    }
    const rawOverlapWidth = this.resolveHorizontalOverlapPx(playerBody, landingBody)

    if (
      !force &&
      this.recentUnsupportedReleaseCooldownFrames > 0 &&
      this.recentUnsupportedReleasePlatformId !== null &&
      this.recentUnsupportedReleasePlatformId === sweptResult.platformId
    ) {
      return false
    }

    if (
      !force &&
      this.lockedLateRescuePlatformId !== null &&
      this.lockedLateRescuePlatformId === sweptResult.platformId
    ) {
      return false
    }

    if (
      !force &&
      sweptResult.mode === 'late' &&
      this.recentLateRescueCooldownFrames > 0 &&
      this.recentLateRescuePlatformId !== null &&
      this.recentLateRescuePlatformId === sweptResult.platformId
    ) {
      return false
    }

    if (!force && rawOverlapWidth < PLATFORM_STRICT_SUPPORT_OVERLAP_PX) {
      return false
    }

    const snappedBodyY = sweptResult.landingTop - playerBody.height
    const deltaY = snappedBodyY - playerBody.y
    if (Math.abs(deltaY) > 1e-6) {
      this.player.setY(this.player.y + deltaY)
    }
    playerBody.updateFromGameObject()
    playerBody.setVelocityY(0)
    playerBody.blocked.down = true
    playerBody.touching.down = true
    playerBody.wasTouching.down = true
    this.currentGroundPlatformId = sweptResult.platformId
    this.currentGroundSource = sweptResult.mode === 'late' ? 'swept-late' : 'swept-cross'
    this.airborneRescueFrameCount = 0
    this.unsupportedGroundFrameCount = 0
    this.clearUnsupportedReleaseCooldown()
    if (!force && sweptResult.mode === 'late') {
      this.recentLateRescuePlatformId = sweptResult.platformId
      this.recentLateRescueCooldownFrames = PLATFORM_LATE_RESCUE_RETRY_BLOCK_FRAMES
      this.lockedLateRescuePlatformId = sweptResult.platformId
    } else {
      this.clearLateRescueLockState()
    }
    return true
  }

  // 玩家横向速度由实时输入、输入缓冲和移动平台传递速度共同决定。
  private resolveMovementAxis(): -1 | 0 | 1 {
    const liveAxis = resolveMovementAxisFromSources({
      inputMode: this.inputMode,
      recentInputSource: this.recentInputSource,
      keyboardAxis: this.keyboardAxis,
      touchAxis: this.touchAxis,
      mouseAxis: this.mouseAxis,
    })

    return resolveBufferedAxis({
      liveAxis,
      bufferedAxis: this.bufferedAxisState,
      nowMs: this.time.now,
    })
  }

  private resolveTouchFollowTargetVelocity(): number | null {
    if (this.inputMode !== 'touch') {
      return null
    }

    const targetX = resolveBufferedTouchTarget({
      liveTargetX: this.touchTargetX,
      bufferedTouchTarget: this.bufferedTouchTargetState,
      nowMs: this.time.now,
    })
    if (targetX === null) {
      return null
    }

    return resolveTouchFollowVelocity({
      targetX,
      playerX: this.player.x,
      maxDeltaPx: TOUCH_FOLLOW_MAX_DELTA_PX,
      deadZonePx: TOUCH_FOLLOW_DEAD_ZONE_PX,
      gain: TOUCH_FOLLOW_GAIN,
      maxSpeed: PLAYER_SPEED,
    })
  }

  // 站在 moving 平台上时，角色会继承平台横向速度，减少“脚下打滑”感。
  private resolveGroundCarryVelocityX(): number {
    if (this.currentGroundPlatformId === null) {
      return 0
    }

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    const grounded = playerBody.blocked.down || playerBody.touching.down
    if (!grounded) {
      return 0
    }

    const entry = this.getActivePlatformEntryById(this.currentGroundPlatformId)
    if (!entry || entry.data.type !== 'moving') {
      return 0
    }
    return entry.body.velocity.x
  }

  private updatePlayerMovement(deltaMs: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    if (this.state !== 'running') {
      body.setVelocityX(0)
      this.player.setFlipX(false)
      this.applyRunPresentation(0, 0)
      this.setIdleStaticPose()
      this.clampPlayerWithinVisualBounds()
      return
    }

    const axis = this.resolveMovementAxis()
    const touchFollowVelocity = this.resolveTouchFollowTargetVelocity()
    const directTargetVelocityX = touchFollowVelocity ?? axis * PLAYER_SPEED
    const carryVelocityX = this.resolveGroundCarryVelocityX()
    const targetVelocityX = directTargetVelocityX + carryVelocityX
    const hasDirectInput = touchFollowVelocity !== null || axis !== 0

    const smoothing = touchFollowVelocity === null ? 0.24 : TOUCH_FOLLOW_LERP
    if (!hasDirectInput && Math.abs(carryVelocityX) > 1) {
      body.setVelocityX(carryVelocityX)
    } else {
      const smoothedVelocity = Phaser.Math.Linear(body.velocity.x, targetVelocityX, smoothing)
      body.setVelocityX(Math.abs(smoothedVelocity) < 3 ? 0 : smoothedVelocity)
    }

    const relativeSpeedAbs = Math.abs(body.velocity.x - carryVelocityX)
    if (relativeSpeedAbs <= STATIONARY_VELOCITY_EPSILON) {
      this.stationaryDurationMs += deltaMs
    } else {
      this.stationaryDurationMs = 0
    }

    const displayAxis = resolveAxisFromVelocity(directTargetVelocityX)
    if (displayAxis < 0) {
      this.player.setFlipX(true)
    } else if (displayAxis > 0) {
      this.player.setFlipX(false)
    }

    this.applyRunPresentation(displayAxis, relativeSpeedAbs)
    this.clampPlayerWithinVisualBounds()
  }

  // 姿态切换只基于物理结果决策，避免输入层和实际落地结果出现表现漂移。
  private updatePlayerPoseFromPhysics(): void {
    if (this.state !== 'running' || this.isEndingRound) {
      return
    }
    if (this.playerPose === 'hit' || this.playerPose === 'death') {
      return
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body
    const grounded = body.blocked.down || body.touching.down
    const now = this.time.now

    if (!grounded) {
      this.currentGroundPlatformId = null
      this.currentGroundSource = null
      this.lastAirborneVelocityY = Math.max(this.lastAirborneVelocityY, body.velocity.y)
    }

    const carryVelocityX = this.resolveGroundCarryVelocityX()
    const decision = resolvePlayerPoseDecision({
      currentPose: this.playerPose,
      grounded,
      velocityY: body.velocity.y,
      horizontalSpeedAbs: Math.abs(body.velocity.x - carryVelocityX),
      nowMs: now,
      wasGroundedLastFrame: this.wasGroundedLastFrame,
      landingAnimUntil: this.landingAnimUntil,
      landingCooldownUntil: this.landingCooldownUntil,
      fallTriggerVelocityY: FALL_TRIGGER_VELOCITY_Y,
      stationaryVelocityEpsilon: STATIONARY_VELOCITY_EPSILON,
    })

    if (decision.shouldTriggerLanding) {
      this.triggerLanding()
      this.wasGroundedLastFrame = grounded
      return
    }

    if (!decision.landingLocked) {
      if (decision.nextPose === 'fall') {
        this.playFallPose()
      } else if (decision.nextPose === 'run') {
        this.playRunPose()
      } else if (decision.nextPose === 'idle') {
        this.setIdleStaticPose()
      }
    }

    this.wasGroundedLastFrame = grounded
  }

  // 落地事件是计分与反馈的唯一入口，避免 collider / sweep 双通路重复记数。
  private triggerLanding(): void {
    const now = this.time.now
    this.landingAnimUntil = now + LANDING_POSE_MS
    this.landingCooldownUntil = now + LANDING_COOLDOWN_MS
    const landingTier = resolveLandingImpactTier(this.lastAirborneVelocityY)
    this.lastAirborneVelocityY = 0

    const platformId = this.currentGroundPlatformId
    const landingSource: DebugLandingSource = this.currentGroundSource ?? 'unknown'
    this.lastLandingEvent = {
      atMs: Math.round(now),
      platformId,
      source: landingSource,
    }
    if (platformId !== null && platformId !== this.lastLandedPlatformId) {
      this.totalLandings += 1
      this.lastLandedPlatformId = platformId
      this.recalculateScore()
      this.emitScoreTick()
    }

    this.playLandPose()
    this.playLandingImpact(landingTier)
  }

  private playLandingImpact(tier: LandingImpactTier): void {
    const recoverDurationMs = tier === 'heavy' ? 180 : 120
    this.tweens.killTweensOf(this.player)
    this.player.setScale(this.playerBaseScaleX, this.playerBaseScaleY)
    this.player.setAngle(0)
    this.player.setAlpha(0.84)
    this.spawnInkImpact(this.player.x + Phaser.Math.Between(-8, 8), this.player.y + 18)
    this.tweens.add({
      targets: this.player,
      alpha: 1,
      duration: recoverDurationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (this.playerPose === 'hit' || this.playerPose === 'death') {
          return
        }
        this.player.setAlpha(1)
      },
    })
  }

  // 跑动表现只改角度、缩放和动画速率，不直接影响物理速度。
  private applyRunPresentation(axis: -1 | 0 | 1, speedAbs: number): void {
    if (this.playerPose === 'land') {
      this.player.setAngle(Phaser.Math.Linear(this.player.angle, 0, 0.25))
      this.player.anims.timeScale = 1
      return
    }

    const speedRatio = clamp(speedAbs / PLAYER_SPEED, 0, 1)
    const targetAngle = axis === 0 ? 0 : axis * (4.6 + RUN_MAX_TILT_DEG * speedRatio)
    const targetScaleX = this.playerBaseScaleX
    const targetScaleY = this.playerBaseScaleY
    const animationRate = axis === 0 ? 1 : 1 + speedRatio * 0.4

    this.player.setAngle(Phaser.Math.Linear(this.player.angle, targetAngle, 0.22))
    this.player.setScale(
      Phaser.Math.Linear(this.player.scaleX, targetScaleX, 0.22),
      Phaser.Math.Linear(this.player.scaleY, targetScaleY, 0.22),
    )
    this.player.anims.timeScale = animationRate
  }

  private playFallPose(): void {
    if (this.playerPose === 'fall') {
      return
    }
    this.player.anims.play(STICKMAN_ANIM.fall, true)
    this.playerPose = 'fall'
  }

  private playLandPose(): void {
    this.player.anims.play(STICKMAN_ANIM.land, true)
    this.playerPose = 'land'
  }

  private resetPlayerPresentation(): void {
    this.player.setVisible(true)
    this.player.setAngle(0)
    this.player.setScale(this.playerBaseScaleX, this.playerBaseScaleY)
    this.player.setAlpha(1)
    this.player.anims.timeScale = 1
  }

  private setIdleStaticPose(): void {
    if (this.playerPose === 'idle') {
      return
    }
    this.player.anims.stop()
    this.player.setTexture(STICKMAN_IDLE_FRAMES[0])
    this.playerPose = 'idle'
  }

  private playRunPose(): void {
    if (this.playerPose === 'run') {
      return
    }
    this.player.anims.play(STICKMAN_ANIM.run, true)
    this.playerPose = 'run'
  }

  // 触顶或触底前会优先尝试救援修正，只有修正链条耗尽后才真正判死。
  private checkBoundaryDeath(): void {
    if (this.state !== 'running' || this.isEndingRound) {
      return
    }
    if (this.time.now < this.debugInvulnerableUntil) {
      return
    }

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    const screenTop = playerBody.top - this.cameras.main.scrollY
    if (screenTop < SCREEN_TOP_DEATH_MARGIN) {
      this.bottomDeathGraceFrames = 0
      this.hitCount = 1
      this.beginBoundaryGameOver()
      return
    }
    const screenBottom = playerBody.bottom - this.cameras.main.scrollY
    if (screenBottom > WORLD_HEIGHT - SCREEN_BOTTOM_DEATH_MARGIN) {
      const rescuedBySweptLanding = this.applySweptLandingCorrection({
        force: true,
        trackAirborne: false,
      })
      const correctedBottom = playerBody.bottom - this.cameras.main.scrollY
      const correctedTop = playerBody.top - this.cameras.main.scrollY
      const grounded = playerBody.blocked.down || playerBody.touching.down
      if (rescuedBySweptLanding || correctedBottom <= WORLD_HEIGHT - SCREEN_BOTTOM_DEATH_MARGIN) {
        this.bottomDeathGraceFrames = 0
        return
      }
      if (grounded && correctedTop < WORLD_HEIGHT) {
        this.bottomDeathGraceFrames = 0
        return
      }
      const rescueChainExhausted =
        this.airborneRescueFrameCount >= PLATFORM_AIRBORNE_RESCUE_WINDOW_FRAMES
      if (!rescueChainExhausted) {
        this.bottomDeathGraceFrames = 0
        return
      }
      if (this.bottomDeathGraceFrames <= 0) {
        this.bottomDeathGraceFrames = BOTTOM_DEATH_GRACE_FRAMES
        return
      }

      this.bottomDeathGraceFrames -= 1
      if (this.bottomDeathGraceFrames <= 0) {
        this.hitCount = 1
        this.beginBoundaryGameOver()
      }
      return
    }

    this.bottomDeathGraceFrames = 0
  }

  // Arcade 碰撞只负责记录“当前踩到哪块平台”，真正纠偏仍由 swept landing 完成。
  private handlePlatformCollision = (
    playerObject: ArcadeOverlapTarget,
    platformObject: ArcadeOverlapTarget,
  ): void => {
    if (this.state !== 'running' || this.isEndingRound) {
      return
    }
    if (!(playerObject instanceof Phaser.Physics.Arcade.Sprite)) {
      return
    }
    if (!(platformObject instanceof Phaser.Physics.Arcade.Sprite)) {
      return
    }

    const playerBody = playerObject.body as Phaser.Physics.Arcade.Body
    const platformBody = platformObject.body as Phaser.Physics.Arcade.Body
    const overlapWidth = this.resolveHorizontalOverlapPx(playerBody, platformBody)
    if (overlapWidth < PLATFORM_STRICT_SUPPORT_OVERLAP_PX) {
      return
    }

    if (!this.isBodyTopLandingContact(playerBody, platformBody)) {
      return
    }

    const entry = this.getActivePlatformEntryForSprite(platformObject)
    if (!entry) {
      return
    }

    this.currentGroundPlatformId = entry.platformId
    this.currentGroundSource = 'collider'
    this.clearUnsupportedReleaseCooldown()
    this.clearLateRescueLockState()
  }

  private shouldProcessPlatformCollision = (
    playerObject: ArcadeOverlapTarget,
    platformObject: ArcadeOverlapTarget,
  ): boolean => {
    if (!(playerObject instanceof Phaser.Physics.Arcade.Sprite)) {
      return false
    }
    if (!(platformObject instanceof Phaser.Physics.Arcade.Sprite)) {
      return false
    }

    const playerBody = playerObject.body as Phaser.Physics.Arcade.Body
    const platformBody = platformObject.body as Phaser.Physics.Arcade.Body
    if (!platformObject.active || !platformBody.enable) {
      return false
    }

    const overlapWidth = this.resolveHorizontalOverlapPx(playerBody, platformBody)
    if (overlapWidth < PLATFORM_STRICT_SUPPORT_OVERLAP_PX) {
      return false
    }

    const entry = this.getActivePlatformEntryForSprite(platformObject)
    if (!entry) {
      return false
    }

    const platformId = entry.platformId
    const blockedByRecentRelease =
      this.recentUnsupportedReleaseCooldownFrames > 0 &&
      this.recentUnsupportedReleasePlatformId !== null &&
      this.recentUnsupportedReleasePlatformId === platformId
    if (blockedByRecentRelease) {
      return false
    }

    return this.isBodyTopLandingContact(playerBody, platformBody)
  }

  // 死亡流程拆成两段：先冻结并播放表现，再延后抛出 game over 统计。
  private beginBoundaryGameOver(): void {
    this.isEndingRound = true
    this.resetLandingRecoveryState({ keepLastLandedPlatform: true })
    this.internalBus.emit('onPlayerHit', { delayMs: 0 })
    this.clearRoundEndTimers()
    this.stopCountdown()
    this.physics.world.pause()
    this.tweens.killTweensOf(this.player)

    this.player.setVelocity(0, 0)
    this.player.setAlpha(1)
    this.player.anims.timeScale = 1
    this.player.anims.stop()
    this.player.setVisible(false)
    this.playerPose = 'death'
    this.addRoundEndTimer(120, () => {
      this.gameOver()
    })
  }

  private spawnInkImpact(x: number, y: number): void {
    const splash = this.add
      .image(x, y, INK_SPLASH_TEXTURE_KEY)
      .setDepth(6)
      .setScale(0.24)
      .setAlpha(0.38)

    this.tweens.add({
      targets: splash,
      scale: 1.24,
      alpha: 0,
      duration: 250,
      ease: 'Quad.easeOut',
      onComplete: () => splash.destroy(),
    })
  }

  private gameOver(): void {
    this.clearRoundEndTimers()
    this.stopCountdown()
    this.physics.world.pause()
    this.player.setVelocity(0, 0)
    this.player.setAlpha(1)
    this.playerPose = 'death'
    this.setState('gameover')

    const stats: SessionStats = {
      score: this.score,
      survivalMs: Math.floor(this.survivalMs),
      maxDifficulty: this.maxDifficulty,
      hitCount: this.hitCount,
      peakThreatLevel: Number(this.peakThreatLevel.toFixed(2)),
      stablePlatformsSpawned: this.stablePlatformsSpawned,
      movingPlatformsSpawned: this.movingPlatformsSpawned,
      vanishingPlatformsSpawned: this.vanishingPlatformsSpawned,
      totalLandings: this.totalLandings,
      totalDodged: this.totalLandings,
      // 兼容旧 UI / 测试仍在读取的历史字段。
      spikeSpawned: this.stablePlatformsSpawned + this.movingPlatformsSpawned,
      boulderSpawned: this.vanishingPlatformsSpawned,
      spikeDodged: this.totalLandings,
      boulderDodged: 0,
    }

    this.internalBus.emit('onSessionStats', stats)
    this.internalBus.emit('onGameOver', {
      stats,
      inputType: this.lastInputSource,
    })
  }

  private returnToIdleState(): void {
    this.clearRoundEndTimers()
    this.stopCountdown()
    this.isEndingRound = false
    this.tweens.killTweensOf(this.player)
    this.resetPlayerPresentation()
    this.resetRoundData()
    this.player.setPosition(PLAYER_START_X, PLAYER_START_Y)
    this.player.setVelocity(0, 0)
    this.player.setAlpha(1)
    this.player.clearTint()
    this.setIdleStaticPose()
    this.physics.world.pause()
    this.setState('idle')
  }

  private setState(nextState: GameState): void {
    if (!canTransitionGameState(this.state, nextState)) {
      return
    }
    // 离开 running 后立即清空 accumulator 和鼠标拖拽状态，防止恢复时补跑旧输入。
    this.state = nextState
    if (nextState !== 'running') {
      this.simulationAccumulatorMs = 0
      this.clearMouseInput()
    }
    this.internalBus.emit('onGameState', { state: nextState })
  }

  private resetRoundCounters(): void {
    this.score = 0
    this.survivalMs = 0
    this.maxDifficulty = 4
    this.peakThreatLevel = 1
    this.hitCount = 0
    this.stablePlatformsSpawned = 0
    this.movingPlatformsSpawned = 0
    this.vanishingPlatformsSpawned = 0
    this.totalLandings = 0
    this.lastScoreTickTenths = -1
    this.spawnTelemetry = []
    this.recentSpawnXs = []
    this.nextPlatformSpawnY = 0
    this.platformIdSeq = 0
    this.lastSpawnedPlatformType = 'stable'
  }

  private clearUnsupportedReleaseCooldown(): void {
    this.recentUnsupportedReleasePlatformId = null
    this.recentUnsupportedReleaseCooldownFrames = 0
  }

  private clearLateRescueLockState(): void {
    this.recentLateRescuePlatformId = null
    this.recentLateRescueCooldownFrames = 0
    this.lockedLateRescuePlatformId = null
  }

  private resetLandingRecoveryState(options?: { keepLastLandedPlatform?: boolean }): void {
    this.currentGroundPlatformId = null
    if (!options?.keepLastLandedPlatform) {
      this.lastLandedPlatformId = null
    }
    this.lastAirborneVelocityY = 0
    this.wasGroundedLastFrame = false
    this.landingAnimUntil = 0
    this.landingCooldownUntil = 0
    this.stationaryDurationMs = 0
    this.bottomDeathGraceFrames = 0
    this.airborneRescueFrameCount = 0
    this.unsupportedGroundFrameCount = 0
    this.releasedUnsupportedGroundThisFrame = false
    this.clearUnsupportedReleaseCooldown()
    this.clearLateRescueLockState()
    this.currentGroundSource = null
    this.lastLandingEvent = null
    this.sweepPrevPlayerFrame = null
    this.sweepPlatformScratch.length = 0

    for (const entry of this.activePlatformEntries) {
      entry.data.prevLeft = entry.body.left
      entry.data.prevRight = entry.body.right
    }
  }

  private resetDebugRuntimeState(): void {
    this.debugInvulnerableUntil = 0
  }

  private resolveReachableAnchorWindow(anchorX: number, anchorY: number): ReachableWindow {
    return {
      y: anchorY,
      minCenterX: anchorX,
      maxCenterX: anchorX,
    }
  }

  private resetSpawnReachabilityState(anchorX = PLAYER_START_X, anchorY = PLAYER_START_Y): void {
    this.spawnReachabilityState = createReachabilityState(
      this.resolveReachableAnchorWindow(anchorX, anchorY),
    )
  }

  // round reset 会把输入、相机、补生成状态和缓存全部拉回到一致起点。
  private resetRoundData(): void {
    this.resetRoundCounters()
    this.resetLandingRecoveryState()
    this.resetDebugRuntimeState()
    this.simulationAccumulatorMs = 0
    this.touchAxis = 0
    this.touchTargetX = null
    this.mouseAxis = 0
    this.keyboardAxis = 0
    this.isMousePointerDown = false
    this.recentInputSource = 'keyboard'
    this.lastInputSource = 'keyboard'
    this.bufferedAxisState = createEmptyBufferedAxisState()
    this.bufferedTouchTargetState = createEmptyBufferedTouchTargetState()
    this.isEndingRound = false
    this.clearRoundEndTimers()
    this.difficultySnapshot = getPlatformDifficultySnapshot(0)
    this.cameras.main.setScroll(0, 0)
    this.resetSpawnReachabilityState()

    this.clearAllActivePlatforms()
    this.seedInitialPlatforms()
    this.snapshotCurrentSweepFrames()

    this.emitScoreTick()
  }

  private resolveLaneFromX(x: number): number {
    const laneWidth = (PLATFORM_MAX_X - PLATFORM_MIN_X) / 9
    const laneIndex = Math.floor((x - PLATFORM_MIN_X) / laneWidth)
    return clamp(laneIndex, 0, 8)
  }

  private recalculateScore(): void {
    // 分数由生存时间与有效落台数共同组成，避免纯苟活成为唯一最优策略。
    this.score = Math.max(0, Math.floor(this.survivalMs / 100) + this.totalLandings * 8)
  }

  private stopCountdown(): void {
    this.countdownTimer?.remove(false)
    this.countdownTimer = undefined
  }

  private addRoundEndTimer(delay: number, callback: () => void): void {
    const timer = this.time.delayedCall(delay, callback)
    this.roundEndTimers.push(timer)
  }

  private clearRoundEndTimers(): void {
    for (const timer of this.roundEndTimers) {
      timer.remove(false)
    }
    this.roundEndTimers = []
  }

  private markRecentInputSource(source: InputSource): void {
    this.recentInputSource = source
    this.lastInputSource = source
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (
      !this.isMousePointer(pointer) ||
      this.inputMode !== 'auto' ||
      this.state !== 'running' ||
      this.isEndingRound
    ) {
      return
    }

    this.isMousePointerDown = true
    this.updateMouseAxisFromPointer(pointer)
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (
      !this.isMousePointer(pointer) ||
      !this.isMousePointerDown ||
      this.inputMode !== 'auto' ||
      this.state !== 'running' ||
      this.isEndingRound
    ) {
      return
    }

    this.updateMouseAxisFromPointer(pointer)
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.isMousePointer(pointer)) {
      return
    }
    this.clearMouseInput()
  }

  private handlePointerCancel(): void {
    this.clearMouseInput()
  }

  private updateMouseAxisFromPointer(pointer: Phaser.Input.Pointer): void {
    const axis = this.resolvePointerAxis(pointer)
    this.mouseAxis = axis
    if (axis !== 0) {
      this.markRecentInputSource('mouse')
      this.bufferedAxisState = bufferAxisInput({
        axis,
        source: 'mouse',
        nowMs: this.time.now,
        bufferMs: INPUT_AXIS_BUFFER_MS,
      })
    }
  }

  // pointer worldX 直接与玩家 x 比较，避免相机滚动后仍按屏幕坐标判方向。
  private resolvePointerAxis(pointer: Phaser.Input.Pointer): -1 | 0 | 1 {
    return resolvePointerAxisFromPosition(pointer.worldX, this.player.x, MOUSE_DEAD_ZONE_PX)
  }

  private clearMouseInput(): void {
    this.mouseAxis = 0
    this.isMousePointerDown = false
  }

  private isMousePointer(pointer: Phaser.Input.Pointer): boolean {
    return !pointer.wasTouch
  }

  // 失焦自动暂停，回焦则复用倒计时恢复，尽量避免浏览器切后台后的误死。
  private handleBlur(): void {
    if (this.state === 'running' && !this.isEndingRound) {
      this.pauseByBlur = true
      this.pauseGame()
    }
  }

  private handleFocus(): void {
    if (this.pauseByBlur && this.state === 'paused' && !this.isEndingRound) {
      this.pauseByBlur = false
      this.beginCountdown(false)
    }
  }

  // shutdown 里统一撤掉全局事件和命令订阅，避免场景重建时重复绑定。
  private handleShutdown(): void {
    this.clearRoundEndTimers()
    this.stopCountdown()
    this.tweens.killTweensOf(this.player)
    this.game.events.off(Phaser.Core.Events.BLUR, this.handleBlur, this)
    this.game.events.off(Phaser.Core.Events.FOCUS, this.handleFocus, this)
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this)
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this)
    this.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this)
    this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this)
    this.input.off(Phaser.Input.Events.GAME_OUT, this.handlePointerCancel, this)

    for (const unsubscribe of this.commandUnsubscribers) {
      unsubscribe()
    }
    this.commandUnsubscribers = []
  }

  // Debug 命令只服务测试/调试桥，不参与正式玩法流程。
  private applyDebugPlayerState(payload: DebugSetPlayerStatePayload): void {
    if (!this.player?.body) {
      return
    }
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const { minX, maxX } = this.resolvePlayerVisualBoundsX()
    const x = clamp(payload.x, minX, maxX)
    const y = clamp(payload.y, 0, WORLD_MAX_HEIGHT - 1)
    this.player.setPosition(x, y)
    body.updateFromGameObject()
    body.setVelocity(payload.velocityX ?? body.velocity.x, payload.velocityY ?? body.velocity.y)
    body.blocked.down = false
    body.touching.down = false
    body.wasTouching.down = false
    this.resetLandingRecoveryState()
    this.resetDebugRuntimeState()
    this.lastAirborneVelocityY = Math.max(0, body.velocity.y)
    this.resetSpawnReachabilityState(x, y)
    this.snapshotCurrentSweepFrames()
  }

  private applyDebugSpawnTestPlatform(payload: DebugSpawnTestPlatformPayload): void {
    if (!this.platforms) {
      return
    }

    const type = payload.type
    const width = clamp(Math.round(payload.width), PLATFORM_MIN_WIDTH, MOVING_PLATFORM_MAX_WIDTH)
    const movingBounds = this.resolveMovingPlatformBounds(width)
    const minX = type === 'moving' ? movingBounds.minX : PLATFORM_MIN_X
    const maxX = type === 'moving' ? movingBounds.maxX : PLATFORM_MAX_X
    const x = clamp(payload.x, minX, maxX)
    const y = clamp(payload.y, 0, WORLD_MAX_HEIGHT - 1)

    const platform = this.platforms.get(x, y, this.getPlatformTexture(type)) as
      | Phaser.Physics.Arcade.Sprite
      | null
    if (!platform) {
      return
    }

    platform.setTexture(this.getPlatformTexture(type))
    platform.setActive(true)
    platform.setVisible(true)
    platform.setAlpha(1)
    platform.clearTint()
    platform.setDisplaySize(width, PLATFORM_HEIGHT)
    platform.setDepth(3)

    const body = platform.body as Phaser.Physics.Arcade.Body
    body.enable = true
    body.setAllowGravity(false)
    body.setImmovable(true)
    body.setVelocity(0, 0)
    body.setSize(width, PLATFORM_HEIGHT, true)
    body.reset(x, y)

    const platformId = payload.id ?? this.platformIdSeq++
    this.platformIdSeq = Math.max(this.platformIdSeq, platformId + 1)
    const direction = (payload.direction === -1 ? -1 : 1) as -1 | 1
    const moveSpeed =
      type === 'moving'
        ? clamp(
          payload.moveSpeed ?? MOVING_PLATFORM_BASE_SPEED_MIN,
          MOVING_PLATFORM_BASE_SPEED_MIN * 0.4,
          MOVING_PLATFORM_BASE_SPEED_MAX * 1.8,
        )
        : 0
    const runtimeData = this.buildPlatformRuntimeData({
      type,
      moveMinX: minX,
      moveMaxX: maxX,
      moveSpeed,
      moveDirection: type === 'moving' ? direction : 0,
    })
    this.registerActivePlatform(platform, body, platformId, runtimeData)
    if (type === 'moving') {
      body.setVelocityX(direction * moveSpeed)
    }
    this.snapshotCurrentSweepFrames()
  }

  private clearAllPlatformsForDebug(): void {
    if (!this.platforms) {
      return
    }

    this.clearAllActivePlatforms()
    this.resetLandingRecoveryState()
    this.resetSpawnReachabilityState(this.player?.x ?? PLAYER_START_X, this.player?.y ?? PLAYER_START_Y)
    this.snapshotCurrentSweepFrames()
  }

  // 调试接口直接暴露运行时快照，方便 e2e 和手工排查读取真实物理状态。
  public debugGetPlayerX(): number {
    return this.player?.x ?? 0
  }

  public debugGetPlayerY(): number {
    return this.player?.y ?? 0
  }

  public debugGetPlayerVelocityX(): number {
    const body = this.player?.body as Phaser.Physics.Arcade.Body | undefined
    return body?.velocity.x ?? 0
  }

  public debugGetPlayerVelocityY(): number {
    const body = this.player?.body as Phaser.Physics.Arcade.Body | undefined
    return body?.velocity.y ?? 0
  }

  public debugGetPlayerStateSnapshot(): DebugPlayerStateSnapshot {
    const body = this.player?.body as Phaser.Physics.Arcade.Body | undefined
    const blockedDown = Boolean(body?.blocked.down)
    const touchingDown = Boolean(body?.touching.down)
    const grounded = blockedDown || touchingDown
    return {
      x: this.player?.x ?? 0,
      y: this.player?.y ?? 0,
      bodyLeft: body?.left ?? 0,
      bodyRight: body?.right ?? 0,
      bodyWidth: body?.width ?? 0,
      bodyHeight: body?.height ?? 0,
      velocityX: body?.velocity.x ?? 0,
      velocityY: body?.velocity.y ?? 0,
      cameraScrollY: this.cameras.main.scrollY,
      blockedDown,
      touchingDown,
      grounded,
      currentGroundPlatformId: this.currentGroundPlatformId,
      currentGroundSource: this.currentGroundSource,
      lastLandingEvent: this.lastLandingEvent,
    }
  }

  public debugGetSpawnTelemetry(): Array<{
    timestampMs: number
    lane: number
    x: number
    count: 1 | 2
  }> {
    return this.spawnTelemetry.slice()
  }

  public debugGetPlatformState(platformId: number): DebugPlatformStateSnapshot | null {
    if (!Number.isFinite(platformId)) {
      return null
    }

    const entry = this.getActivePlatformEntryById(platformId)
    if (!entry) {
      return null
    }
    const platform = entry.platform
    const body = entry.body
    return {
      platformId,
      x: platform.x,
      y: platform.y,
      velocityX: body?.velocity.x ?? 0,
      moves: body?.moves ?? false,
      active: platform.active,
      enabled: body?.enable ?? false,
      type: entry.data.type,
      moveDirection: entry.data.moveDirection,
      moveMinX: entry.data.moveMinX,
      moveMaxX: entry.data.moveMaxX,
    }
  }

  private applyDebugElapsed(elapsedMs: number): void {
    if (this.state !== 'running' && this.state !== 'paused' && this.state !== 'countdown') {
      return
    }

    this.survivalMs = Math.max(0, Math.floor(elapsedMs))
    this.difficultySnapshot = getPlatformDifficultySnapshot(this.survivalMs / 1000)
    this.maxDifficulty = Math.max(this.maxDifficulty, Math.floor(this.difficultySnapshot.threatLevel * 10))
    this.peakThreatLevel = Math.max(this.peakThreatLevel, this.difficultySnapshot.threatLevel)
    this.recalculateScore()
    // 调试直接跳时长后，给一个短保护窗口，避免镜头与难度瞬移造成误死。
    this.debugInvulnerableUntil = this.time.now + 9000
    this.emitScoreTick()
  }

  private emitScoreTick(): void {
    this.lastScoreTickTenths = Math.floor(this.survivalMs / 100)
    this.internalBus.emit('onScoreTick', {
      score: this.score,
      survivalMs: Math.floor(this.survivalMs),
      totalLandings: this.totalLandings,
      totalDodged: this.totalLandings,
      // 兼容旧 UI / 测试仍在读取的历史字段。
      spikeDodged: this.totalLandings,
      boulderDodged: 0,
    })
  }

  // spawn telemetry 只保留最近一段样本，供调试救援行与分散生成分布。
  private recordSpawnTelemetry(entry: SpawnTelemetryEntry): void {
    this.spawnTelemetry.push(entry)
    if (this.spawnTelemetry.length > SPAWN_TELEMETRY_LIMIT) {
      this.spawnTelemetry.shift()
    }
  }
}
