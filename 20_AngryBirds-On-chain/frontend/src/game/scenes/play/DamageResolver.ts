import Phaser from 'phaser'
import planck, { type Body, type Contact, type ContactImpulse } from 'planck'

import { playBreakSound } from '../../audio'
import {
  getPigAnimationKey,
  resolvePigVisualState,
  type PigVisualState,
} from '../../characterAnimations'
import { computeImpactDamage, type DamageSourceKind } from '../../damageModel'
import { getPlayfieldGroundSurfaceY } from '../../playfield'
import { computeGroundedSettleState } from '../../settleModel'
import type { LevelCatalogEntry } from '../../types'
import {
  type PhysicsBodyUserData,
  type PlaySceneRuntime,
  type RuntimePiece,
  getBodyData,
  GROUND_SETTLE_ANGULAR_DAMPING_BOOST,
  GROUND_SETTLE_FRICTION_BOOST,
  GROUND_SETTLE_LINEAR_DAMPING_BOOST,
  MEANINGFUL_IMPACT_THRESHOLD,
  PIECE_DAMAGE_ANGULAR_SPEED_THRESHOLD,
  PIECE_DAMAGE_LINEAR_SPEED_THRESHOLD,
  PIG_DEFEAT_FADE_MS,
  PIG_DEFEAT_HOLD_MS,
  PIG_HIT_VISUAL_MS,
} from './runtime'

type DamageResolverOptions = {
  scene: Phaser.Scene
  runtime: PlaySceneRuntime
  getLevel: () => LevelCatalogEntry | null
  toPixels: (meters: number) => number
  onPieceDestroyed: (piece: RuntimePiece, trackRunStats: boolean) => void
  onBeginImpactSettle: (meaningfulImpact: boolean) => void
}

export class DamageResolver {
  private readonly scene: Phaser.Scene
  private readonly runtime: PlaySceneRuntime
  private readonly getLevel: () => LevelCatalogEntry | null
  private readonly toPixels: (meters: number) => number
  private readonly onPieceDestroyed: (piece: RuntimePiece, trackRunStats: boolean) => void
  private readonly onBeginImpactSettle: (meaningfulImpact: boolean) => void

  readonly onPostSolve = (contact: Contact, impulse: ContactImpulse) => {
    const maxImpulse = Math.max(0, ...impulse.normalImpulses, ...impulse.tangentImpulses)
    if (maxImpulse <= 0) {
      return
    }

    const bodyA = contact.getFixtureA().getBody()
    const bodyB = contact.getFixtureB().getBody()
    const pairKey = this.getCollisionPairKey(bodyA, bodyB)
    if (this.runtime.collisionPairsThisStep.has(pairKey)) {
      return
    }
    this.runtime.collisionPairsThisStep.add(pairKey)

    const velocityA = bodyA.getLinearVelocity()
    const velocityB = bodyB.getLinearVelocity()
    const relativeSpeed = Math.hypot(velocityA.x - velocityB.x, velocityA.y - velocityB.y)

    this.noteShotCollisionImpact(bodyA, bodyB, maxImpulse)
    this.applyContactDamage(bodyA, bodyB, maxImpulse, relativeSpeed)
    this.applyContactDamage(bodyB, bodyA, maxImpulse, relativeSpeed)
  }

  constructor({
    scene,
    runtime,
    getLevel,
    toPixels,
    onPieceDestroyed,
    onBeginImpactSettle,
  }: DamageResolverOptions) {
    this.scene = scene
    this.runtime = runtime
    this.getLevel = getLevel
    this.toPixels = toPixels
    this.onPieceDestroyed = onPieceDestroyed
    this.onBeginImpactSettle = onBeginImpactSettle
  }

  // 绑定物理世界碰撞后回调，用于统一伤害结算入口。
  bindWorld() {
    this.runtime.world?.on('post-solve', this.onPostSolve)
  }

  // 解绑碰撞回调，避免场景销毁后访问失效状态。
  cleanup() {
    this.runtime.world?.off('post-solve', this.onPostSolve)
  }

  // 每帧将物理体坐标同步到结构/猪的精灵。
  syncPieceSprites() {
    this.runtime.pieces.forEach((piece) => {
      const position = piece.body.getPosition()
      piece.sprite.setPosition(this.toPixels(position.x), this.toPixels(position.y))
      piece.sprite.setRotation(piece.body.getAngle())
    })
  }

  // 批量应用本帧累计伤害，并处理击毁逻辑。
  processPendingDamage() {
    if (this.runtime.pendingDamage.size === 0) {
      return
    }

    for (const [pieceId, damage] of this.runtime.pendingDamage.entries()) {
      const piece = this.runtime.pieces.get(pieceId)
      if (!piece || piece.destroyed) {
        continue
      }

      if (piece.entityType === 'pig') {
        this.markPigHit(piece)
      }
      piece.hp -= damage
      if (piece.hp <= 0) {
        this.destroyPiece(piece, true)
      }
    }

    this.runtime.pendingDamage.clear()
  }

