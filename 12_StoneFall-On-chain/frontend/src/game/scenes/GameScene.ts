/**
 * 模块职责：实现核心玩法循环，包括角色移动、障碍生成、碰撞判定和结算流程。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import Phaser from 'phaser'
import { TypedEventBus } from '../events/TypedEventBus'
import {
  BOULDER_TEXTURE_COUNT,
  BOULDER_TEXTURE_PREFIX,
  INK_SPLASH_TEXTURE_KEY,
  INK_WASH_TEXTURE_KEY,
  PAPER_TEXTURE_KEY,
  SPIKE_TEXTURE_KEY,
  STICKMAN_ANIM,
  STICKMAN_IDLE_FRAMES,
} from '../entities/assetKeys'
import type {
  DifficultySnapshot,
  GameCommandPayloads,
  GameEvents,
  GameState,
  InputMode,
  InputSource,
  SessionStats,
} from '../types'
import {
  getDifficultySnapshot,
} from '../../shared/game/difficulty'
import { clamp } from '../../shared/utils/math'
import { resolveHazardExitReason } from '../../shared/game/hazardBounds'
import { getHazardDodgeScore } from '../../shared/game/scoring'
import {
  buildBoulderMotionConfig,
  buildSpikeMotionConfig,
} from '../systems/hazardPhysics'
import {
  resolveMovementAxisFromSources,
  resolvePointerAxisFromPosition,
} from '../systems/inputResolver'
import {
  resolveAxisFromVelocity,
  resolveTouchFollowVelocity,
} from '../systems/touchFollow'
import {
  getMaxSpawnGapMs,
  getSpawnRatePerSec,
  resolveSpawnBurstCount,
  sampleNextSpawnGapMs,
} from '../systems/spawnCadence'
import {
  chooseLane,
  createSpawnDistributionState,
  laneToSpawnX,
  registerSpawnLane,
  resetSpawnDistributionState,
} from '../systems/spawnDistribution'

type GameSceneOptions = {
  internalBus: TypedEventBus<GameEvents>
  commandBus: TypedEventBus<GameCommandPayloads>
}

const PLAYER_SPEED = 620
const PLAYER_DISPLAY_WIDTH = 56
const PLAYER_DISPLAY_HEIGHT = 126
const RUN_MAX_TILT_DEG = 10
const RUN_MAX_SCALE_X_DELTA = 0.08
const RUN_MAX_SCALE_Y_DELTA = 0.055
const WORLD_WIDTH = 1280
const WORLD_HEIGHT = 720
const HAZARD_SPAWN_MIN_X = 42
const HAZARD_SPAWN_MAX_X = 1238
const HAZARD_LANE_COUNT = 9
const SPAWN_STALL_COMPENSATION_MS = 120
const SPAWN_TELEMETRY_LIMIT = 256
const MOUSE_DEAD_ZONE_PX = 6
const TOUCH_FOLLOW_DEAD_ZONE_PX = 10
const TOUCH_FOLLOW_GAIN = 2.4
const TOUCH_FOLLOW_LERP = 0.2
const TOUCH_FOLLOW_MAX_DELTA_PX = 460
const HIT_STAGGER_MS = 260
const DEATH_SHOWCASE_MS = 2100
const DEATH_FALL_TWEEN_MS = 1500
const DEATH_PULSE_TWEEN_MS = 320
const SPAWN_SAFE_RADIUS_MIN = 100
const SPAWN_SAFE_RADIUS_MAX = 176
const SPAWN_SAFE_RADIUS_THREAT_SCALE = 7
const STATIONARY_VELOCITY_EPSILON = 18
const ANTI_CAMP_TRIGGER_MS = 12000
const ANTI_CAMP_COOLDOWN_MS = 2600
const ANTI_CAMP_TARGET_JITTER_PX = 10

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

/**
 * 类实现：GameScene。
 */
export class GameScene extends Phaser.Scene {
  private readonly internalBus: TypedEventBus<GameEvents>
  private readonly commandBus: TypedEventBus<GameCommandPayloads>

  private state: GameState = 'idle'
  private inputMode: InputMode = 'auto'
  private touchAxis: -1 | 0 | 1 = 0
  private touchTargetX: number | null = null
  private mouseAxis: -1 | 0 | 1 = 0
  private keyboardAxis: -1 | 0 | 1 = 0
  private isMousePointerDown = false
  private recentInputSource: InputSource = 'keyboard'
  private lastInputSource: InputSource = 'keyboard'
  private playerPose: 'idle' | 'run' | 'hit' | 'death' = 'idle'

  private player!: Phaser.Physics.Arcade.Sprite
  private hazards!: Phaser.Physics.Arcade.Group
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
  private spikeSpawned = 0
  private boulderSpawned = 0
  private spikeDodged = 0
  private boulderDodged = 0
  private lastScoreTickTenths = -1
  private activeHazardCount = 0
  private spawnDistribution = createSpawnDistributionState(HAZARD_LANE_COUNT)
  private spawnTelemetry: SpawnTelemetryEntry[] = []
  private elapsedSinceSpawnMs = 0
  private nextSpawnGapMs = 260
  private lastDoubleSpawnAtMs = -Number.MAX_SAFE_INTEGER
  private stationaryDurationMs = 0
  private lastAntiCampSpawnAtMs = -Number.MAX_SAFE_INTEGER

