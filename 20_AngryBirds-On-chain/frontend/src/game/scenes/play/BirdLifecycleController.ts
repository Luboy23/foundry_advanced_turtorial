import Phaser from 'phaser'
import planck, { type World } from 'planck'

import { playLaunchSound } from '../../audio'
import { ASSET_KEYS, getFrameTextureKey } from '../../assets'
import {
  getBirdAnimationKey,
  resolveBirdVisualState,
  type BirdVisualState,
} from '../../characterAnimations'
import { buildLaunchState as createLaunchState, type LaunchState } from '../../launchModel'
import { getPlayfieldGroundSurfaceY } from '../../playfield'
import { LEVEL_PREFABS, PREFAB_KEYS, type PrefabDefinition } from '../../prefabs'
import { buildReserveBirdSlots } from '../../reserveBirdQueue'
import { createSlingshotRig } from '../../slingshot'
import type { BirdType, LevelCatalogEntry } from '../../types'
import {
  type BirdRetireReason,
  type PlaySceneRuntime,
  type RuntimeBird,
  IMPACT_SETTLE_TIMEOUT_MS,
  NEXT_BIRD_READY_DELAY_MS,
  STATIONARY_RETIRE_MS,
  STRUCTURE_ZONE_BUFFER_X,
  STRUCTURE_ZONE_MIN_FLIGHT_MS,
  STRUCTURE_ZONE_SLOW_SPEED,
} from './runtime'

const BIRD_PREFAB_BY_TYPE: Record<BirdType, string> = {
  red: PREFAB_KEYS.birdRed,
}

type BirdLifecycleControllerOptions = {
  scene: Phaser.Scene
  runtime: PlaySceneRuntime
  getLevel: () => LevelCatalogEntry | null
  getWorld: () => World | null
  toMeters: (pixels: number) => number
  toPixels: (meters: number) => number
  toVector: (x: number, y: number) => planck.Vec2
  buildShape: (prefab: PrefabDefinition) => planck.Shape
  getEffectiveRightBoundaryX: () => number
  getRemainingPigCount: () => number
  onLaunchRecorded: (bird: RuntimeBird, launchState: LaunchState) => void
  onCompleteRun: (cleared: boolean) => void
}

export class BirdLifecycleController {
  private readonly scene: Phaser.Scene
  private readonly runtime: PlaySceneRuntime
  private readonly getLevel: () => LevelCatalogEntry | null
  private readonly getWorld: () => World | null
  private readonly toMeters: (pixels: number) => number
  private readonly toPixels: (meters: number) => number
  private readonly toVector: (x: number, y: number) => planck.Vec2
  private readonly buildShape: BirdLifecycleControllerOptions['buildShape']
  private readonly getEffectiveRightBoundaryX: () => number
  private readonly getRemainingPigCount: () => number
  private readonly onLaunchRecorded: BirdLifecycleControllerOptions['onLaunchRecorded']
  private readonly onCompleteRun: (cleared: boolean) => void

  constructor({
    scene,
    runtime,
    getLevel,
    getWorld,
    toMeters,
    toPixels,
    toVector,
    buildShape,
    getEffectiveRightBoundaryX,
    getRemainingPigCount,
    onLaunchRecorded,
    onCompleteRun,
  }: BirdLifecycleControllerOptions) {
    this.scene = scene
    this.runtime = runtime
    this.getLevel = getLevel
    this.getWorld = getWorld
    this.toMeters = toMeters
    this.toPixels = toPixels
    this.toVector = toVector
    this.buildShape = buildShape
    this.getEffectiveRightBoundaryX = getEffectiveRightBoundaryX
    this.getRemainingPigCount = getRemainingPigCount
    this.onLaunchRecorded = onLaunchRecorded
    this.onCompleteRun = onCompleteRun
  }

  // 创建弹弓可视化组件（前/后皮筋与锚点）。
  createSlingshot() {
    const level = this.getLevel()
    if (!level) {
      return
    }

    this.runtime.slingshotRig?.destroy()
    this.runtime.slingshotRig = createSlingshotRig(this.scene, level.slingshot.anchorX, level.slingshot.anchorY)
  }