  // 清理掉出有效游戏区的结构体与猪。
  cleanupStructureOutOfBounds() {
    const level = this.getLevel()
    if (!level) {
      return
    }

    const outOfBoundsY = getPlayfieldGroundSurfaceY(level.world.groundY) + 220
    for (const piece of [...this.runtime.pieces.values()]) {
      const position = piece.body.getPosition()
      const y = this.toPixels(position.y)
      const x = this.toPixels(position.x)
      if (y > outOfBoundsY || x < -200 || x > this.runtime.effectiveRightBoundaryX + 240) {
        this.destroyPiece(piece, this.runtime.hasLaunchedBird)
      }
    }
  }

  // 对贴地低能量物体做“加阻尼 -> 冻结”收敛，稳定残局表现。
  updateGroundedSettling(delta: number) {
    const level = this.getLevel()
    if (!level) {
      return
    }

    const groundSurfaceY = getPlayfieldGroundSurfaceY(level.world.groundY)
    let activeRollingPigCount = 0

    this.runtime.pieces.forEach((piece) => {
      const bodyPosition = piece.body.getPosition()
      const linearSpeed = piece.body.getLinearVelocity().length()
      const angularSpeed = Math.abs(piece.body.getAngularVelocity())
      const bottomY = this.toPixels(bodyPosition.y) + this.getPieceBottomExtent(piece.prefab)
      const settleState = computeGroundedSettleState({
        previousLowEnergyMs: piece.groundedLowEnergyMs,
        deltaMs: delta,
        bottomY,
        groundSurfaceY,
        linearSpeed,
        angularSpeed,
      })

      piece.groundedLowEnergyMs = settleState.lowEnergyMs
      piece.rollingOnGround = settleState.isActivelyRolling

      if (piece.settleBoostActive !== settleState.shouldBoost) {
        this.setPieceSettleBoost(piece, settleState.shouldBoost)
      }

      if (settleState.shouldFreeze) {
        piece.body.setLinearVelocity(planck.Vec2(0, 0))
        piece.body.setAngularVelocity(0)
        piece.body.setAwake(false)
        piece.rollingOnGround = false
      }

      if (piece.entityType === 'pig' && piece.rollingOnGround) {
        activeRollingPigCount += 1
      }
    })

    this.runtime.activeRollingPigCount = activeRollingPigCount
    this.updatePieceVisualStates()
  }

  // 统一角色贴图尺寸/锚点设置。
  configureCharacterSprite(sprite: Phaser.GameObjects.Sprite, width: number, height: number) {
    sprite.setOrigin(0.5, 0.5).setDisplaySize(width, height)
  }

  // 初始化猪的默认动画状态。
  initializePigVisual(piece: RuntimePiece) {
    if (piece.entityType === 'pig') {
      this.setPigVisualState(piece, 'idle', true)
    }
  }

  // 销毁实体并触发对应视觉效果，同时回调上层记录统计。
  destroyPiece(piece: RuntimePiece, trackRunStats: boolean) {
    if (!this.runtime.world || piece.destroyed) {
      return
    }

    if (this.runtime.hasLaunchedBird && piece.entityType === 'pig') {
      playBreakSound(this.scene, piece.audioMaterial, this.scene.time.now)
    }
    piece.destroyed = true
    this.runtime.pieces.delete(piece.id)
    this.runtime.world.destroyBody(piece.body)

    if (piece.entityType === 'pig') {
      piece.visualState = 'defeat'
      piece.sprite.play(getPigAnimationKey('defeat'), true)
      piece.sprite.once(`animationcomplete-${getPigAnimationKey('defeat')}`, () => {
        this.scene.tweens.add({
          targets: piece.sprite,
          delay: PIG_DEFEAT_HOLD_MS,
          alpha: 0,
          duration: PIG_DEFEAT_FADE_MS,
          onComplete: () => {
            piece.sprite.destroy()
          },
        })
      })
    } else {
      this.scene.tweens.add({
        targets: piece.sprite,
        alpha: 0,
        scaleX: 1.18,
        scaleY: 1.18,
        duration: 120,
        onComplete: () => {
          piece.sprite.destroy()
        },
      })
    }

    this.onPieceDestroyed(piece, trackRunStats)
  }

  // 计算 source->target 方向的碰撞伤害并累加到待处理队列。
  private applyContactDamage(sourceBody: Body, targetBody: Body, maxImpulse: number, relativeSpeed: number) {
    const targetData = this.getPieceBodyData(targetBody)
    if (!targetData) {
      return
    }

    const targetPiece = this.runtime.pieces.get(targetData.id)
    if (!targetPiece || targetPiece.destroyed) {
      return
    }

    const sourceKind = this.getDamageSourceKind(sourceBody)
    if (sourceKind === 'piece') {
      if (!this.runtime.hasMeaningfulImpact || !this.isBodyInDamagingMotion(sourceBody)) {
        return
      }
    }

    const damage = computeImpactDamage({
      hasLaunchedBird: this.runtime.hasLaunchedBird,
      sourceKind,
      targetEntityType: targetPiece.entityType,
      maxImpulse,
      relativeSpeed,
    })

    if (damage <= 0) {
      return
    }

    this.runtime.pendingDamage.set(
      targetPiece.id,
      (this.runtime.pendingDamage.get(targetPiece.id) ?? 0) + damage,
    )
  }