  private difficultySnapshot: DifficultySnapshot = getDifficultySnapshot(0)

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

  /**
   * create：初始化场景资源与运行时对象。
   */
  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
    this.createInkBackdrop()

    this.hazards = this.physics.add.group({
      maxSize: 220,
      allowGravity: false,
      immovable: true,
    })

    this.player = this.physics.add.sprite(640, 637, STICKMAN_IDLE_FRAMES[0])
    this.player.setDisplaySize(PLAYER_DISPLAY_WIDTH, PLAYER_DISPLAY_HEIGHT)
    this.player.setDepth(3)
    this.player.setImmovable(true)
    this.player.setCollideWorldBounds(true)
    this.setIdleStaticPose()

    this.configurePlayerBody()

    this.physics.add.overlap(
      this.player,
      this.hazards,
      this.handleCollision,
      undefined,
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

  /**
   * update：逐帧更新游戏状态。
   */
  update(_: number, delta: number): void {
    if (this.paperLayer) {
      this.paperLayer.tilePositionY += delta * 0.002
      this.paperLayer.tilePositionX += delta * 0.0007
    }
    if (this.inkWashLayer) {
      this.inkWashLayer.tilePositionX += delta * 0.00025
    }

    this.cleanupOutOfBoundsHazards()

    if (this.state === 'running' && !this.isEndingRound) {
      this.survivalMs += delta

      const nextDifficulty = getDifficultySnapshot(this.survivalMs / 1000)
      this.updateDifficulty(nextDifficulty)
      this.updateSpawnCadence(delta)
      const currentTenths = Math.floor(this.survivalMs / 100)
      if (currentTenths !== this.lastScoreTickTenths) {
        this.emitScoreTick()
      }
    }

    if ((this.state === 'running' || this.state === 'paused') && !this.isEndingRound) {
      this.updatePlayerMovement(delta)
    }
  }

  /**
   * configurePlayerBody：配置底层对象参数。
   */
  private configurePlayerBody(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    body.setSize(22, 62)
    body.setOffset(
      (this.player.displayWidth - body.width) / 2,
      this.player.displayHeight * 0.37,
    )
    const horizontalPadding = (PLAYER_DISPLAY_WIDTH - body.width) * 0.5
    body.setBoundsRectangle(
      new Phaser.Geom.Rectangle(
        horizontalPadding,
        0,
        WORLD_WIDTH - horizontalPadding * 2,
        WORLD_HEIGHT,
      ),
    )
  }

  /**
   * createInkBackdrop：初始化场景资源与运行时对象。
   */
  private createInkBackdrop(): void {
    this.inkWashLayer = this.add
      .tileSprite(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, WORLD_WIDTH, WORLD_HEIGHT, INK_WASH_TEXTURE_KEY)
      .setDepth(0)
      .setAlpha(0.2)

    this.paperLayer = this.add
      .tileSprite(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, WORLD_WIDTH, WORLD_HEIGHT, PAPER_TEXTURE_KEY)
      .setDepth(1)
      .setAlpha(0.16)
  }

  /**
   * updateDifficulty：逐帧更新游戏状态。
   */
  private updateDifficulty(nextDifficulty: DifficultySnapshot): void {
    const changed =
      nextDifficulty.activeCap !== this.difficultySnapshot.activeCap ||
      nextDifficulty.fallSpeed !== this.difficultySnapshot.fallSpeed ||
      nextDifficulty.spawnIntervalMs !== this.difficultySnapshot.spawnIntervalMs ||
      nextDifficulty.threatLevel !== this.difficultySnapshot.threatLevel ||
      nextDifficulty.spikeRatio !== this.difficultySnapshot.spikeRatio

    if (!changed) {
      return
    }

    this.difficultySnapshot = nextDifficulty
    this.maxDifficulty = Math.max(this.maxDifficulty, nextDifficulty.activeCap)
    this.peakThreatLevel = Math.max(this.peakThreatLevel, nextDifficulty.threatLevel)
    this.internalBus.emit('onDifficultyTick', nextDifficulty)
  }

  /**
   * registerCommandHandlers：注册事件监听或命令处理。
   */
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
        this.inputMode = payload.mode

        if (payload.mode === 'keyboard') {
          this.touchAxis = 0
          this.touchTargetX = null
          this.clearMouseInput()
        } else if (payload.mode === 'touch') {
          this.clearMouseInput()
          if (typeof payload.targetX === 'number') {
            this.touchTargetX = clamp(payload.targetX, 0, WORLD_WIDTH)
            this.markRecentInputSource('touch')
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
          }
        }
      }),
      this.commandBus.on('setAudioSettings', () => {
        // 音频由 React 层管理，场景层仅保留命令接口一致性。
      }),
      this.commandBus.on('debugForceGameOver', () => {
        if (this.state === 'running' && !this.isEndingRound) {
          this.hitCount = 1
          this.beginHitAndGameOver()
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
    )
  }

  /**
   * registerPointerHandlers：注册事件监听或命令处理。
   */
  private registerPointerHandlers(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this)
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this)
    this.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this)
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this)
    this.input.on(Phaser.Input.Events.GAME_OUT, this.handlePointerCancel, this)
  }

  /**
   * beginCountdown：启动一个阶段性流程。
   */
  private beginCountdown(resetRound: boolean): void {
    this.clearRoundEndTimers()
    this.stopSpawnLoop()
    this.stopCountdown()
    this.isEndingRound = false
    this.tweens.killTweensOf(this.player)
    this.resetPlayerPresentation()

    if (resetRound) {
      this.resetRoundData()
      this.resetHazards()
      this.player.setPosition(640, 637)
      this.player.setVelocity(0, 0)
      this.player.setAlpha(1)
      this.player.clearTint()
      this.setIdleStaticPose()
    }

    this.physics.world.pause()
    this.setState('countdown')

    let countdownValue = 3
    this.internalBus.emit('onCountdown', { value: countdownValue })

    this.countdownTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        countdownValue -= 1
        this.internalBus.emit('onCountdown', { value: Math.max(0, countdownValue) })

        if (countdownValue <= 0) {
          this.stopCountdown()
          this.enterRunningState()
        }
      },
    })
  }

  /**
   * enterRunningState：封装局部可复用逻辑。
   */
  private enterRunningState(): void {
    this.physics.world.resume()
    this.setState('running')
    this.initializeSpawnCadence()
  }

  /**
   * pauseGame：暂停当前流程。
   */
  private pauseGame(): void {
    if (this.state !== 'running' || this.isEndingRound) {
      return
    }

    this.stopSpawnLoop()
    this.player.setVelocity(0, 0)
    this.resetPlayerPresentation()
    this.setIdleStaticPose()
    this.physics.world.pause()
    this.setState('paused')
  }

  /**
   * initializeSpawnCadence：封装局部可复用逻辑。
   */
  private initializeSpawnCadence(): void {
    const rate = getSpawnRatePerSec(this.difficultySnapshot.threatLevel)
    const maxGap = getMaxSpawnGapMs(this.difficultySnapshot.threatLevel)
    this.elapsedSinceSpawnMs = 0
    this.nextSpawnGapMs = Math.min(sampleNextSpawnGapMs(rate), maxGap)
  }

  /**
   * updateSpawnCadence：逐帧更新游戏状态。
   */
  private updateSpawnCadence(deltaMs: number): void {
    this.elapsedSinceSpawnMs += deltaMs
    const maxGap = getMaxSpawnGapMs(this.difficultySnapshot.threatLevel)
    const isDueByCadence = this.elapsedSinceSpawnMs >= this.nextSpawnGapMs
    const isDueByHardCap = this.elapsedSinceSpawnMs >= maxGap

    if (!isDueByCadence && !isDueByHardCap) {
      return
    }

    const spawned = this.spawnCadenceEvent()
    if (spawned) {
      const rate = getSpawnRatePerSec(this.difficultySnapshot.threatLevel)
      this.elapsedSinceSpawnMs = 0
      this.nextSpawnGapMs = Math.min(sampleNextSpawnGapMs(rate), maxGap)
      return
    }

    // Short compensation window only; avoids long starvation without backlog bursts.
    this.elapsedSinceSpawnMs = Math.min(
      this.elapsedSinceSpawnMs,
      maxGap + SPAWN_STALL_COMPENSATION_MS,
    )
  }

  /**
   * spawnCadenceEvent：生成新对象并注入场景。
   */
  private spawnCadenceEvent(): boolean {
    if (this.state !== 'running' || this.isEndingRound) {
      return false
    }

    const snapshot = this.difficultySnapshot
    const activeCount = this.countActiveHazards()
    const availableSlots = snapshot.activeCap - activeCount

    if (availableSlots <= 0) {
      return false
    }

    const nowMs = this.time.now
    const spawnCount = resolveSpawnBurstCount({
      threatLevel: snapshot.threatLevel,
      availableSlots,
      sinceLastDoubleMs: nowMs - this.lastDoubleSpawnAtMs,
    })

    if (spawnCount <= 0) {
      return false
    }
    const burstCount = spawnCount as 1 | 2

    const safeRadius = this.resolveSafeSpawnRadius(snapshot)
    let firstLane: number | undefined
    let spawnedAtLeastOne = false
    const shouldApplyAntiCampPressure = this.shouldApplyAntiCampPressure(nowMs)

    for (let index = 0; index < burstCount; index += 1) {
      if (index === 0 && shouldApplyAntiCampPressure) {
        const x = this.resolveAntiCampSpawnX()
        const lane = this.resolveLaneFromX(x)
        const didSpawn = this.spawnSingleHazard(snapshot, x, lane, burstCount)
        if (didSpawn) {
          registerSpawnLane({
            state: this.spawnDistribution,
            laneIndex: lane,
            nowMs,
            laneCount: HAZARD_LANE_COUNT,
          })
          this.lastAntiCampSpawnAtMs = nowMs
          spawnedAtLeastOne = true
          firstLane = lane
          continue
        }
      }

      const lane = chooseLane({
        state: this.spawnDistribution,
        nowMs,
        minX: HAZARD_SPAWN_MIN_X,
        maxX: HAZARD_SPAWN_MAX_X,
        playerX: this.player.x,
        safeRadius,
        threatLevel: snapshot.threatLevel,
        laneCount: HAZARD_LANE_COUNT,
        excludeLane: index === 0 ? undefined : firstLane,
        minLaneDistance: index === 0 ? undefined : 2,
        preferOppositeOfLane: index === 0 ? undefined : firstLane,
      })
      const x = laneToSpawnX({
        laneIndex: lane,
        minX: HAZARD_SPAWN_MIN_X,
        maxX: HAZARD_SPAWN_MAX_X,
        laneCount: HAZARD_LANE_COUNT,
      })
      const didSpawn = this.spawnSingleHazard(snapshot, x, lane, burstCount)
      spawnedAtLeastOne = spawnedAtLeastOne || didSpawn

      if (index === 0) {
        firstLane = lane
      }
    }

    if (spawnedAtLeastOne && burstCount === 2) {
      this.lastDoubleSpawnAtMs = nowMs
    }

    return spawnedAtLeastOne
  }

  /**
   * spawnSingleHazard：生成新对象并注入场景。
   */
  private spawnSingleHazard(
    snapshot: DifficultySnapshot,
    x: number,
    lane: number,
    spawnCount: 1 | 2,
  ): boolean {
    if (this.state !== 'running' || this.isEndingRound) {
      return false
    }

    const hazardType = Phaser.Math.FloatBetween(0, 1) < snapshot.spikeRatio ? 'spike' : 'boulder'
    const textureKey =
      hazardType === 'spike'
        ? SPIKE_TEXTURE_KEY
        : `${BOULDER_TEXTURE_PREFIX}-${Phaser.Math.Between(0, BOULDER_TEXTURE_COUNT - 1)}`

    const y = -Phaser.Math.Between(36, 88)

    const hazard = this.hazards.get(x, y, textureKey) as Phaser.Physics.Arcade.Sprite | null
    if (!hazard) {
      return false
    }

    const wasInactive = !hazard.active
    if (wasInactive) {
      this.activeHazardCount += 1
    }
    // 回收对象使用 disableBody(true, true) 退出场景；复用时必须显式重新启用 body，
    // 否则 sprite 虽然 visible/active，但物理仍停用，重开后就会出现“障碍不下落”。
    hazard.enableBody(true, x, y, true, true)
    hazard.setTexture(textureKey)
    hazard.setDepth(2)
    hazard.setData('hazardType', hazardType)
    this.recordSpawnTelemetry({
      timestampMs: Math.round(this.time.now),
      lane,
      x: Math.round(x),
      count: spawnCount,
    })

    if (hazardType === 'spike') {
      this.configureSpike(hazard, snapshot)
      this.spikeSpawned += 1
    } else {
      this.configureBoulder(hazard, snapshot)
      this.boulderSpawned += 1
    }

    return true
  }

  /**
   * configureSpike：配置底层对象参数。
   */
  private configureSpike(hazard: Phaser.Physics.Arcade.Sprite, snapshot: DifficultySnapshot): void {
    const config = buildSpikeMotionConfig(snapshot)
    hazard.setDisplaySize(config.width, config.height)
    hazard.setAngle(config.angle)

    const body = hazard.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(true)
    body.setGravityY(config.gravityY)
    body.setMaxVelocity(0, config.terminalVelocityY)
    body.setVelocity(config.velocityX, config.velocityY)
    body.setAngularVelocity(config.angularVelocity)
    body.setSize(config.bodyWidth, config.bodyHeight)
    body.setOffset(config.bodyOffsetX, config.bodyOffsetY)
  }

  /**
   * configureBoulder：配置底层对象参数。
   */
  private configureBoulder(hazard: Phaser.Physics.Arcade.Sprite, snapshot: DifficultySnapshot): void {
    const config = buildBoulderMotionConfig(snapshot)
    hazard.setDisplaySize(config.size, config.size)
    hazard.setAngle(config.angle)

    const body = hazard.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(true)
    body.setGravityY(config.gravityY)
    body.setMaxVelocity(0, config.terminalVelocityY)
    body.setVelocity(config.velocityX, config.velocityY)
    body.setAngularVelocity(config.angularVelocity)
    body.setSize(config.bodyWidth, config.bodyHeight)
    body.setOffset(config.bodyOffsetX, config.bodyOffsetY)
  }

  /**
   * updatePlayerMovement：逐帧更新游戏状态。
   */
  private updatePlayerMovement(deltaMs: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body

    const leftPressed = Boolean(this.cursors?.left.isDown || this.keyA?.isDown)
    const rightPressed = Boolean(this.cursors?.right.isDown || this.keyD?.isDown)

    let nextKeyboardAxis: -1 | 0 | 1 = 0
    if (leftPressed && !rightPressed) {
      nextKeyboardAxis = -1
    } else if (rightPressed && !leftPressed) {
      nextKeyboardAxis = 1
    }

    if (nextKeyboardAxis !== this.keyboardAxis) {
      this.keyboardAxis = nextKeyboardAxis
      if (nextKeyboardAxis !== 0) {
        this.markRecentInputSource('keyboard')
      }
    }

    const axis = this.resolveMovementAxis()
    const touchFollowVelocity = this.resolveTouchFollowTargetVelocity()
    const targetVelocityX = touchFollowVelocity ?? axis * PLAYER_SPEED

    if (this.state !== 'running') {
      body.setVelocityX(0)
      this.player.setFlipX(false)
      this.applyRunPresentation(0, 0)
      this.setIdleStaticPose()
      this.stationaryDurationMs = 0
      return
    }

    const smoothing = touchFollowVelocity === null ? 0.24 : TOUCH_FOLLOW_LERP
    const smoothedVelocity = Phaser.Math.Linear(body.velocity.x, targetVelocityX, smoothing)
    body.setVelocityX(Math.abs(smoothedVelocity) < 3 ? 0 : smoothedVelocity)
    this.clampPlayerToVisibleBounds(body)
    const displayAxis = resolveAxisFromVelocity(targetVelocityX)

    if (displayAxis < 0) {
      this.player.setFlipX(true)
    } else if (displayAxis > 0) {
      this.player.setFlipX(false)
    }

    if (displayAxis === 0) {
      this.player.setFlipX(false)
      const speedAbs = Math.abs(body.velocity.x)
      this.applyRunPresentation(0, speedAbs)
      this.setIdleStaticPose()
      if (speedAbs <= STATIONARY_VELOCITY_EPSILON) {
        this.stationaryDurationMs += deltaMs
      } else {
        this.stationaryDurationMs = 0
      }
      return
    }

    this.stationaryDurationMs = 0
    this.applyRunPresentation(displayAxis, Math.abs(body.velocity.x))
    this.playRunPose()
  }

  /**
   * applyRunPresentation：封装局部可复用逻辑。
   */
  private applyRunPresentation(axis: -1 | 0 | 1, speedAbs: number): void {
    const speedRatio = clamp(speedAbs / PLAYER_SPEED, 0, 1)
    const targetAngle = axis === 0 ? 0 : axis * (4.6 + RUN_MAX_TILT_DEG * speedRatio)
    const targetScaleX = axis === 0 ? 1 : 1 + RUN_MAX_SCALE_X_DELTA * speedRatio
    const targetScaleY = axis === 0 ? 1 : 1 - RUN_MAX_SCALE_Y_DELTA * speedRatio
    const animationRate = axis === 0 ? 1 : 1 + speedRatio * 0.4

    this.player.setAngle(Phaser.Math.Linear(this.player.angle, targetAngle, 0.22))
    this.player.setScale(
      Phaser.Math.Linear(this.player.scaleX, targetScaleX, 0.22),
      Phaser.Math.Linear(this.player.scaleY, targetScaleY, 0.22),
    )
    this.player.anims.timeScale = animationRate
  }

  /**
   * resetPlayerPresentation：重置运行时状态到初始值。
   */
  private resetPlayerPresentation(): void {
    this.player.setAngle(0)
    this.player.setScale(1, 1)
    this.player.setAlpha(1)
    this.player.anims.timeScale = 1
  }

  /**
   * setIdleStaticPose：设置当前状态或属性。
   */
  private setIdleStaticPose(): void {
    if (this.playerPose === 'idle') {
      return
    }
    this.player.anims.stop()
    this.player.setTexture(STICKMAN_IDLE_FRAMES[0])
    this.playerPose = 'idle'
  }

  /**
   * playRunPose：封装局部可复用逻辑。
   */
  private playRunPose(): void {
    if (this.playerPose === 'run') {
      return
    }
    this.player.anims.play(STICKMAN_ANIM.run, true)
    this.playerPose = 'run'
  }

  /**
   * clampPlayerToVisibleBounds：封装局部可复用逻辑。
   */
  private clampPlayerToVisibleBounds(body: Phaser.Physics.Arcade.Body): void {
    const halfVisibleWidth = this.player.displayWidth * 0.5
    const minX = halfVisibleWidth
    const maxX = WORLD_WIDTH - halfVisibleWidth
    const clampedX = clamp(this.player.x, minX, maxX)

    if (clampedX === this.player.x) {
      return
    }

    body.reset(clampedX, this.player.y)
  }

  /**
   * resolveMovementAxis：根据输入解析目标结果。
   */
  private resolveMovementAxis(): -1 | 0 | 1 {
    return resolveMovementAxisFromSources({
      inputMode: this.inputMode,
      recentInputSource: this.recentInputSource,
      keyboardAxis: this.keyboardAxis,
      touchAxis: this.touchAxis,
      mouseAxis: this.mouseAxis,
    })
  }

  /**
   * resolveTouchFollowTargetVelocity：根据输入解析目标结果。
   */
  private resolveTouchFollowTargetVelocity(): number | null {
    if (this.inputMode !== 'touch' || this.touchTargetX === null) {
      return null
    }

    return resolveTouchFollowVelocity({
      targetX: this.touchTargetX,
      playerX: this.player.x,
      maxDeltaPx: TOUCH_FOLLOW_MAX_DELTA_PX,
      deadZonePx: TOUCH_FOLLOW_DEAD_ZONE_PX,
      gain: TOUCH_FOLLOW_GAIN,
      maxSpeed: PLAYER_SPEED,
    })
  }

  /**
   * markRecentInputSource：封装局部可复用逻辑。
   */
  private markRecentInputSource(source: InputSource): void {
    this.recentInputSource = source
    this.lastInputSource = source
  }

  /**
   * handlePointerDown：处理事件回调并更新状态。
   */
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

  /**
   * handlePointerMove：处理事件回调并更新状态。
   */
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

  /**
   * handlePointerUp：处理事件回调并更新状态。
   */
  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.isMousePointer(pointer)) {
      return
    }

    this.clearMouseInput()
  }

  /**
   * handlePointerCancel：处理事件回调并更新状态。
   */
  private handlePointerCancel(): void {
    this.clearMouseInput()
  }

  /**
   * updateMouseAxisFromPointer：逐帧更新游戏状态。
   */
  private updateMouseAxisFromPointer(pointer: Phaser.Input.Pointer): void {
    const axis = this.resolvePointerAxis(pointer)
    this.mouseAxis = axis

    if (axis !== 0) {
      this.markRecentInputSource('mouse')
    }
  }

  /**
   * resolvePointerAxis：根据输入解析目标结果。
   */
  private resolvePointerAxis(pointer: Phaser.Input.Pointer): -1 | 0 | 1 {
    return resolvePointerAxisFromPosition(
      pointer.worldX,
      this.player.x,
      MOUSE_DEAD_ZONE_PX,
    )
  }

  /**
   * clearMouseInput：封装局部可复用逻辑。
   */
  private clearMouseInput(): void {
    this.mouseAxis = 0
    this.isMousePointerDown = false
  }

  /**
   * isMousePointer：封装局部可复用逻辑。
   */
  private isMousePointer(pointer: Phaser.Input.Pointer): boolean {
    return !pointer.wasTouch
  }

  /**
   * cleanupOutOfBoundsHazards：清理失效对象，避免状态污染。
   */
  private cleanupOutOfBoundsHazards(): void {
    for (const child of this.hazards.getChildren()) {
      const hazard = child as Phaser.Physics.Arcade.Sprite
      if (!hazard.active) {
        continue
      }

      const exitReason = resolveHazardExitReason(
        hazard.x,
        hazard.y,
        hazard.displayWidth,
        hazard.displayHeight,
      )

      if (exitReason === 'bottom') {
        this.onHazardDodged(hazard)
        this.disableHazard(hazard)
        continue
      }

      if (exitReason === 'side') {
        this.disableHazard(hazard)
      }
    }
  }

  /**
   * onHazardDodged：封装局部可复用逻辑。
   */
  private onHazardDodged(hazard: Phaser.Physics.Arcade.Sprite): void {
    if (this.state !== 'running' || this.isEndingRound) {
      return
    }

    const hazardType = hazard.getData('hazardType')
    if (hazardType !== 'spike' && hazardType !== 'boulder') {
      return
    }

    this.score += getHazardDodgeScore(hazardType)
    if (hazardType === 'spike') {
      this.spikeDodged += 1
    } else {
      this.boulderDodged += 1
    }
    this.emitScoreTick()
  }

  /**
   * countActiveHazards：封装局部可复用逻辑。
   */
  private countActiveHazards(): number {
    return this.activeHazardCount
  }

  private handleCollision = (
    _: ArcadeOverlapTarget,
    hazardObject: ArcadeOverlapTarget,
  ): void => {
    if (this.state !== 'running' || this.isEndingRound) {
      return
    }
    if (this.time.now < this.debugInvulnerableUntil) {
      return
    }

    this.hitCount = 1
    let hazardSource: Phaser.Physics.Arcade.Sprite | undefined
    if (hazardObject instanceof Phaser.Physics.Arcade.Sprite) {
      hazardSource = hazardObject
    } else if (
      'gameObject' in (hazardObject as object) &&
      (hazardObject as { gameObject?: unknown }).gameObject instanceof
        Phaser.Physics.Arcade.Sprite
    ) {
      const maybeGameObject = (hazardObject as { gameObject?: unknown }).gameObject
      if (maybeGameObject instanceof Phaser.Physics.Arcade.Sprite) {
        hazardSource = maybeGameObject
      }
    }
    this.beginHitAndGameOver(hazardSource)
  }

  /**
   * beginHitAndGameOver：启动一个阶段性流程。
   */
  private beginHitAndGameOver(sourceHazard?: Phaser.Physics.Arcade.Sprite): void {
    this.isEndingRound = true
    this.internalBus.emit('onPlayerHit', {
      delayMs: 0,
    })
    this.clearRoundEndTimers()
    this.stopCountdown()
    this.stopSpawnLoop()
    this.physics.world.pause()
    this.tweens.killTweensOf(this.player)

    const sourceX = sourceHazard?.x ?? this.player.x + 1
    const knockDirection = this.player.x < sourceX ? -1 : 1

    this.player.setVelocity(0, 0)
    this.player.setAlpha(1)
    this.spawnInkImpact(this.player.x, this.player.y - 24)
    this.player.anims.timeScale = 1
    this.player.anims.play(STICKMAN_ANIM.hit, true)
    this.playerPose = 'hit'
    this.cameras.main.shake(110, 0.0026, true)

    this.tweens.add({
      targets: this.player,
      x: clamp(this.player.x + knockDirection * 42, 74, 1206),
      y: this.player.y - 20,
      angle: knockDirection * 7,
      duration: 170,
      ease: 'Sine.easeOut',
    })

    this.addRoundEndTimer(HIT_STAGGER_MS, () => {
      this.player.anims.timeScale = 0.92
      this.player.anims.play(STICKMAN_ANIM.death, true)
      this.playerPose = 'death'
      this.spawnInkImpact(this.player.x + knockDirection * 14, this.player.y - 8)

      this.tweens.add({
        targets: this.player,
        x: clamp(this.player.x + knockDirection * 20, 74, 1206),
        y: this.player.y + 34,
        angle: knockDirection * 56,
        duration: DEATH_FALL_TWEEN_MS,
        ease: 'Cubic.easeInOut',
      })

      const pulseRepeat = Math.max(
        1,
        Math.floor(DEATH_SHOWCASE_MS / (DEATH_PULSE_TWEEN_MS * 2)) - 1,
      )
      this.tweens.add({
        targets: this.player,
        alpha: 0.72,
        duration: DEATH_PULSE_TWEEN_MS,
        yoyo: true,
        repeat: pulseRepeat,
        ease: 'Sine.easeInOut',
      })
    })

    this.addRoundEndTimer(HIT_STAGGER_MS + DEATH_SHOWCASE_MS, () => {
      this.gameOver()
    })
  }

  /**
   * spawnInkImpact：生成新对象并注入场景。
   */
  private spawnInkImpact(x: number, y: number): void {
    const splash = this.add
      .image(x, y, INK_SPLASH_TEXTURE_KEY)
      .setDepth(4)
      .setScale(0.24)
      .setAlpha(0.38)

    this.tweens.add({
      targets: splash,
      scale: 1.26,
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => {
        splash.destroy()
      },
    })
  }

  /**
   * gameOver：封装局部可复用逻辑。
   */
  private gameOver(): void {
    this.clearRoundEndTimers()
    this.stopCountdown()
    this.stopSpawnLoop()
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
      spikeSpawned: this.spikeSpawned,
      boulderSpawned: this.boulderSpawned,
      spikeDodged: this.spikeDodged,
      boulderDodged: this.boulderDodged,
      totalDodged: this.spikeDodged + this.boulderDodged,
    }

    this.internalBus.emit('onSessionStats', stats)
    this.internalBus.emit('onGameOver', {
      stats,
      inputType: this.lastInputSource,
    })
  }

  /**
   * returnToIdleState：回到初始或上一级状态。
   */
  private returnToIdleState(): void {
    this.clearRoundEndTimers()
    this.stopCountdown()
    this.stopSpawnLoop()
    this.isEndingRound = false
    this.tweens.killTweensOf(this.player)
    this.resetPlayerPresentation()
    this.resetRoundData()
    this.resetHazards()
    this.player.setPosition(640, 637)
    this.player.setVelocity(0, 0)
    this.player.setAlpha(1)
    this.player.clearTint()
    this.setIdleStaticPose()
    this.physics.world.pause()
    this.setState('idle')
  }

  /**
   * setState：设置当前状态或属性。
   */
  private setState(nextState: GameState): void {
    this.state = nextState
    if (nextState !== 'running') {
      this.clearMouseInput()
    }
    this.internalBus.emit('onGameState', { state: nextState })
  }

  /**
   * resetRoundData：重置运行时状态到初始值。
   */
  private resetRoundData(): void {
    this.score = 0
    this.survivalMs = 0
    this.maxDifficulty = 4
    this.peakThreatLevel = 1
    this.hitCount = 0
    this.spikeSpawned = 0
    this.boulderSpawned = 0
    this.spikeDodged = 0
    this.boulderDodged = 0
    this.lastScoreTickTenths = -1
    this.activeHazardCount = 0
    resetSpawnDistributionState(this.spawnDistribution)
    this.spawnTelemetry = []
    this.elapsedSinceSpawnMs = 0
    this.lastDoubleSpawnAtMs = -Number.MAX_SAFE_INTEGER
    this.stationaryDurationMs = 0
    this.lastAntiCampSpawnAtMs = -Number.MAX_SAFE_INTEGER
    this.touchAxis = 0
    this.touchTargetX = null
    this.mouseAxis = 0
    this.keyboardAxis = 0
    this.isMousePointerDown = false
    this.recentInputSource = 'keyboard'
    this.lastInputSource = 'keyboard'
    this.isEndingRound = false
    this.debugInvulnerableUntil = 0
    this.clearRoundEndTimers()
    this.difficultySnapshot = getDifficultySnapshot(0)
    this.initializeSpawnCadence()

    this.emitScoreTick()
    this.internalBus.emit('onDifficultyTick', this.difficultySnapshot)
  }

  /**
   * resetHazards：重置运行时状态到初始值。
   */
  private resetHazards(): void {
    for (const child of this.hazards.getChildren()) {
      this.disableHazard(child as Phaser.Physics.Arcade.Sprite)
    }
  }

  /**
   * resolveSafeSpawnRadius：根据输入解析目标结果。
   */
  private resolveSafeSpawnRadius(snapshot: DifficultySnapshot): number {
    return clamp(
      SPAWN_SAFE_RADIUS_MIN + snapshot.threatLevel * SPAWN_SAFE_RADIUS_THREAT_SCALE,
      SPAWN_SAFE_RADIUS_MIN,
      SPAWN_SAFE_RADIUS_MAX,
    )
  }

  /**
   * recordSpawnTelemetry：封装局部可复用逻辑。
   */
  private recordSpawnTelemetry(entry: SpawnTelemetryEntry): void {
    this.spawnTelemetry.push(entry)
    if (this.spawnTelemetry.length > SPAWN_TELEMETRY_LIMIT) {
      this.spawnTelemetry.shift()
    }
  }

  /**
   * shouldApplyAntiCampPressure：封装局部可复用逻辑。
   */
  private shouldApplyAntiCampPressure(nowMs: number): boolean {
    if (this.stationaryDurationMs < ANTI_CAMP_TRIGGER_MS) {
      return false
    }

    return nowMs - this.lastAntiCampSpawnAtMs >= ANTI_CAMP_COOLDOWN_MS
  }

  /**
   * resolveAntiCampSpawnX：根据输入解析目标结果。
   */
  private resolveAntiCampSpawnX(): number {
    return Math.round(
      clamp(
        this.player.x + Phaser.Math.FloatBetween(-ANTI_CAMP_TARGET_JITTER_PX, ANTI_CAMP_TARGET_JITTER_PX),
        HAZARD_SPAWN_MIN_X,
        HAZARD_SPAWN_MAX_X,
      ),
    )
  }

  /**
   * resolveLaneFromX：根据输入解析目标结果。
   */
  private resolveLaneFromX(x: number): number {
    const laneWidth = (HAZARD_SPAWN_MAX_X - HAZARD_SPAWN_MIN_X) / HAZARD_LANE_COUNT
    const laneIndex = Math.floor((x - HAZARD_SPAWN_MIN_X) / laneWidth)
    return clamp(laneIndex, 0, HAZARD_LANE_COUNT - 1)
  }

  /**
   * stopCountdown：封装局部可复用逻辑。
   */
  private stopCountdown(): void {
    this.countdownTimer?.remove(false)
    this.countdownTimer = undefined
  }

  /**
   * stopSpawnLoop：封装局部可复用逻辑。
   */
  private stopSpawnLoop(): void {
    this.elapsedSinceSpawnMs = 0
  }

  /**
   * addRoundEndTimer：封装局部可复用逻辑。
   */
  private addRoundEndTimer(delay: number, callback: () => void): void {
    const timer = this.time.delayedCall(delay, callback)
    this.roundEndTimers.push(timer)
  }

  /**
   * clearRoundEndTimers：封装局部可复用逻辑。
   */
  private clearRoundEndTimers(): void {
    for (const timer of this.roundEndTimers) {
      timer.remove(false)
    }
    this.roundEndTimers = []
  }

  /**
   * disableHazard：封装局部可复用逻辑。
   */
  private disableHazard(hazard: Phaser.Physics.Arcade.Sprite): void {
    if (!hazard.active) {
      return
    }

    hazard.disableBody(true, true)
    this.activeHazardCount = Math.max(0, this.activeHazardCount - 1)
  }

  /**
   * handleBlur：处理事件回调并更新状态。
   */
  private handleBlur(): void {
    if (this.state === 'running' && !this.isEndingRound) {
      this.pauseByBlur = true
      this.pauseGame()
    }
  }

  /**
   * handleFocus：处理事件回调并更新状态。
   */
  private handleFocus(): void {
    if (this.pauseByBlur && this.state === 'paused' && !this.isEndingRound) {
      this.pauseByBlur = false
      this.beginCountdown(false)
    }
  }

  /**
   * handleShutdown：处理事件回调并更新状态。
   */
  private handleShutdown(): void {
    this.clearRoundEndTimers()
    this.stopCountdown()
    this.stopSpawnLoop()
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

  /**
   * debugGetPlayerX：封装局部可复用逻辑。
   */
  public debugGetPlayerX(): number {
    return this.player?.x ?? 0
  }

  /**
   * debugGetPlayerVelocityX：封装局部可复用逻辑。
   */
  public debugGetPlayerVelocityX(): number {
    const body = this.player?.body as Phaser.Physics.Arcade.Body | undefined
    return body?.velocity.x ?? 0
  }

  /**
   * debugGetSpawnTelemetry：封装局部可复用逻辑。
   */
  public debugGetSpawnTelemetry(): Array<{
    timestampMs: number
    lane: number
    x: number
    count: 1 | 2
  }> {
    return this.spawnTelemetry.slice()
  }

  /**
   * applyDebugElapsed：封装局部可复用逻辑。
   */
  private applyDebugElapsed(elapsedMs: number): void {
    if (this.state !== 'running' && this.state !== 'paused' && this.state !== 'countdown') {
      return
    }

    this.survivalMs = Math.max(0, Math.floor(elapsedMs))
    this.difficultySnapshot = getDifficultySnapshot(this.survivalMs / 1000)
    this.maxDifficulty = Math.max(this.maxDifficulty, this.difficultySnapshot.activeCap)
    this.peakThreatLevel = Math.max(
      this.peakThreatLevel,
      this.difficultySnapshot.threatLevel,
    )

    this.internalBus.emit('onDifficultyTick', this.difficultySnapshot)
    // Only for debug flow: keep a safety window after threat jump so telemetry tests remain stable.
    this.debugInvulnerableUntil = this.time.now + 9000
    this.emitScoreTick()
  }

  /**
   * emitScoreTick：向外部总线分发事件。
   */
  private emitScoreTick(): void {
    this.lastScoreTickTenths = Math.floor(this.survivalMs / 100)
    this.internalBus.emit('onScoreTick', {
      score: this.score,
      survivalMs: Math.floor(this.survivalMs),
      spikeDodged: this.spikeDodged,
      boulderDodged: this.boulderDodged,
      totalDodged: this.spikeDodged + this.boulderDodged,
    })
  }
}