  // 创建拖拽预览轨迹点。
  createTrajectoryDots() {
    for (let index = 0; index < 10; index += 1) {
      const dot = this.scene.add
        .image(-1000, -1000, ASSET_KEYS.trajectoryDot)
        .setScale(0.55 - index * 0.025)
        .setAlpha(0)
        .setDepth(10)
      this.runtime.trajectoryDots.push(dot)
    }
  }

  // 绑定拖拽发射输入事件。
  bindInput() {
    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this)
    this.scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this)
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this)
    this.scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this)
  }

  // 解绑输入事件，防止场景销毁后残留回调。
  cleanup() {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this)
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this)
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this)
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this)
  }

  // 根据剩余队列重建待发射小鸟预览。
  refreshReserveBirdQueue() {
    const level = this.getLevel()
    if (!level) {
      return
    }

    this.runtime.reserveBirdViews.forEach((entry) => entry.sprite.destroy())
    this.runtime.reserveBirdViews = []

    const groundSurfaceY = getPlayfieldGroundSurfaceY(level.world.groundY)
    const slots = buildReserveBirdSlots({
      anchorX: level.slingshot.anchorX,
      groundSurfaceY,
      birdQueue: level.birdQueue,
      nextBirdIndex: this.runtime.nextBirdIndex,
    })

    this.runtime.reserveBirdViews = slots.map((slot) => {
      const prefabKey = BIRD_PREFAB_BY_TYPE[slot.birdType]
      const sprite = this.scene.add
        .sprite(slot.x, slot.y, getFrameTextureKey(LEVEL_PREFABS[prefabKey].frameId))
        .setDepth(12)
        .setDisplaySize(LEVEL_PREFABS[prefabKey].width, LEVEL_PREFABS[prefabKey].height)
        .setScale(slot.scale)
        .setAlpha(slot.alpha)
      return { slot, sprite }
    })
  }

  // 生成下一只可发射小鸟，并复位发射阶段状态机。
  spawnNextBird() {
    const level = this.getLevel()
    const world = this.getWorld()
    if (!level || !world || this.runtime.nextBirdIndex >= level.birdQueue.length) {
      return false
    }

    const birdType = level.birdQueue[this.runtime.nextBirdIndex]
    const prefabKey = BIRD_PREFAB_BY_TYPE[birdType]
    const prefab = LEVEL_PREFABS[prefabKey]
    const birdId = `bird-${this.runtime.nextBirdIndex + 1}`
    const body = world.createDynamicBody({
      position: this.toVector(level.slingshot.anchorX, level.slingshot.anchorY),
      linearDamping: prefab.linearDamping ?? 0.12,
      angularDamping: prefab.angularDamping ?? 0.1,
      bullet: true,
    })
    body.createFixture(this.buildShape(prefab), {
      density: prefab.density,
      friction: prefab.friction,
      restitution: prefab.restitution,
    })
    body.setUserData({ kind: 'bird', id: birdId })
    body.setGravityScale(0)
    body.setAwake(false)

    const sprite = this.scene.add
      .sprite(level.slingshot.anchorX, level.slingshot.anchorY, getFrameTextureKey(prefab.frameId))
      .setDepth(28)
    this.configureCharacterSprite(sprite, prefab.width, prefab.height)

    this.runtime.currentBird = {
      id: birdId,
      birdType,
      birdIndex: this.runtime.nextBirdIndex,
      body,
      sprite,
      launched: false,
      stationaryMs: 0,
      visualState: 'idle',
    }
    this.runtime.nextBirdIndex += 1
    this.runtime.shotPhase = 'idle'
    this.runtime.launchStartedAt = null
    this.runtime.impactSettleStartedAt = null
    this.runtime.hasMeaningfulImpact = false
    this.refreshReserveBirdQueue()
    this.snapBirdToAnchor()
    this.setBirdVisualState('idle', true)
    return true
  }

  // 将当前小鸟物理状态同步到渲染层。
  syncCurrentBirdSprite() {
    const currentBird = this.runtime.currentBird
    if (!currentBird) {
      return
    }

    const position = currentBird.body.getPosition()
    currentBird.sprite.setPosition(this.toPixels(position.x), this.toPixels(position.y))
    currentBird.sprite.setRotation(currentBird.body.getAngle())
    this.syncCurrentBirdVisualState()
  }

  // 每帧推进回合生命周期：判胜、判超时、判出界、补鸟/失败。
  update(delta: number) {
    const level = this.getLevel()
    if (!level || this.runtime.runCompleted) {
      return
    }

    if (this.runtime.hasLaunchedBird && this.getRemainingPigCount() === 0) {
      this.runtime.pendingClearAt ??= this.scene.time.now + 420
      if (this.scene.time.now >= this.runtime.pendingClearAt) {
        this.onCompleteRun(true)
        return
      }
    } else {
      this.runtime.pendingClearAt = null
    }

    const currentBird = this.runtime.currentBird
    if (currentBird && currentBird.launched) {
      const speed = currentBird.body.getLinearVelocity().length()
      const angularVelocity = Math.abs(currentBird.body.getAngularVelocity())
      const birdX = this.toPixels(currentBird.body.getPosition().x)

      if (
        !this.runtime.impactSettleStartedAt &&
        this.runtime.launchStartedAt !== null &&
        this.scene.time.now - this.runtime.launchStartedAt >= STRUCTURE_ZONE_MIN_FLIGHT_MS &&
        birdX >= this.runtime.structureZoneStartX - STRUCTURE_ZONE_BUFFER_X &&
        speed <= STRUCTURE_ZONE_SLOW_SPEED
      ) {
        this.beginImpactSettle(false)
      }

      if (speed < 0.95 && angularVelocity < 1.15) {
        currentBird.stationaryMs += delta
      } else {
        currentBird.stationaryMs = 0
      }

      if (currentBird.stationaryMs > STATIONARY_RETIRE_MS) {
        this.consumeCurrentBird('stationary')
        return
      }

      if (
        this.runtime.impactSettleStartedAt !== null &&
        this.scene.time.now - this.runtime.impactSettleStartedAt >= IMPACT_SETTLE_TIMEOUT_MS
      ) {
        this.consumeCurrentBird('impact-settle-timeout')
      }
    }

    if (!this.runtime.currentBird && this.scene.time.now >= this.runtime.nextBirdReadyAt) {
      if (this.runtime.pendingClearAt !== null) {
        return
      }

      if (!this.spawnNextBird()) {
        this.onCompleteRun(false)
      }
    }
  }

  // 处理当前小鸟飞出有效边界的淘汰逻辑。
  cleanupBirdOutOfBounds() {
    const currentBird = this.runtime.currentBird
    const level = this.getLevel()
    if (!currentBird || !level) {
      return
    }

    const birdPosition = currentBird.body.getPosition()
    const birdX = this.toPixels(birdPosition.x)
    const birdY = this.toPixels(birdPosition.y)

    if (
      currentBird.launched &&
      (birdX < -220 || birdX > this.getEffectiveRightBoundaryX() + 260 || birdY > level.world.height + 220)
    ) {
      this.consumeCurrentBird('out-of-bounds')
    }
  }

  // 动态更新弹弓皮筋目标点，实现拉弓与回弹视觉。
  updateSlingshotRig() {
    const level = this.getLevel()
    const currentBird = this.runtime.currentBird
    const slingshotRig = this.runtime.slingshotRig
    if (!level || !slingshotRig) {
      return
    }

    if (currentBird && (!currentBird.launched || this.distanceBirdToAnchor() < level.slingshot.maxDrag + 28)) {
      slingshotRig.setBandTarget({
        x: currentBird.sprite.x,
        y: currentBird.sprite.y,
      })
      return
    }

    slingshotRig.setBandTarget(null)
  }

  // 隐藏轨迹预览点，避免切场景或发射后残留。
  hideTrajectoryPreview() {
    this.runtime.trajectoryDots.forEach((dot) => {
      dot.setAlpha(0)
      dot.setPosition(-1000, -1000)
    })
  }

  // 进入冲击结算阶段，用于等待连锁碰撞收敛后再回收小鸟。
  beginImpactSettle(meaningfulImpact: boolean) {
    this.runtime.impactSettleStartedAt ??= this.scene.time.now
    this.runtime.hasMeaningfulImpact = this.runtime.hasMeaningfulImpact || meaningfulImpact
    if (this.runtime.shotPhase !== 'retired') {
      this.runtime.shotPhase = 'impact-settle'
    }
  }

  // 开始拖拽：锁定 pointer、切换状态并暂停小鸟物理。
  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    const level = this.getLevel()
    const currentBird = this.runtime.currentBird
    if (!level || !currentBird || currentBird.launched || this.runtime.runCompleted) {
      return
    }

    const dragHitRadius = this.runtime.slingshotRig?.layout.dragHitRadius ?? 48
    if (this.distanceToBird(pointer.worldX, pointer.worldY) > dragHitRadius) {
      return
    }

    this.runtime.isDraggingBird = true
    this.runtime.activePointerId = pointer.id
    this.runtime.lastLaunchState = null
    this.runtime.lastBirdRetireReason = null
    this.runtime.shotPhase = 'dragging'
    this.runtime.dragPointer.set(pointer.worldX, pointer.worldY)
    currentBird.body.setLinearVelocity(planck.Vec2(0, 0))
    currentBird.body.setAngularVelocity(0)
    currentBird.body.setAwake(false)
    this.syncCurrentBirdVisualState()
  }

  // 拖拽中实时计算拉弓向量并更新轨迹预览。
  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    const currentBird = this.runtime.currentBird
    if (
      !this.getLevel() ||
      !currentBird ||
      currentBird.launched ||
      !this.runtime.isDraggingBird ||
      this.runtime.activePointerId !== pointer.id
    ) {
      return
    }

    const launchState = this.buildLaunchState(pointer.worldX, pointer.worldY)
    if (!launchState) {
      return
    }

    this.runtime.dragPointer.set(launchState.clampedPoint.x, launchState.clampedPoint.y)
    currentBird.body.setTransform(this.toVector(launchState.clampedPoint.x, launchState.clampedPoint.y), 0)
    currentBird.body.setLinearVelocity(planck.Vec2(0, 0))
    currentBird.body.setAngularVelocity(0)
    this.syncCurrentBirdSprite()
    this.updateTrajectoryPreview(launchState)
  }

  // 松手发射：计算速度、激活重力、记账并通知证据录制器。
  private handlePointerUp(pointer: Phaser.Input.Pointer) {
    const level = this.getLevel()
    const currentBird = this.runtime.currentBird
    if (!level || !currentBird || !this.runtime.isDraggingBird || this.runtime.activePointerId !== pointer.id) {
      return
    }

    this.runtime.isDraggingBird = false
    this.runtime.activePointerId = null

    const launchState = this.buildLaunchState(pointer.worldX, pointer.worldY)
    if (!launchState) {
      return
    }

    this.runtime.dragPointer.set(launchState.clampedPoint.x, launchState.clampedPoint.y)
    if (launchState.distancePx < 12) {
      this.snapBirdToAnchor()
      this.hideTrajectoryPreview()
      return
    }

    currentBird.body.setTransform(this.toVector(launchState.clampedPoint.x, launchState.clampedPoint.y), 0)
    currentBird.launched = true
    this.runtime.hasLaunchedBird = true
    currentBird.stationaryMs = 0
    this.runtime.lastLaunchState = launchState
    this.runtime.shotPhase = 'flying'
    this.runtime.launchStartedAt = this.scene.time.now
    this.runtime.impactSettleStartedAt = null
    this.runtime.hasMeaningfulImpact = false
    this.runtime.lastBirdRetireReason = null
    currentBird.body.setGravityScale(1)
    currentBird.body.setAwake(true)
    currentBird.body.setLinearVelocity(
      planck.Vec2(launchState.velocityMetersPerSecond.x, launchState.velocityMetersPerSecond.y),
    )
    currentBird.body.applyAngularImpulse(0.45, true)
    this.setBirdVisualState('launch', true)
    playLaunchSound(this.scene, this.scene.time.now)
    this.onLaunchRecorded(currentBird, launchState)
    this.runtime.birdsUsed += 1
    this.hideTrajectoryPreview()
  }

  // 小鸟回到弹弓锚点待命状态。
  private snapBirdToAnchor() {
    const level = this.getLevel()
    const currentBird = this.runtime.currentBird
    if (!level || !currentBird) {
      return
    }

    currentBird.body.setTransform(this.toVector(level.slingshot.anchorX, level.slingshot.anchorY), 0)
    currentBird.body.setLinearVelocity(planck.Vec2(0, 0))
    currentBird.body.setAngularVelocity(0)
    currentBird.body.setGravityScale(0)
    currentBird.body.setAwake(false)
    this.runtime.shotPhase = 'idle'
    this.syncCurrentBirdSprite()
    this.setBirdVisualState('idle')
  }

  // 回收当前小鸟并安排下一只生成时机。
  private consumeCurrentBird(reason: BirdRetireReason) {
    const world = this.getWorld()
    const currentBird = this.runtime.currentBird
    if (!world || !currentBird) {
      return
    }

    world.destroyBody(currentBird.body)
    currentBird.sprite.destroy()
    this.runtime.currentBird = null
    this.runtime.shotPhase = 'retired'
    this.runtime.lastBirdRetireReason = reason
    this.runtime.launchStartedAt = null
    this.hideTrajectoryPreview()
    this.runtime.nextBirdReadyAt = this.scene.time.now + NEXT_BIRD_READY_DELAY_MS
  }

  // 设置小鸟动画状态，必要时允许重播同名动画。
  private setBirdVisualState(nextState: BirdVisualState, restart = false) {
    const currentBird = this.runtime.currentBird
    if (!currentBird) {
      return
    }

    if (!restart && currentBird.visualState === nextState) {
      return
    }

    currentBird.visualState = nextState
    currentBird.sprite.play(getBirdAnimationKey(nextState), !restart)
  }

  // 按当前交互/发射状态自动推导并同步视觉状态。
  private syncCurrentBirdVisualState() {
    const currentBird = this.runtime.currentBird
    if (!currentBird) {
      return
    }

    this.setBirdVisualState(
      resolveBirdVisualState({
        isDragging: this.runtime.isDraggingBird,
        launched: currentBird.launched,
      }),
    )
  }

  // 根据抛体公式绘制轨迹预测点。
  private updateTrajectoryPreview(launchState: LaunchState) {
    const level = this.getLevel()
    if (!level) {
      return
    }

    const { x: velocityX, y: velocityY } = launchState.velocityMetersPerSecond
    const startX = this.toMeters(launchState.clampedPoint.x)
    const startY = this.toMeters(launchState.clampedPoint.y)
    const gravityY = level.world.gravityY

    this.runtime.trajectoryDots.forEach((dot, index) => {
      const time = 0.12 * (index + 1)
      const worldX = startX + velocityX * time
      const worldY = startY + velocityY * time + 0.5 * gravityY * time * time
      dot.setPosition(this.toPixels(worldX), this.toPixels(worldY))
      dot.setAlpha(0.82 - index * 0.06)
    })
  }

  // 计算指针到小鸟中心的距离，用于拖拽命中判定。
  private distanceToBird(worldX: number, worldY: number) {
    const currentBird = this.runtime.currentBird
    if (!currentBird) {
      return Number.POSITIVE_INFINITY
    }
    return Phaser.Math.Distance.Between(worldX, worldY, currentBird.sprite.x, currentBird.sprite.y)
  }

  // 计算小鸟到弹弓锚点的距离。
  private distanceBirdToAnchor() {
    const level = this.getLevel()
    const currentBird = this.runtime.currentBird
    if (!level || !currentBird) {
      return 0
    }

    return Phaser.Math.Distance.Between(
      level.slingshot.anchorX,
      level.slingshot.anchorY,
      currentBird.sprite.x,
      currentBird.sprite.y,
    )
  }

  // 封装发射参数计算，统一拉弓到速度的转换规则。
  private buildLaunchState(pointerX: number, pointerY: number) {
    const level = this.getLevel()
    if (!level) {
      return null
    }

    return createLaunchState({
      anchorX: level.slingshot.anchorX,
      anchorY: level.slingshot.anchorY,
      pointerX,
      pointerY,
      maxDrag: level.slingshot.maxDrag,
      launchVelocityScale: level.slingshot.launchVelocityScale,
      pixelsPerMeter: level.world.pixelsPerMeter,
    })
  }

  // 统一角色贴图尺寸/锚点设置。
  private configureCharacterSprite(sprite: Phaser.GameObjects.Sprite, width: number, height: number) {
    sprite.setOrigin(0.5, 0.5).setDisplaySize(width, height)
  }
}
