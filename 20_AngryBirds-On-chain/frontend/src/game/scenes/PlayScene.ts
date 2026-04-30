import Phaser from 'phaser'
import planck, { type Shape } from 'planck'

import { AngryBirdsBridge } from '../bridge'
import { activateGameplaySceneAudio, deactivateGameplaySceneAudio, syncSceneAudioSettings } from '../audio'
import { ASSET_KEYS, getFrameTextureKey } from '../assets'
import { createBrandFooter, type BrandFooterHandle } from '../brandFooter'
import {
  getPlayfieldGroundBodyCenterY,
  PLAYFIELD_GRASS_DISPLAY_HEIGHT,
  PLAYFIELD_GROUND_HALF_HEIGHT,
} from '../playfield'
import { registerCharacterAnimations } from '../characterAnimations'
import {
  computePlayRightBoundaryLayout,
  computeStructureBounds,
  PLAYFIELD_BOUNDARY_WALL_HALF_WIDTH_PX,
} from '../playBounds'
import { LEVEL_PREFABS, type PrefabDefinition } from '../prefabs'
import { SCENE_KEYS } from '../sceneKeys'
import { BirdLifecycleController } from './play/BirdLifecycleController'
import { DamageResolver } from './play/DamageResolver'
import { EvidenceRecorder } from './play/EvidenceRecorder'
import { HudController } from './play/HudController'
import { PauseMenuCoordinator } from './play/PauseMenuCoordinator'
import {
  countRemainingPigs,
  createInitialPlaySceneRuntime,
  FIXED_TIMESTEP,
  resetPlaySceneRuntime,
  type PhysicsBodyUserData,
  type PlaySceneRuntime,
  type RuntimePiece,
  ZERO_BYTES32,
} from './play/runtime'

export class PlayScene extends Phaser.Scene {
  private readonly bridge: AngryBirdsBridge
  private readonly runtime: PlaySceneRuntime = createInitialPlaySceneRuntime()
  private readonly shouldLogDebugState = import.meta.env.DEV || import.meta.env.MODE === 'test'
  private hudController!: HudController
  private evidenceRecorder!: EvidenceRecorder
  private birdLifecycleController!: BirdLifecycleController
  private damageResolver!: DamageResolver
  private pauseMenuCoordinator!: PauseMenuCoordinator
  private brandFooter?: BrandFooterHandle
  private readonly onScaleResize = (gameSize: Phaser.Structs.Size) => {
    this.applyViewportLayout(gameSize.width, gameSize.height)
  }

  constructor(bridge: AngryBirdsBridge) {
    super(SCENE_KEYS.play)
    this.bridge = bridge
  }