  // 记录“有意义碰撞”并通知生命周期控制器进入冲击收敛阶段。
  private noteShotCollisionImpact(bodyA: Body, bodyB: Body, maxImpulse: number) {
    const currentBird = this.runtime.currentBird
    if (!currentBird || !currentBird.launched || maxImpulse < MEANINGFUL_IMPACT_THRESHOLD) {
      return
    }

    const birdBody = currentBird.body
    if (bodyA !== birdBody && bodyB !== birdBody) {
      return
    }

    const otherBody = bodyA === birdBody ? bodyB : bodyA
    const otherKind = this.getDamageSourceKind(otherBody)

    if (otherKind === 'piece') {
      this.onBeginImpactSettle(true)
      return
    }

    if (otherKind === 'ground' || otherKind === 'wall') {
      this.onBeginImpactSettle(false)
    }
  }

  // 更新猪的动画状态。
  private setPigVisualState(piece: RuntimePiece, nextState: PigVisualState, restart = false) {
    if (piece.entityType !== 'pig') {
      return
    }

    if (!restart && piece.visualState === nextState) {
      return
    }

    piece.visualState = nextState
    piece.sprite.play(getPigAnimationKey(nextState), !restart)
  }

  // 碰撞命中猪时先切到 hit 动画，增强反馈。
  private markPigHit(piece: RuntimePiece) {
    if (piece.entityType !== 'pig' || piece.destroyed) {
      return
    }

    piece.hitUntilMs = this.scene.time.now + PIG_HIT_VISUAL_MS
    this.setPigVisualState(piece, 'hit', true)
  }

  // 根据命中窗口刷新猪的 idle/hit 动画状态。
  private updatePieceVisualStates() {
    this.runtime.pieces.forEach((piece) => {
      if (piece.entityType !== 'pig' || piece.destroyed) {
        return
      }

      this.setPigVisualState(
        piece,
        resolvePigVisualState({
          hitUntilMs: piece.hitUntilMs,
          nowMs: this.scene.time.now,
        }),
      )
    })
  }

  // 计算物体底部外沿，供贴地收敛算法使用。
  private getPieceBottomExtent(prefab: RuntimePiece['prefab']) {
    if (prefab.shape === 'circle') {
      return prefab.radius ?? prefab.width / 2
    }
    return prefab.height / 2
  }

  // 动态调整阻尼/摩擦，帮助地面滚动结构更快停稳。
  private setPieceSettleBoost(piece: RuntimePiece, boost: boolean) {
    const baseLinearDamping = piece.prefab.linearDamping ?? 0.08
    const baseAngularDamping = piece.prefab.angularDamping ?? 0.08
    piece.body.setLinearDamping(boost ? baseLinearDamping + GROUND_SETTLE_LINEAR_DAMPING_BOOST : baseLinearDamping)
    piece.body.setAngularDamping(
      boost ? baseAngularDamping + GROUND_SETTLE_ANGULAR_DAMPING_BOOST : baseAngularDamping,
    )
    this.setBodyFriction(
      piece.body,
      boost ? Math.min(piece.prefab.friction + GROUND_SETTLE_FRICTION_BOOST, 1.6) : piece.prefab.friction,
    )
    piece.settleBoostActive = boost
  }

  // 批量修改 body 下所有 fixture 的摩擦系数。
  private setBodyFriction(body: Body, friction: number) {
    for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
      fixture.setFriction(friction)
    }
  }

  // 判断结构体是否仍处于可造成伤害的运动状态。
  private isBodyInDamagingMotion(body: Body) {
    const linearSpeed = body.getLinearVelocity().length()
    const angularSpeed = Math.abs(body.getAngularVelocity())
    return (
      linearSpeed > PIECE_DAMAGE_LINEAR_SPEED_THRESHOLD ||
      angularSpeed > PIECE_DAMAGE_ANGULAR_SPEED_THRESHOLD
    )
  }

  // 从物理体 userData 安全提取 piece 信息。
  private getPieceBodyData(body: Body): PhysicsBodyUserData | null {
    const data = getBodyData(body)
    if (!data || data.kind !== 'piece') {
      return null
    }
    return data
  }

  // 将碰撞来源统一归类为 bird/piece/ground/wall/unknown。
  private getDamageSourceKind(body: Body): DamageSourceKind {
    return (getBodyData(body)?.kind ?? 'unknown') as DamageSourceKind
  }

  // 构造顺序无关的碰撞对 key，避免同帧重复结算。
  private getCollisionPairKey(bodyA: Body, bodyB: Body) {
    const idA = getBodyData(bodyA)?.id ?? 'unknown-a'
    const idB = getBodyData(bodyB)?.id ?? 'unknown-b'
    return [idA, idB].sort().join('::')
  }
}