  // 场景主入口：初始化运行态、组装控制器并绑定生命周期事件。
  create() {
    resetPlaySceneRuntime(this.runtime)

    this.runtime.level = this.bridge.getCurrentLevel()
    if (!this.runtime.level) {
      this.scene.start(SCENE_KEYS.title)
      return
    }
    syncSceneAudioSettings(this, this.bridge.getSettings())
    activateGameplaySceneAudio(this)
    const unsubscribeAudioSettings = this.bridge.on('settings:changed', (settings) => {
      syncSceneAudioSettings(this, settings)
    })

    const structureBounds = computeStructureBounds(this.runtime.level)
    this.runtime.structureZoneStartX = Math.min(...this.runtime.level.pieces.map((piece) => piece.x))
    this.runtime.structureRightX = structureBounds.right
    this.cameras.main.setBackgroundColor('#dff3ff')
    this.cameras.main.setBounds(0, 0, this.runtime.level.world.width, this.runtime.level.world.height)
    this.cameras.main.setZoom(this.runtime.level.camera.defaultZoom)

    this.evidenceRecorder = new EvidenceRecorder({
      scene: this,
      runtime: this.runtime,
      bridge: this.bridge,
      getLevel: () => this.runtime.level,
      buildSessionId: () => this.buildSessionId(),
      onHideTrajectoryPreview: () => this.birdLifecycleController.hideTrajectoryPreview(),
      shouldLogDebugState: this.shouldLogDebugState,
    })
    this.damageResolver = new DamageResolver({
      scene: this,
      runtime: this.runtime,
      getLevel: () => this.runtime.level,
      toPixels: (meters) => this.toPixels(meters),
      onPieceDestroyed: (piece, trackRunStats) => this.evidenceRecorder.recordDestroy(piece, trackRunStats),
      onBeginImpactSettle: (meaningfulImpact) => this.birdLifecycleController.beginImpactSettle(meaningfulImpact),
    })
    this.hudController = new HudController({
      scene: this,
      runtime: this.runtime,
      getLevel: () => this.runtime.level,
      getRemainingPigCount: () => this.remainingPigCount(),
      onOpenMenu: () => this.pauseMenuCoordinator.openPauseMenu('settings'),
    })
    this.birdLifecycleController = new BirdLifecycleController({
      scene: this,
      runtime: this.runtime,
      getLevel: () => this.runtime.level,
      getWorld: () => this.runtime.world,
      toMeters: (pixels) => this.toMeters(pixels),
      toPixels: (meters) => this.toPixels(meters),
      toVector: (x, y) => this.toVector(x, y),
      buildShape: (prefab) => this.buildShape(prefab),
      getEffectiveRightBoundaryX: () => this.runtime.effectiveRightBoundaryX,
      getRemainingPigCount: () => this.remainingPigCount(),
      onLaunchRecorded: (bird, launchState) => this.evidenceRecorder.recordLaunch(bird, launchState),
      onCompleteRun: (cleared) => this.evidenceRecorder.completeRun(cleared),
    })
    this.pauseMenuCoordinator = new PauseMenuCoordinator({
      scene: this,
      bridge: this.bridge,
      getCurrentLevelId: () => this.runtime.level?.levelId ?? null,
      isRunCompleted: () => this.runtime.runCompleted,
      onForceWin: (levelId) => this.forceWinCurrentLevel(levelId),
    })

    this.applyViewportLayout()
    registerCharacterAnimations(this)
    this.createBackdrop()
    this.createPlanckWorld()
    this.createPieces()
    this.birdLifecycleController.createSlingshot()
    this.hudController.create()
    this.brandFooter = createBrandFooter(this, { depth: 126 })
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onScaleResize)
    this.birdLifecycleController.createTrajectoryDots()
    this.birdLifecycleController.spawnNextBird()
    this.birdLifecycleController.bindInput()
    this.pauseMenuCoordinator.bind()
    this.forceWinCurrentLevel(this.bridge.consumePendingForceWin(this.runtime.level.levelId))

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      deactivateGameplaySceneAudio(this)
      unsubscribeAudioSettings()
      this.birdLifecycleController.cleanup()
      this.pauseMenuCoordinator.cleanup()
      this.damageResolver.cleanup()
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onScaleResize)
      this.brandFooter?.destroy()
      this.runtime.slingshotRig?.destroy()
      this.runtime.currentBird?.sprite.destroy()
      this.runtime.reserveBirdViews.forEach((entry) => entry.sprite.destroy())
      this.runtime.trajectoryDots.forEach((dot) => dot.destroy())
      this.runtime.pieces.forEach((piece) => {
        piece.sprite.destroy()
      })
      this.runtime.pieces.clear()
      this.runtime.world = null
      this.runtime.currentBird = null
      this.runtime.reserveBirdViews = []
      this.runtime.trajectoryDots = []
      this.runtime.rightWallBody = null
      this.brandFooter = undefined
    })
  }

  // 固定步长驱动物理世界，并串联每帧的结算/录制/HUD 更新。
  update(_time: number, delta: number) {
    if (!this.runtime.level || !this.runtime.world) {
      return
    }

    const clampedDelta = Math.min(delta, 50)
    if (!this.runtime.runCompleted) {
      this.runtime.runElapsedMs += clampedDelta
    }
    this.runtime.accumulator += clampedDelta / 1000

    while (this.runtime.accumulator >= FIXED_TIMESTEP) {
      this.runtime.collisionPairsThisStep.clear()
      this.runtime.world.step(FIXED_TIMESTEP, 8, 3)
      this.runtime.accumulator -= FIXED_TIMESTEP
    }

    this.damageResolver.syncPieceSprites()
    this.birdLifecycleController.syncCurrentBirdSprite()
    this.damageResolver.processPendingDamage()
    this.damageResolver.updateGroundedSettling(clampedDelta)
    this.damageResolver.cleanupStructureOutOfBounds()
    this.birdLifecycleController.cleanupBirdOutOfBounds()
    this.birdLifecycleController.update(clampedDelta)
    this.evidenceRecorder.captureCheckpoint()
    this.hudController.update()
    this.birdLifecycleController.updateSlingshotRig()
  }

  // 绘制关卡背景与前景草地层。
  private createBackdrop() {
    if (!this.runtime.level) {
      return
    }

    const { width, height } = this.runtime.level.world
    this.add.image(width / 2, height / 2, ASSET_KEYS.playBackdropMain).setDisplaySize(width, height).setDepth(-120)
    this.add
      .image(width / 2, height, ASSET_KEYS.playForegroundGrass)
      .setOrigin(0.5, 1)
      .setDisplaySize(width + 40, PLAYFIELD_GRASS_DISPLAY_HEIGHT + 12)
      .setDepth(4)
  }

  // 创建 Planck 物理世界及地面/左右边界墙。
  private createPlanckWorld() {
    if (!this.runtime.level) {
      return
    }

    this.runtime.world = new planck.World(planck.Vec2(0, this.runtime.level.world.gravityY))

    const groundBody = this.runtime.world.createBody()
    groundBody.setUserData({ kind: 'ground', id: 'ground' } satisfies PhysicsBodyUserData)
    groundBody.createFixture(
      planck.Box(
        this.toMeters(this.runtime.level.world.width / 2 + 120),
        this.toMeters(PLAYFIELD_GROUND_HALF_HEIGHT),
      ),
      {
        friction: 1,
        restitution: 0.02,
      },
    )
    groundBody.setPosition(
      planck.Vec2(
        this.toMeters(this.runtime.level.world.width / 2),
        this.toMeters(getPlayfieldGroundBodyCenterY(this.runtime.level.world.groundY)),
      ),
    )

    const leftWall = this.runtime.world.createBody()
    leftWall.setUserData({ kind: 'wall', id: 'left-wall' } satisfies PhysicsBodyUserData)
    leftWall.createFixture(planck.Box(this.toMeters(36), this.toMeters(this.runtime.level.world.height)), {
      friction: 0.2,
    })
    leftWall.setPosition(planck.Vec2(this.toMeters(-40), this.toMeters(this.runtime.level.world.height / 2)))

    const rightWall = this.runtime.world.createBody()
    this.runtime.rightWallBody = rightWall
    rightWall.setUserData({ kind: 'wall', id: 'right-wall' } satisfies PhysicsBodyUserData)
    rightWall.createFixture(
      planck.Box(
        this.toMeters(PLAYFIELD_BOUNDARY_WALL_HALF_WIDTH_PX),
        this.toMeters(this.runtime.level.world.height),
      ),
      {
        friction: 0.2,
      },
    )
    rightWall.setPosition(
      planck.Vec2(
        this.toMeters(this.getRightWallCenterX()),
        this.toMeters(this.runtime.level.world.height / 2),
      ),
    )

    this.damageResolver.bindWorld()
  }

  // 根据关卡 prefab 生成可破坏结构和猪实体。
  private createPieces() {
    if (!this.runtime.level || !this.runtime.world) {
      return
    }

    for (const piece of this.runtime.level.pieces) {
      const prefab = LEVEL_PREFABS[piece.prefabKey]
      const body = this.runtime.world.createDynamicBody({
        position: this.toVector(piece.x, piece.y),
        angle: piece.rotation,
        linearDamping: prefab.linearDamping ?? 0.08,
        angularDamping: prefab.angularDamping ?? 0.08,
      })
      body.createFixture(this.buildShape(prefab), {
        density: prefab.density,
        friction: prefab.friction,
        restitution: prefab.restitution,
      })
      body.setUserData({
        kind: 'piece',
        id: piece.id,
        entityType: piece.entityType,
      } satisfies PhysicsBodyUserData)

      const sprite = this.add
        .sprite(piece.x, piece.y, getFrameTextureKey(prefab.frameId))
        .setRotation(piece.rotation)
        .setDepth(piece.entityType === 'pig' ? 22 : 18)

      if (piece.entityType === 'pig') {
        this.damageResolver.configureCharacterSprite(sprite, prefab.width, prefab.height)
      }

      const runtimePiece: RuntimePiece = {
        id: piece.id,
        entityType: piece.entityType,
        audioMaterial: this.runtime.level.audioMaterials[piece.prefabKey],
        body,
        sprite,
        prefab,
        hp: prefab.hp,
        destroyed: false,
        groundedLowEnergyMs: 0,
        settleBoostActive: false,
        rollingOnGround: false,
        visualState: piece.entityType === 'pig' ? 'idle' : null,
        hitUntilMs: 0,
      }

      this.runtime.pieces.set(piece.id, runtimePiece)
      this.damageResolver.initializePigVisual(runtimePiece)
    }
  }

  // 将关卡 prefab 形状配置映射为 Planck 碰撞体。
  private buildShape(prefab: PrefabDefinition): Shape {
    if (prefab.shape === 'circle') {
      return planck.Circle(this.toMeters(prefab.radius ?? prefab.width / 2))
    }

    if (prefab.shape === 'triangle') {
      const halfWidth = this.toMeters(prefab.width / 2)
      const halfHeight = this.toMeters(prefab.height / 2)
      return planck.Polygon([
        planck.Vec2(0, -halfHeight),
        planck.Vec2(halfWidth, halfHeight),
        planck.Vec2(-halfWidth, halfHeight),
      ])
    }

    return planck.Box(this.toMeters(prefab.width / 2), this.toMeters(prefab.height / 2))
  }

  // 计算视口布局并同步相机、右边界墙与 HUD 位置。
  private applyViewportLayout(width = this.scale.width, height = this.scale.height) {
    if (!this.runtime.level) {
      return
    }

    const camera = this.cameras.main
    camera.setViewport(0, 0, width, height)
    const bounds = computePlayRightBoundaryLayout({
      viewportWidth: width,
      worldWidth: this.runtime.level.world.width,
      defaultZoom: this.runtime.level.camera.defaultZoom,
      cameraMinX: this.runtime.level.camera.minX,
      cameraMaxX: this.runtime.level.camera.maxX,
      structureRightX: this.runtime.structureRightX,
    })
    this.runtime.runtimeCameraZoom = bounds.targetZoom
    this.runtime.effectiveRightBoundaryX = bounds.effectiveRightBoundaryX
    this.runtime.effectiveRightBoundaryScreenX = bounds.effectiveRightBoundaryScreenX
    camera.setZoom(bounds.targetZoom)

    const visibleWorldHeight = height / bounds.targetZoom
    const maxScrollY = Math.max(this.runtime.level.world.height - visibleWorldHeight, 0)

    camera.scrollX = bounds.cameraScrollX
    camera.scrollY = Phaser.Math.Clamp(this.runtime.level.world.height - visibleWorldHeight, 0, maxScrollY)
    if (this.runtime.rightWallBody) {
      this.runtime.rightWallBody.setPosition(
        planck.Vec2(
          this.toMeters(this.getRightWallCenterX()),
          this.toMeters(this.runtime.level.world.height / 2),
        ),
      )
    }
    this.hudController?.layout(width, height)
    this.brandFooter?.layout(width, height)
  }

  // 调试/自动化入口：强制销毁剩余猪并结算为通关。
  private forceWinCurrentLevel(levelId?: string | null) {
    if (!this.runtime.level || this.runtime.runCompleted) {
      return
    }
    if (!levelId || levelId !== this.runtime.level.levelId) {
      return
    }

    this.bridge.consumePendingForceWin(this.runtime.level.levelId)

    const remainingPigs = [...this.runtime.pieces.values()].filter((piece) => piece.entityType === 'pig')
    for (const pig of remainingPigs) {
      this.damageResolver.destroyPiece(pig, true)
    }
    this.runtime.birdsUsed = Math.max(this.runtime.birdsUsed, 1)
    if (this.shouldLogDebugState) {
      console.info('[angry-birds] force-win', {
        birdsUsed: this.runtime.birdsUsed,
        destroyedPigs: this.runtime.destroyedPigs,
      })
    }
    this.evidenceRecorder.completeRun(true)
  }

  // 当前版本先返回固定 sessionId，后续可替换为真实会话签名 ID。
  private buildSessionId(): `0x${string}` {
    return ZERO_BYTES32
  }

  private getRightWallCenterX() {
    const boundaryX =
      this.runtime.effectiveRightBoundaryX > 0
        ? this.runtime.effectiveRightBoundaryX
        : this.runtime.level?.world.width ?? 0
    return boundaryX + PLAYFIELD_BOUNDARY_WALL_HALF_WIDTH_PX
  }

  private remainingPigCount() {
    return countRemainingPigs(this.runtime.pieces)
  }

  private toMeters(pixels: number) {
    if (!this.runtime.level) {
      return pixels
    }
    return pixels / this.runtime.level.world.pixelsPerMeter
  }

  private toPixels(meters: number) {
    if (!this.runtime.level) {
      return meters
    }
    return meters * this.runtime.level.world.pixelsPerMeter
  }

  private toVector(x: number, y: number) {
    return planck.Vec2(this.toMeters(x), this.toMeters(y))
  }

  // 暴露运行时调试快照，供测试与开发工具读取。
  public getDebugRuntimeState() {
    const camera = this.cameras.main
    const toScreenPoint = (x: number, y: number) => ({
      x: (x - camera.scrollX) * camera.zoom,
      y: (y - camera.scrollY) * camera.zoom,
    })

    return {
      runCompleted: this.runtime.runCompleted,
      elapsedTimeMs: Math.max(Math.round(this.runtime.runElapsedMs), 0),
      effectiveRightBoundaryX: this.runtime.effectiveRightBoundaryX,
      effectiveRightBoundaryScreenX: this.runtime.effectiveRightBoundaryScreenX,
      cameraZoom: this.runtime.runtimeCameraZoom,
      birdsUsed: this.runtime.birdsUsed,
      destroyedPigs: this.runtime.destroyedPigs,
      pieceCount: this.runtime.pieces.size,
      remainingPigCount: this.remainingPigCount(),
      reserveBirdCount: this.runtime.reserveBirdViews.length,
      reserveBirdSlots: this.runtime.reserveBirdViews.map(({ slot }) => ({
        birdType: slot.birdType,
        x: slot.x,
        y: slot.y,
        scale: slot.scale,
        alpha: slot.alpha,
      })),
      shotPhase: this.runtime.shotPhase,
      hasMeaningfulImpact: this.runtime.hasMeaningfulImpact,
      timeSinceImpactMs:
        this.runtime.impactSettleStartedAt === null
          ? null
          : Math.max(Math.round(this.time.now - this.runtime.impactSettleStartedAt), 0),
      birdRetireReason: this.runtime.lastBirdRetireReason,
      activeRollingPigCount: this.runtime.activeRollingPigCount,
      launchVector: this.runtime.lastLaunchState
        ? {
            x: this.runtime.lastLaunchState.velocityPxPerSecond.x,
            y: this.runtime.lastLaunchState.velocityPxPerSecond.y,
            magnitudePxPerSecond: Math.hypot(
              this.runtime.lastLaunchState.velocityPxPerSecond.x,
              this.runtime.lastLaunchState.velocityPxPerSecond.y,
            ),
            pullDistancePx: this.runtime.lastLaunchState.distancePx,
            clampedPoint: this.runtime.lastLaunchState.clampedPoint,
          }
        : null,
      slingshot: this.runtime.slingshotRig
        ? {
            isReady: true,
            birdRest: {
              x: this.runtime.slingshotRig.layout.birdRest.x,
              y: this.runtime.slingshotRig.layout.birdRest.y,
              screen: toScreenPoint(
                this.runtime.slingshotRig.layout.birdRest.x,
                this.runtime.slingshotRig.layout.birdRest.y,
              ),
            },
            rearBandAnchor: {
              x: this.runtime.slingshotRig.layout.rearBandAnchor.x,
              y: this.runtime.slingshotRig.layout.rearBandAnchor.y,
            },
            frontBandAnchor: {
              x: this.runtime.slingshotRig.layout.frontBandAnchor.x,
              y: this.runtime.slingshotRig.layout.frontBandAnchor.y,
            },
          }
        : {
            isReady: false,
            birdRest: null,
            rearBandAnchor: null,
            frontBandAnchor: null,
          },
      currentBird: this.runtime.currentBird
        ? {
            id: this.runtime.currentBird.id,
            birdType: this.runtime.currentBird.birdType,
            launched: this.runtime.currentBird.launched,
            x: this.runtime.currentBird.sprite.x,
            y: this.runtime.currentBird.sprite.y,
            screen: toScreenPoint(this.runtime.currentBird.sprite.x, this.runtime.currentBird.sprite.y),
          }
        : null,
    }
  }
}
