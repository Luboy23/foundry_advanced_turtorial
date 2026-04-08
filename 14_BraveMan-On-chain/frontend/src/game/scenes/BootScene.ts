import Phaser from 'phaser'
import {
  ARROW_TEXTURE,
  ARROW_TRAIL_FRAMES,
  CHARGER_CHARGE_FRAMES,
  CHARGER_DEATH_FRAMES,
  CHARGER_MOVE_FRAMES,
  CHARGER_TELL_FRAMES,
  CHASER_DEATH_FRAMES,
  CHASER_MOVE_FRAMES,
  ENEMY_ANIM,
  HERO_ANIM,
  HERO_HOOK_SPEAR_ATTACK_FRAMES,
  HERO_HOOK_SPEAR_IDLE_FRAMES,
  HERO_HOOK_SPEAR_MOVE_FRAMES,
  HERO_BOW_ATTACK_FRAMES,
  HERO_BOW_IDLE_FRAMES,
  HERO_BOW_MOVE_FRAMES,
  HERO_DEATH_FRAMES,
  HERO_SWORD_ATTACK_FRAMES,
  HERO_SWORD_IDLE_FRAMES,
  HERO_SWORD_MOVE_FRAMES,
  SWORD_SLASH_FRAMES,
} from '../entities/assetKeys'

type StickmanPose = {
  armSwing: number
  legSwing: number
  bodyTilt: number
  headYOffset: number
  cloakLift?: number
  swordAngle?: number
  swordReach?: number
  swordBladeScale?: number
  swordGuardScale?: number
  swordGripScale?: number
  swordHandX?: number
  swordHandY?: number
  supportHandX?: number
  supportHandY?: number
  torsoDrop?: number
  frontFootX?: number
  frontFootY?: number
  backFootX?: number
  backFootY?: number
  fallenSwordX?: number
  fallenSwordY?: number
  fallenSwordAngle?: number
  bowRaise?: number
  drawStrength?: number
  bowHandX?: number
  bowHandY?: number
  drawHandX?: number
  drawHandY?: number
  bowAngle?: number
  bowLength?: number
  nockArrow?: boolean
  arrowDrift?: number
  hookSpearAngle?: number
  hookSpearReach?: number
}

type HeroRenderMode = 'idle' | 'move' | 'attack' | 'death'

type StickmanRenderState = {
  mode: HeroRenderMode
  isRun: boolean
  isAttack: boolean
  isDeath: boolean
  gait: number
  lean: number
  cloakLift: number
}

type SwordSlashFrame = {
  width: number
  primaryRadius: number
  secondaryRadius: number
  trailRadius: number
  start: number
  end: number
  alpha: number
  fragmentCount: number
}

type SwordRenderProfile = {
  bladeScale?: number
  guardScale?: number
  gripScale?: number
}

type ArrowTrailFrame = {
  length: number
  width: number
  alpha: number
  glowAlpha: number
}

type ChaserFramePose = {
  lean: number
  stride: number
  bladeTilt: number
  cloakDrag: number
  eyeGlow: number
  dissolve: number
  maskTilt: number
}

type ChargerFramePose = {
  lean: number
  stride: number
  shoulderLift: number
  warn: number
  charge: number
  runeGlow: number
  armDrive: number
  collapse: number
  scatter: number
}

const HERO_WIDTH = 84
const HERO_ATTACK_WIDTH = 340
const HERO_ATTACK_CENTER_X = 118
const HERO_HEIGHT = 146
const BOW_BASE_LENGTH = Math.round(HERO_HEIGHT * 0.66)
const INK_DARK = 0x101010
const INK_MID = 0x3d3d3d
const SWORD_RED_DARK = 0x4d1010
const SWORD_RED_MID = 0x7c1717
const SWORD_RED_LIGHT = 0xb82a2a
const SWORD_RED_HIGHLIGHT = 0xe07373
const SPEAR_POLE_DARK = 0x3f2c1a
const SPEAR_POLE_LIGHT = 0x7a5c3d
const SPEAR_IRON_DARK = 0x1b2229
const SPEAR_IRON_MID = 0x5e7484
const SPEAR_IRON_LIGHT = 0xa8bbc8
const SPEAR_HOOK_GLOW = 0xcaa46a
const BOW_BLUE_DARK = 0x173257
const BOW_BLUE_MID = 0x255d9d
const BOW_BLUE_LIGHT = 0x4c94ea
const BOW_BLUE_HIGHLIGHT = 0xb9dcff
const BOW_STRING = 0x9db8d1
const MONSTER_INK = 0x0f1012
const MONSTER_SHADE = 0x2b2d31
const MONSTER_SMOKE = 0x57534f
const MONSTER_BROWN = 0x463b35
const ARMOR_DARK = 0x17191d
const ARMOR_MID = 0x3d434b
const ARMOR_EDGE = 0x747a83
const WARNING_RED_MID = 0x8c2620
const WARNING_RED_LIGHT = 0xc84c38

export class BootScene extends Phaser.Scene {
  /** 初始化启动场景，负责离线绘制纹理与注册动画。 */
  constructor() {
    super({ key: 'boot-scene' })
  }

  /** Phaser 场景入口：一次性创建所有角色、怪物和特效纹理。 */
  create(): void {
    this.createSwordHeroTextures()
    this.createSwordSlashTextures()
    this.createHookSpearTextures()
    this.createBowTextures()
    this.createEnemyTextures()
    this.createArrowTexture(ARROW_TEXTURE)
    this.createArrowTrailTextures()
    this.createHeroAnimations()
    this.createEnemyAnimations()

    this.scene.start('game-scene')
    this.scene.launch('overlay-bridge-scene')
  }

  /** 生成玄火镇岳形态角色的 idle/move/attack 贴图。 */
  private createSwordHeroTextures() {
    const idlePoses: StickmanPose[] = [
      { armSwing: -0.16, legSwing: -0.08, bodyTilt: -0.04, headYOffset: 0, cloakLift: 0.1 },
      { armSwing: 0, legSwing: 0, bodyTilt: 0.01, headYOffset: 0.4, cloakLift: 0.28 },
      { armSwing: 0.16, legSwing: 0.08, bodyTilt: 0.05, headYOffset: 0.9, cloakLift: 0.05 },
    ]

    const movePoses: StickmanPose[] = [
      { armSwing: -0.86, legSwing: 0.62, bodyTilt: -0.22, headYOffset: 0 },
      { armSwing: -0.54, legSwing: 0.36, bodyTilt: -0.14, headYOffset: 0 },
      { armSwing: -0.18, legSwing: 0.08, bodyTilt: -0.05, headYOffset: 0 },
      { armSwing: 0.18, legSwing: -0.08, bodyTilt: 0.05, headYOffset: 0 },
      { armSwing: 0.54, legSwing: -0.36, bodyTilt: 0.14, headYOffset: 0 },
      { armSwing: 0.86, legSwing: -0.62, bodyTilt: 0.22, headYOffset: 0 },
    ]

    const attackPoses: StickmanPose[] = [
      { armSwing: -1.04, legSwing: -0.36, bodyTilt: -0.38, headYOffset: -0.24, cloakLift: 0.72, swordAngle: 3.12, swordReach: 114, swordBladeScale: 0.94, swordGuardScale: 0.98, swordGripScale: 0.98, swordHandX: -18, swordHandY: 8, supportHandX: -34, supportHandY: 1, torsoDrop: 6, frontFootX: -2, frontFootY: 4, backFootX: -22, backFootY: -4 },
      { armSwing: -0.88, legSwing: -0.22, bodyTilt: -0.24, headYOffset: -0.16, cloakLift: 1.02, swordAngle: 3.18, swordReach: 126, swordBladeScale: 0.98, swordGuardScale: 1, swordGripScale: 0.99, swordHandX: -24, swordHandY: -2, supportHandX: -40, supportHandY: -6, torsoDrop: 2, frontFootX: 6, frontFootY: 4, backFootX: -24, backFootY: -4 },
      { armSwing: 1.22, legSwing: -0.4, bodyTilt: 0.46, headYOffset: 0, cloakLift: 1.18, swordAngle: 0.01, swordReach: 140, swordBladeScale: 1.02, swordGuardScale: 1.04, swordGripScale: 1.02, swordHandX: 28, swordHandY: 1, supportHandX: 3, supportHandY: 3, torsoDrop: -2, frontFootX: 34, frontFootY: 4, backFootX: -12, backFootY: -7 },
      { armSwing: 0.76, legSwing: -0.12, bodyTilt: 0.24, headYOffset: 0.2, cloakLift: 0.84, swordAngle: 0.06, swordReach: 130, swordBladeScale: 0.98, swordGuardScale: 1, swordGripScale: 1, swordHandX: 22, swordHandY: 4, supportHandX: 8, supportHandY: 7, torsoDrop: -1, frontFootX: 24, frontFootY: 2, backFootX: -8, backFootY: -3 },
      { armSwing: 0.28, legSwing: 0.04, bodyTilt: 0.1, headYOffset: 0.44, cloakLift: 0.26, swordAngle: 0.08, swordReach: 114, swordBladeScale: 0.94, swordGuardScale: 0.96, swordGripScale: 0.98, swordHandX: 14, swordHandY: 5, supportHandX: 4, supportHandY: 6, torsoDrop: 0, frontFootX: 12, frontFootY: 1, backFootX: -5, backFootY: -1 },
    ]

    const deathPoses: StickmanPose[] = [
      { armSwing: 0.16, legSwing: 0.08, bodyTilt: 0.18, headYOffset: 0.1, fallenSwordX: 4, fallenSwordY: -2, fallenSwordAngle: 0.38 },
      { armSwing: 0.26, legSwing: -0.08, bodyTilt: 0.44, headYOffset: 0.4, fallenSwordX: 10, fallenSwordY: 3, fallenSwordAngle: 0.56 },
      { armSwing: 0.5, legSwing: -0.26, bodyTilt: 0.78, headYOffset: 1.1, fallenSwordX: 18, fallenSwordY: 10, fallenSwordAngle: 0.84 },
      { armSwing: 0.68, legSwing: -0.42, bodyTilt: 1.04, headYOffset: 2.2, fallenSwordX: 24, fallenSwordY: 15, fallenSwordAngle: 1.02 },
      { armSwing: 0.8, legSwing: -0.54, bodyTilt: 1.22, headYOffset: 3, fallenSwordX: 31, fallenSwordY: 18, fallenSwordAngle: 1.14 },
    ]

    HERO_SWORD_IDLE_FRAMES.forEach((key, index) => {
      this.drawHeroFrame(key, idlePoses[index], 'idle')
    })
    HERO_SWORD_MOVE_FRAMES.forEach((key, index) => {
      this.drawHeroFrame(key, movePoses[index], 'move')
    })
    HERO_SWORD_ATTACK_FRAMES.forEach((key, index) => {
      this.drawHeroFrame(key, attackPoses[index], 'attack')
    })
    HERO_DEATH_FRAMES.forEach((key, index) => {
      this.drawHeroFrame(key, deathPoses[index], 'death')
    })
  }

  /** 生成玄火镇岳挥砍特效贴图序列。 */
  private createSwordSlashTextures() {
    const frames: SwordSlashFrame[] = [
      { width: 2.8, primaryRadius: 26, secondaryRadius: 18, trailRadius: 10, start: Phaser.Math.DegToRad(194), end: Phaser.Math.DegToRad(252), alpha: 0.16, fragmentCount: 2 },
      { width: 5.8, primaryRadius: 46, secondaryRadius: 30, trailRadius: 18, start: Phaser.Math.DegToRad(184), end: Phaser.Math.DegToRad(312), alpha: 0.44, fragmentCount: 3 },
      { width: 8.6, primaryRadius: 68, secondaryRadius: 46, trailRadius: 28, start: Phaser.Math.DegToRad(176), end: Phaser.Math.DegToRad(356), alpha: 0.9, fragmentCount: 5 },
      { width: 5.2, primaryRadius: 78, secondaryRadius: 56, trailRadius: 34, start: Phaser.Math.DegToRad(184), end: Phaser.Math.DegToRad(380), alpha: 0.24, fragmentCount: 4 },
    ]

    SWORD_SLASH_FRAMES.forEach((key, index) => {
      this.drawSwordSlashFrame(key, frames[index])
    })
  }

  /** 生成金钩裂甲形态角色贴图序列。 */
  private createHookSpearTextures() {
    const idlePoses: StickmanPose[] = [
      { armSwing: -0.12, legSwing: -0.06, bodyTilt: -0.08, headYOffset: 0, cloakLift: 0.12 },
      { armSwing: 0, legSwing: 0, bodyTilt: 0, headYOffset: 0.36, cloakLift: 0.18 },
      { armSwing: 0.12, legSwing: 0.06, bodyTilt: 0.08, headYOffset: 0.72, cloakLift: 0.1 },
    ]

    const movePoses: StickmanPose[] = [
      { armSwing: -0.82, legSwing: 0.58, bodyTilt: -0.2, headYOffset: 0, cloakLift: 0.16 },
      { armSwing: -0.5, legSwing: 0.32, bodyTilt: -0.12, headYOffset: 0.08, cloakLift: 0.14 },
      { armSwing: -0.14, legSwing: 0.08, bodyTilt: -0.04, headYOffset: 0.16, cloakLift: 0.12 },
      { armSwing: 0.14, legSwing: -0.08, bodyTilt: 0.04, headYOffset: 0.16, cloakLift: 0.12 },
      { armSwing: 0.5, legSwing: -0.32, bodyTilt: 0.12, headYOffset: 0.08, cloakLift: 0.14 },
      { armSwing: 0.82, legSwing: -0.58, bodyTilt: 0.2, headYOffset: 0, cloakLift: 0.16 },
    ]

    const attackPoses: StickmanPose[] = [
      { armSwing: -0.9, legSwing: -0.28, bodyTilt: -0.3, headYOffset: -0.18, cloakLift: 0.42, hookSpearAngle: 3.18, hookSpearReach: 118, swordHandX: -8, swordHandY: 10, supportHandX: -24, supportHandY: 6, torsoDrop: 2, frontFootX: 4, frontFootY: 4, backFootX: -14, backFootY: -4 },
      { armSwing: -0.64, legSwing: -0.12, bodyTilt: -0.14, headYOffset: -0.1, cloakLift: 0.56, hookSpearAngle: 3.28, hookSpearReach: 128, swordHandX: -4, swordHandY: 2, supportHandX: -21, supportHandY: -1, torsoDrop: 0, frontFootX: 9, frontFootY: 3, backFootX: -18, backFootY: -4 },
      { armSwing: 1.04, legSwing: -0.28, bodyTilt: 0.38, headYOffset: 0, cloakLift: 0.76, hookSpearAngle: 0.06, hookSpearReach: 154, swordHandX: 26, swordHandY: -2, supportHandX: 8, supportHandY: 2, torsoDrop: -1, frontFootX: 28, frontFootY: 2, backFootX: -10, backFootY: -4 },
      { armSwing: 0.54, legSwing: -0.04, bodyTilt: 0.16, headYOffset: 0.18, cloakLift: 0.44, hookSpearAngle: 0.12, hookSpearReach: 142, swordHandX: 18, swordHandY: 1, supportHandX: 4, supportHandY: 4, torsoDrop: 0, frontFootX: 18, frontFootY: 2, backFootX: -6, backFootY: -2 },
      { armSwing: 0.16, legSwing: 0.04, bodyTilt: 0.08, headYOffset: 0.36, cloakLift: 0.16, hookSpearAngle: 0.14, hookSpearReach: 126, swordHandX: 12, swordHandY: 3, supportHandX: 2, supportHandY: 5, torsoDrop: 0, frontFootX: 10, frontFootY: 1, backFootX: -4, backFootY: -1 },
    ]

    HERO_HOOK_SPEAR_IDLE_FRAMES.forEach((key, index) => {
      this.drawHookSpearHeroFrame(key, idlePoses[index], 'idle')
    })
    HERO_HOOK_SPEAR_MOVE_FRAMES.forEach((key, index) => {
      this.drawHookSpearHeroFrame(key, movePoses[index], 'move')
    })
    HERO_HOOK_SPEAR_ATTACK_FRAMES.forEach((key, index) => {
      this.drawHookSpearHeroFrame(key, attackPoses[index], 'attack')
    })
  }

  /** 生成霜翎逐月形态角色贴图序列。 */
  private createBowTextures() {
    const idlePoses: StickmanPose[] = [
      { armSwing: -0.08, legSwing: -0.04, bodyTilt: -0.06, headYOffset: 0, cloakLift: 0.08, bowRaise: 0.16, drawStrength: 0.06, bowHandX: -5, bowHandY: 8, drawHandX: -2, drawHandY: 11, bowAngle: 0.5, bowLength: BOW_BASE_LENGTH - 4, nockArrow: false, arrowDrift: 0 },
      { armSwing: 0, legSwing: 0, bodyTilt: 0, headYOffset: 0.3, cloakLift: 0.12, bowRaise: 0.12, drawStrength: 0.05, bowHandX: -3, bowHandY: 9, drawHandX: 0, drawHandY: 10, bowAngle: 0.44, bowLength: BOW_BASE_LENGTH - 3, nockArrow: false, arrowDrift: 0 },
      { armSwing: 0.08, legSwing: 0.04, bodyTilt: 0.06, headYOffset: 0.7, cloakLift: 0.08, bowRaise: 0.1, drawStrength: 0.05, bowHandX: -2, bowHandY: 8, drawHandX: 2, drawHandY: 9, bowAngle: 0.38, bowLength: BOW_BASE_LENGTH - 2, nockArrow: false, arrowDrift: 0 },
    ]

    const movePoses: StickmanPose[] = [
      { armSwing: -0.7, legSwing: 0.56, bodyTilt: -0.18, headYOffset: 0, cloakLift: 0.18, bowRaise: 0.18, drawStrength: 0.1, bowHandX: -6, bowHandY: 8, drawHandX: -4, drawHandY: 12, bowAngle: 0.56, bowLength: BOW_BASE_LENGTH - 2, nockArrow: false, arrowDrift: 0 },
      { armSwing: -0.44, legSwing: 0.34, bodyTilt: -0.1, headYOffset: 0.1, cloakLift: 0.14, bowRaise: 0.16, drawStrength: 0.08, bowHandX: -5, bowHandY: 9, drawHandX: -3, drawHandY: 11, bowAngle: 0.5, bowLength: BOW_BASE_LENGTH - 2, nockArrow: false, arrowDrift: 0 },
      { armSwing: -0.14, legSwing: 0.12, bodyTilt: -0.04, headYOffset: 0.2, cloakLift: 0.1, bowRaise: 0.14, drawStrength: 0.07, bowHandX: -4, bowHandY: 9, drawHandX: -1, drawHandY: 10, bowAngle: 0.45, bowLength: BOW_BASE_LENGTH - 1, nockArrow: false, arrowDrift: 0 },
      { armSwing: 0.14, legSwing: -0.12, bodyTilt: 0.04, headYOffset: 0.2, cloakLift: 0.1, bowRaise: 0.12, drawStrength: 0.07, bowHandX: -2, bowHandY: 8, drawHandX: 1, drawHandY: 9, bowAngle: 0.38, bowLength: BOW_BASE_LENGTH - 1, nockArrow: false, arrowDrift: 0 },
      { armSwing: 0.44, legSwing: -0.34, bodyTilt: 0.1, headYOffset: 0.1, cloakLift: 0.14, bowRaise: 0.1, drawStrength: 0.08, bowHandX: -1, bowHandY: 8, drawHandX: 2, drawHandY: 9, bowAngle: 0.32, bowLength: BOW_BASE_LENGTH - 1, nockArrow: false, arrowDrift: 0 },
      { armSwing: 0.7, legSwing: -0.56, bodyTilt: 0.18, headYOffset: 0, cloakLift: 0.18, bowRaise: 0.08, drawStrength: 0.1, bowHandX: 0, bowHandY: 7, drawHandX: 3, drawHandY: 8, bowAngle: 0.28, bowLength: BOW_BASE_LENGTH, nockArrow: false, arrowDrift: 0 },
    ]

    const attackPoses: StickmanPose[] = [
      { armSwing: -0.16, legSwing: 0.14, bodyTilt: -0.14, headYOffset: -0.1, cloakLift: 0.14, bowRaise: 0.02, drawStrength: 0.18, bowHandX: 5, bowHandY: -2, drawHandX: 4, drawHandY: -3, bowAngle: -0.08, bowLength: BOW_BASE_LENGTH - 2, nockArrow: true, arrowDrift: 0 },
      { armSwing: -0.08, legSwing: 0.08, bodyTilt: -0.08, headYOffset: -0.1, cloakLift: 0.18, bowRaise: -0.02, drawStrength: 0.5, bowHandX: 10, bowHandY: -2, drawHandX: -5, drawHandY: -4, bowAngle: -0.02, bowLength: BOW_BASE_LENGTH, nockArrow: true, arrowDrift: -2 },
      { armSwing: 0.02, legSwing: 0.02, bodyTilt: 0.02, headYOffset: 0, cloakLift: 0.22, bowRaise: 0.04, drawStrength: 1, bowHandX: 14, bowHandY: -1, drawHandX: -18, drawHandY: -1, bowAngle: 0.02, bowLength: BOW_BASE_LENGTH + 2, nockArrow: true, arrowDrift: -4 },
      { armSwing: 0.14, legSwing: -0.04, bodyTilt: 0.1, headYOffset: 0.2, cloakLift: 0.16, bowRaise: 0.1, drawStrength: 0.08, bowHandX: 10, bowHandY: 0, drawHandX: 1, drawHandY: 2, bowAngle: 0.08, bowLength: BOW_BASE_LENGTH - 1, nockArrow: false, arrowDrift: 10 },
      { armSwing: 0.08, legSwing: -0.08, bodyTilt: 0.05, headYOffset: 0.4, cloakLift: 0.08, bowRaise: 0.04, drawStrength: 0.12, bowHandX: 4, bowHandY: 1, drawHandX: 1, drawHandY: 1, bowAngle: 0.03, bowLength: BOW_BASE_LENGTH - 3, nockArrow: false, arrowDrift: 0 },
    ]

    HERO_BOW_IDLE_FRAMES.forEach((key, index) => {
      this.drawBowHeroFrame(key, idlePoses[index], 'idle')
    })
    HERO_BOW_MOVE_FRAMES.forEach((key, index) => {
      this.drawBowHeroFrame(key, movePoses[index], 'move')
    })
    HERO_BOW_ATTACK_FRAMES.forEach((key, index) => {
      this.drawBowHeroFrame(key, attackPoses[index], 'attack')
    })
  }

  /** 绘制角色基础帧（玄火镇岳/通用骨架）。 */
  private drawHeroFrame(textureKey: string, pose: StickmanPose, mode: HeroRenderMode) {
    const rng = new Phaser.Math.RandomDataGenerator([`braveman-${textureKey}`])
    const frameWidth = mode === 'attack' ? HERO_ATTACK_WIDTH : HERO_WIDTH
    const centerX = mode === 'attack' ? HERO_ATTACK_CENTER_X : HERO_WIDTH / 2
    const shoulderY = 43
    const torsoBottomY = 80
    const legEndY = 129
    const renderState: StickmanRenderState = {
      mode,
      isRun: mode === 'move',
      isAttack: mode === 'attack',
      isDeath: mode === 'death',
      gait: Phaser.Math.Clamp(pose.armSwing, -1, 1),
      lean: pose.bodyTilt,
      cloakLift: pose.cloakLift ?? 0,
    }
    const headX = centerX + (mode === 'move' ? renderState.lean * 1.8 : pose.bodyTilt * 4.8)
    const headY = 24 + pose.headYOffset * 0.8
    const headRadius = 7.4

    const graphics = this.add.graphics({ x: 0, y: 0 })
    graphics.clear()

    this.drawCloakBack(graphics, centerX, shoulderY, legEndY, renderState, rng)

    if (!renderState.isAttack && !renderState.isDeath) {
      this.drawBackSword(graphics, centerX, shoulderY, legEndY, renderState, rng)
    }

    if (renderState.isRun) {
      this.drawRunSideBody(graphics, centerX, headY, headRadius, shoulderY, torsoBottomY, legEndY, renderState, rng)
    } else if (renderState.isAttack) {
      this.drawAttackBody(graphics, centerX, headY, headRadius, shoulderY, torsoBottomY, legEndY, pose, rng)
    } else if (renderState.isDeath) {
      this.drawDeathBody(graphics, centerX, headX, headY, headRadius, shoulderY, torsoBottomY, legEndY, pose, rng)
    } else {
      this.drawFrontalBody(graphics, centerX, headY, headRadius, shoulderY, torsoBottomY, legEndY, pose, rng)
    }

    this.drawCloakFront(graphics, centerX, shoulderY, legEndY, renderState, rng)
    this.drawDryCircle(graphics, headX, headY, headRadius, 2.2, rng)
    this.drawWuxiaHat(graphics, headX + renderState.lean * 1.2, headY - 3.2, rng)

    if (renderState.isAttack) {
      this.drawHeldSword(graphics, centerX, shoulderY, pose, rng)
    }
    if (renderState.isDeath) {
      this.drawDroppedSword(graphics, centerX, legEndY, pose, rng)
    }

    graphics.generateTexture(textureKey, frameWidth, HERO_HEIGHT)
    graphics.destroy()
  }

  /** 绘制金钩裂甲形态角色帧。 */
  private drawHookSpearHeroFrame(textureKey: string, pose: StickmanPose, mode: Exclude<HeroRenderMode, 'death'>) {
    const rng = new Phaser.Math.RandomDataGenerator([`braveman-hook-spear-${textureKey}`])
    const frameWidth = mode === 'attack' ? HERO_ATTACK_WIDTH : HERO_WIDTH
    const centerX = mode === 'attack' ? HERO_ATTACK_CENTER_X : HERO_WIDTH / 2
    const shoulderY = 43
    const torsoBottomY = 80
    const legEndY = 129
    const renderState: StickmanRenderState = {
      mode,
      isRun: mode === 'move',
      isAttack: mode === 'attack',
      isDeath: false,
      gait: Phaser.Math.Clamp(pose.armSwing, -1, 1),
      lean: pose.bodyTilt,
      cloakLift: pose.cloakLift ?? 0,
    }
    const headX = centerX + (mode === 'move' ? renderState.lean * 1.7 : pose.bodyTilt * 4.4)
    const headY = 24 + pose.headYOffset * 0.8
    const headRadius = 7.4

    const graphics = this.add.graphics({ x: 0, y: 0 })
    graphics.clear()

    this.drawCloakBack(graphics, centerX, shoulderY, legEndY, renderState, rng)

    if (!renderState.isAttack) {
      this.drawBackHookSpear(graphics, centerX, shoulderY, legEndY, renderState, rng)
    }

    if (renderState.isRun) {
      this.drawRunSideBody(graphics, centerX, headY, headRadius, shoulderY, torsoBottomY, legEndY, renderState, rng)
    } else if (renderState.isAttack) {
      this.drawAttackBody(graphics, centerX, headY, headRadius, shoulderY, torsoBottomY, legEndY, pose, rng)
    } else {
      this.drawFrontalBody(graphics, centerX, headY, headRadius, shoulderY, torsoBottomY, legEndY, pose, rng)
    }

    this.drawCloakFront(graphics, centerX, shoulderY, legEndY, renderState, rng)
    this.drawDryCircle(graphics, headX, headY, headRadius, 2.2, rng)
    this.drawWuxiaHat(graphics, headX + renderState.lean * 1.15, headY - 3.2, rng)

    if (renderState.isAttack) {
      this.drawHeldHookSpear(graphics, centerX, shoulderY, pose, rng)
    }

    graphics.generateTexture(textureKey, frameWidth, HERO_HEIGHT)
    graphics.destroy()
  }

  /** 绘制霜翎逐月形态角色帧。 */
  private drawBowHeroFrame(textureKey: string, pose: StickmanPose, mode: Exclude<HeroRenderMode, 'death'>) {
    const rng = new Phaser.Math.RandomDataGenerator([`braveman-bow-${textureKey}`])
    const centerX = HERO_WIDTH / 2
    const shoulderY = 43
    const torsoBottomY = 80
    const legEndY = 129
    const renderState: StickmanRenderState = {
      mode,
      isRun: mode === 'move',
      isAttack: mode === 'attack',
      isDeath: false,
      gait: Phaser.Math.Clamp(pose.armSwing, -1, 1),
      lean: pose.bodyTilt,
      cloakLift: pose.cloakLift ?? 0,
    }
    const headX = centerX + 1.8 + pose.bodyTilt * 3.8
    const headY = 24 + pose.headYOffset * 0.8
    const headRadius = 7.4

    const graphics = this.add.graphics({ x: 0, y: 0 })
    graphics.clear()

    this.drawCloakBack(graphics, centerX, shoulderY, legEndY, renderState, rng)

    this.drawBowBody(graphics, centerX, headY, headRadius, shoulderY, torsoBottomY, legEndY, pose, renderState, rng)

    this.drawCloakFront(graphics, centerX, shoulderY, legEndY, renderState, rng)
    this.drawDryCircle(graphics, headX, headY, headRadius, 2.2, rng)
    this.drawWuxiaHat(graphics, headX + renderState.lean * 1.1, headY - 3.2, rng)

    graphics.generateTexture(textureKey, HERO_WIDTH, HERO_HEIGHT)
    graphics.destroy()
  }

  /** 绘制霜翎逐月姿态下的主体躯干与手臂。 */
  private drawBowBody(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    headY: number,
    headRadius: number,
    shoulderY: number,
    torsoBottomY: number,
    legEndY: number,
    pose: StickmanPose,
    state: StickmanRenderState,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const gait = pose.armSwing
    const drawStrength = Phaser.Math.Clamp(pose.drawStrength ?? 0.12, 0, 1)
    const torsoLean = pose.bodyTilt * 8.2 + (state.isAttack ? 1.4 : 0)
    const torsoDrop = pose.torsoDrop ?? 0
    const neckX = centerX - 1 + torsoLean * 0.18
    const neckY = headY + headRadius - 0.2
    const chestX = centerX + 3.8 + torsoLean * 0.42
    const chestY = shoulderY + 2 + torsoDrop * 0.3
    const hipX = centerX + 6 + torsoLean * 0.78
    const hipY = torsoBottomY + torsoDrop
    const bowGripX = centerX + 19 + (pose.bowHandX ?? 0) + torsoLean * 0.3 + drawStrength * 5.2
    const bowGripY = shoulderY + 10 + (pose.bowHandY ?? 0) + (pose.bowRaise ?? 0) * 12
    const drawHandX = centerX + 5 + (pose.drawHandX ?? 0) - drawStrength * 24 + torsoLean * 0.1
    const drawHandY = shoulderY + 12 + (pose.drawHandY ?? 0) - drawStrength * 1.3 + (pose.bowRaise ?? 0) * 8
    const rearElbowX = centerX - 2 + gait * 1.6 - drawStrength * 5.6
    const rearElbowY = shoulderY + 14 - drawStrength * 1.4
    const frontElbowX = centerX + 15 + gait * 0.8 + drawStrength * 2.8
    const frontElbowY = shoulderY + 15 + (pose.bowRaise ?? 0) * 5
    const frontFootX = centerX + 10 + pose.legSwing * 7 + (pose.frontFootX ?? 0) * 0.2
    const frontFootY = legEndY + (pose.frontFootY ?? 0) + Math.max(0, -gait) * 2.2
    const backFootX = centerX - 8 - pose.legSwing * 5 + (pose.backFootX ?? 0) * 0.2
    const backFootY = legEndY + (pose.backFootY ?? 0) + Math.max(0, gait) * 1.7
    const frontKneeX = hipX + 5 - pose.legSwing * 2.8
    const frontKneeY = torsoBottomY + 29 + Math.max(0, -gait) * 1.8
    const backKneeX = hipX - 6 + pose.legSwing * 2.4
    const backKneeY = torsoBottomY + 24 + Math.max(0, gait) * 2.4

    this.drawMainStroke(graphics, { x: neckX, y: neckY }, { x: hipX, y: hipY }, 2.9, rng)
    this.drawMainStroke(graphics, { x: chestX - 1.8, y: chestY + 1.2 }, { x: rearElbowX, y: rearElbowY }, 2.2, rng)
    this.drawMainStroke(graphics, { x: rearElbowX, y: rearElbowY }, { x: drawHandX, y: drawHandY }, 2.4, rng)
    this.drawMainStroke(graphics, { x: chestX + 1.2, y: chestY - 0.8 }, { x: frontElbowX, y: frontElbowY }, 2.2, rng)
    this.drawMainStroke(graphics, { x: frontElbowX, y: frontElbowY }, { x: bowGripX, y: bowGripY }, 2.4, rng)
    this.drawMainStroke(graphics, { x: hipX, y: hipY }, { x: backKneeX, y: backKneeY }, 2.5, rng)
    this.drawMainStroke(graphics, { x: backKneeX, y: backKneeY }, { x: backFootX, y: backFootY }, 2.5, rng)
    this.drawMainStroke(graphics, { x: hipX, y: hipY }, { x: frontKneeX, y: frontKneeY }, 2.7, rng)
    this.drawMainStroke(graphics, { x: frontKneeX, y: frontKneeY }, { x: frontFootX, y: frontFootY }, 2.8, rng)

    this.drawHeldBow(
      graphics,
      bowGripX,
      bowGripY,
      {
        angle: pose.bowAngle ?? ((pose.bowRaise ?? 0) * 0.36),
        drawStrength,
        length: pose.bowLength ?? BOW_BASE_LENGTH,
        arrowOffset: pose.arrowDrift ?? 0,
        nockArrow: pose.nockArrow ?? true,
      },
      rng,
    )
  }

  /** 绘制角色正面站姿躯干。 */
  private drawFrontalBody(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    headY: number,
    headRadius: number,
    shoulderY: number,
    torsoBottomY: number,
    legEndY: number,
    pose: StickmanPose,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const hipY = torsoBottomY
    const armReachY = 71
    const swingArm = pose.armSwing * 12.5
    const swingLeg = pose.legSwing * 11
    const torsoTilt = pose.bodyTilt * 6.2
    const armAnchorX = centerX + torsoTilt * 0.4

    this.drawMainStroke(
      graphics,
      { x: centerX, y: headY + headRadius - 0.2 },
      { x: centerX + torsoTilt, y: torsoBottomY },
      2.8,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: armAnchorX, y: shoulderY },
      { x: centerX - 14 + swingArm, y: armReachY },
      2.4,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: armAnchorX, y: shoulderY },
      { x: centerX + 14 - swingArm, y: armReachY },
      2.4,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: centerX + torsoTilt, y: hipY },
      { x: centerX - 9 + swingLeg, y: legEndY },
      2.6,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: centerX + torsoTilt, y: hipY },
      { x: centerX + 9 - swingLeg, y: legEndY },
      2.6,
      rng,
    )
  }

  /** 绘制角色跑动侧身躯干。 */
  private drawRunSideBody(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    headY: number,
    headRadius: number,
    shoulderY: number,
    torsoBottomY: number,
    legEndY: number,
    state: StickmanRenderState,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const gait = state.gait
    const neckX = centerX + 2.4 + state.lean * 1.7
    const shoulderX = neckX + 2.3
    const hipX = shoulderX + 4.5 + Math.max(0, gait) * 0.7

    this.drawMainStroke(
      graphics,
      { x: neckX, y: headY + headRadius - 0.3 },
      { x: hipX, y: torsoBottomY + 0.6 },
      3,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: shoulderX, y: shoulderY },
      { x: shoulderX + 12.4 + gait * 4, y: shoulderY + 13.2 + Math.abs(gait) * 2 },
      2.8,
      rng,
    )
    this.drawSecondaryStroke(
      graphics,
      { x: shoulderX - 1.1, y: shoulderY + 1.2 },
      { x: shoulderX - 8.2 + gait * 2.5, y: shoulderY + 11.3 },
      1.6,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: hipX, y: torsoBottomY + 0.6 },
      { x: hipX + 5.4 - gait * 7.4, y: legEndY - 2.2 + Math.abs(gait) * 1.8 },
      2.9,
      rng,
    )
    this.drawSecondaryStroke(
      graphics,
      { x: hipX - 1.4, y: torsoBottomY + 1.6 },
      { x: hipX - 10.4 + gait * 3.8, y: legEndY - 10.8 },
      1.7,
      rng,
    )
  }

  /** 绘制角色攻击姿态躯干。 */
  private drawAttackBody(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    headY: number,
    headRadius: number,
    shoulderY: number,
    torsoBottomY: number,
    legEndY: number,
    pose: StickmanPose,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const torsoTilt = pose.bodyTilt * 9.6
    const torsoDrop = pose.torsoDrop ?? 0
    const chestX = centerX + torsoTilt * 0.46
    const chestY = shoulderY + torsoDrop * 0.35
    const hipX = centerX + torsoTilt
    const hipY = torsoBottomY + torsoDrop
    const swordHandX = centerX + (pose.swordHandX ?? 10) + torsoTilt * 0.16
    const swordHandY = shoulderY + 16 + (pose.swordHandY ?? 0) + torsoDrop * 0.25
    const supportHandX = centerX + (pose.supportHandX ?? -8) + torsoTilt * 0.14
    const supportHandY = shoulderY + 12 + (pose.supportHandY ?? 0) + torsoDrop * 0.22
    const rearHandX = centerX - 16 + pose.armSwing * 4.4
    const rearHandY = shoulderY + 9 - pose.bodyTilt * 5 + torsoDrop * 0.2
    const frontLegX = centerX + (pose.frontFootX ?? 12)
    const frontLegY = legEndY + (pose.frontFootY ?? 0)
    const backLegX = centerX + (pose.backFootX ?? -8)
    const backLegY = legEndY + (pose.backFootY ?? 0)
    const rearKneeX = hipX - 5 + pose.legSwing * 6
    const rearKneeY = torsoBottomY + 26 + torsoDrop * 0.7
    const frontKneeX = hipX + 8 - pose.legSwing * 4
    const frontKneeY = torsoBottomY + 30 + torsoDrop * 0.45

    this.drawMainStroke(
      graphics,
      { x: centerX, y: headY + headRadius - 0.2 },
      { x: hipX, y: hipY },
      2.9,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: chestX, y: chestY },
      { x: rearHandX, y: rearHandY },
      2.4,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: chestX + 1.5, y: chestY + 1 },
      { x: supportHandX, y: supportHandY },
      2.4,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: supportHandX + 0.8, y: supportHandY + 0.4 },
      { x: swordHandX, y: swordHandY },
      2.8,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: hipX, y: hipY },
      { x: rearKneeX, y: rearKneeY },
      2.5,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: rearKneeX, y: rearKneeY },
      { x: backLegX, y: backLegY },
      2.6,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: hipX, y: hipY },
      { x: frontKneeX, y: frontKneeY },
      2.6,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: frontKneeX, y: frontKneeY },
      { x: frontLegX, y: frontLegY },
      2.9,
      rng,
    )
  }

  /** 绘制角色死亡倒地姿态。 */
  private drawDeathBody(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    headX: number,
    headY: number,
    headRadius: number,
    shoulderY: number,
    torsoBottomY: number,
    legEndY: number,
    pose: StickmanPose,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const collapse = pose.bodyTilt
    const torsoEndX = centerX + collapse * 18
    const torsoEndY = torsoBottomY + collapse * 10
    const armFoldX = torsoEndX - 10 + collapse * 3
    const frontArmX = torsoEndX + 6
    const frontArmY = torsoEndY + 7
    const kneeY = legEndY - 10 + collapse * 4

    this.drawMainStroke(
      graphics,
      { x: headX - collapse * 1.6, y: headY + headRadius - 0.3 },
      { x: torsoEndX, y: torsoEndY },
      2.9,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: torsoEndX - 2, y: shoulderY + collapse * 6 },
      { x: armFoldX, y: torsoEndY + 6 },
      2.3,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: torsoEndX + 2, y: shoulderY + collapse * 8 },
      { x: frontArmX, y: frontArmY },
      2.4,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: torsoEndX - 1.5, y: torsoEndY },
      { x: centerX + collapse * 8, y: kneeY },
      2.5,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: torsoEndX + 0.5, y: torsoEndY },
      { x: centerX + 18 + collapse * 4, y: kneeY + 6 },
      2.5,
      rng,
    )
  }

  /** 绘制手持玄火镇岳形态。 */
  private drawHeldSword(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    shoulderY: number,
    pose: StickmanPose,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const hiltX = centerX + (pose.swordHandX ?? 10)
    const hiltY = shoulderY + 16 + (pose.swordHandY ?? 0)
    const angle = pose.swordAngle ?? 0
    const reach = pose.swordReach ?? 68
    const tipX = hiltX + Math.cos(angle) * reach
    const tipY = hiltY + Math.sin(angle) * reach
    const bladeScale = Phaser.Math.Clamp(1.03 + (reach - 72) / 280, 1.03, 1.16)
    const tasselSwing = Math.max(2.6, Math.abs(pose.armSwing) * 2.8 + Math.max(0, (reach - 72) * 0.018))
    this.drawSwordShape(
      graphics,
      hiltX,
      hiltY,
      tipX,
      tipY,
      bladeScale,
      1,
      rng,
      tasselSwing,
      {
        bladeScale: pose.swordBladeScale,
        guardScale: pose.swordGuardScale,
        gripScale: pose.swordGripScale,
      },
    )
  }

  /** 绘制角色死亡后掉落在地的玄火镇岳。 */
  private drawDroppedSword(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    legEndY: number,
    pose: StickmanPose,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const hiltX = centerX + (pose.fallenSwordX ?? 18)
    const hiltY = legEndY - 16 + (pose.fallenSwordY ?? 8)
    const angle = pose.fallenSwordAngle ?? 0.92
    const reach = 52
    const tipX = hiltX + Math.cos(angle) * reach
    const tipY = hiltY + Math.sin(angle) * reach
    this.drawSwordShape(graphics, hiltX, hiltY, tipX, tipY, 1.04, 0.82, rng, 0.4)
  }

  /** 绘制手持金钩裂甲形态。 */
  private drawHeldHookSpear(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    shoulderY: number,
    pose: StickmanPose,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const frontGripX = centerX + (pose.swordHandX ?? 10)
    const frontGripY = shoulderY + 16 + (pose.swordHandY ?? 0)
    const rearGripX = centerX + (pose.supportHandX ?? -8)
    const rearGripY = shoulderY + 12 + (pose.supportHandY ?? 0)
    const angle = pose.hookSpearAngle ?? 0.1
    const reach = pose.hookSpearReach ?? 136
    const shaftBackLength = 62
    const tipX = frontGripX + Math.cos(angle) * reach
    const tipY = frontGripY + Math.sin(angle) * reach
    const buttX = rearGripX - Math.cos(angle) * shaftBackLength
    const buttY = rearGripY - Math.sin(angle) * shaftBackLength
    this.drawHookSpearShape(graphics, buttX, buttY, tipX, tipY, 1, rng, Math.abs(pose.armSwing) * 2.4)
  }

  /** 绘制背负金钩裂甲的待机细节。 */
  private drawBackHookSpear(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    shoulderY: number,
    legEndY: number,
    state: StickmanRenderState,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const sway = state.gait * 2.8 + state.lean * 7.2
    const buttX = centerX - 24 + sway * 0.14
    const buttY = shoulderY - 30 - (state.isRun ? 1.5 : 0)
    const tipX = centerX + 30 + sway * 0.46
    const tipY = legEndY + 8 + (state.isRun ? 2.4 : 0)
    this.drawHookSpearShape(graphics, buttX, buttY, tipX, tipY, 0.9, rng, state.gait * 1.6)
  }

  /** 绘制背负玄火镇岳的待机细节。 */
  private drawBackSword(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    shoulderY: number,
    legEndY: number,
    state: StickmanRenderState,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const runFactor = state.isRun ? 1 : 0
    const sway = state.gait * 3.6 + state.lean * 8.6
    const hiltX = centerX - 20.2 + sway * 0.14
    const hiltY = shoulderY - 21.6 - runFactor * 2.1
    const tipX = centerX + 26.2 + sway * 0.5
    const tipY = legEndY - 6.8 + runFactor * 3

    this.drawSwordShape(graphics, hiltX, hiltY, tipX, tipY, 1.12, 1, rng, state.gait * 3 + state.lean * 1.2)
  }

  /** 绘制玄火镇岳轮廓与装饰细节。 */
  private drawSwordShape(
    graphics: Phaser.GameObjects.Graphics,
    hiltX: number,
    hiltY: number,
    tipX: number,
    tipY: number,
    bladeScale: number,
    alpha: number,
    rng: Phaser.Math.RandomDataGenerator,
    tasselSwing: number,
    profile: SwordRenderProfile = {},
  ) {
    const weightedBladeScale = bladeScale * (profile.bladeScale ?? 1)
    const guardScale = profile.guardScale ?? 1
    const gripScale = profile.gripScale ?? 1
    const directionX = tipX - hiltX
    const directionY = tipY - hiltY
    const length = Math.max(1, Math.hypot(directionX, directionY))
    const unitX = directionX / length
    const unitY = directionY / length
    const normalX = -unitY
    const normalY = unitX
    const bladeHalf = 4.7 * weightedBladeScale
    const bladeTipInset = 8.8 * weightedBladeScale

    const leftRootX = hiltX + normalX * bladeHalf
    const leftRootY = hiltY + normalY * bladeHalf
    const rightRootX = hiltX - normalX * bladeHalf
    const rightRootY = hiltY - normalY * bladeHalf
    const leftMidX = tipX - unitX * bladeTipInset + normalX * (bladeHalf * 0.6)
    const leftMidY = tipY - unitY * bladeTipInset + normalY * (bladeHalf * 0.6)
    const rightMidX = tipX - unitX * bladeTipInset - normalX * (bladeHalf * 0.6)
    const rightMidY = tipY - unitY * bladeTipInset - normalY * (bladeHalf * 0.6)

    graphics.fillStyle(SWORD_RED_MID, 0.92 * alpha)
    graphics.beginPath()
    graphics.moveTo(leftRootX, leftRootY)
    graphics.lineTo(leftMidX, leftMidY)
    graphics.lineTo(tipX, tipY)
    graphics.lineTo(rightMidX, rightMidY)
    graphics.lineTo(rightRootX, rightRootY)
    graphics.closePath()
    graphics.fillPath()

    graphics.lineStyle(2.2 * weightedBladeScale, SWORD_RED_LIGHT, 0.99 * alpha)
    graphics.beginPath()
    graphics.moveTo(leftRootX, leftRootY)
    graphics.lineTo(leftMidX, leftMidY)
    graphics.lineTo(tipX, tipY)
    graphics.lineTo(rightMidX, rightMidY)
    graphics.lineTo(rightRootX, rightRootY)
    graphics.closePath()
    graphics.strokePath()

    const facetRootX = hiltX + normalX * (bladeHalf * 0.28)
    const facetRootY = hiltY + normalY * (bladeHalf * 0.28)
    const facetMidX = tipX - unitX * (bladeTipInset + 2.2) + normalX * (bladeHalf * 0.16)
    const facetMidY = tipY - unitY * (bladeTipInset + 2.2) + normalY * (bladeHalf * 0.16)
    const facetTipX = tipX - unitX * 14.5 + normalX * 0.9
    const facetTipY = tipY - unitY * 14.5 + normalY * 0.9

    graphics.fillStyle(SWORD_RED_DARK, 0.42 * alpha)
    graphics.beginPath()
    graphics.moveTo(leftRootX, leftRootY)
    graphics.lineTo(leftMidX, leftMidY)
    graphics.lineTo(facetTipX, facetTipY)
    graphics.lineTo(facetMidX, facetMidY)
    graphics.lineTo(facetRootX, facetRootY)
    graphics.closePath()
    graphics.fillPath()

    graphics.lineStyle(1.2, SWORD_RED_HIGHLIGHT, 0.5 * alpha)
    graphics.beginPath()
    graphics.moveTo(hiltX + normalX * 0.45, hiltY + normalY * 0.45)
    graphics.lineTo(tipX - unitX * 9.2 + normalX * 0.45, tipY - unitY * 9.2 + normalY * 0.45)
    graphics.strokePath()

    graphics.lineStyle(1.05, SWORD_RED_DARK, 0.58 * alpha)
    graphics.beginPath()
    graphics.moveTo(hiltX - normalX * 1.5, hiltY - normalY * 1.5)
    graphics.lineTo(tipX - unitX * 10.6 - normalX * 1.5, tipY - unitY * 10.6 - normalY * 1.5)
    graphics.strokePath()

    for (let notchIndex = 0; notchIndex < 4; notchIndex += 1) {
      const t = 0.2 + notchIndex * 0.16
      const notchX = Phaser.Math.Linear(hiltX, tipX - unitX * 12, t)
      const notchY = Phaser.Math.Linear(hiltY, tipY - unitY * 12, t)
      const notchHalf = 1.45 + notchIndex * 0.22
      graphics.lineStyle(0.95, SWORD_RED_HIGHLIGHT, 0.72 * alpha)
      graphics.beginPath()
      graphics.moveTo(
        notchX - normalX * notchHalf + rng.realInRange(-0.12, 0.12),
        notchY - normalY * notchHalf + rng.realInRange(-0.12, 0.12),
      )
      graphics.lineTo(
        notchX + normalX * notchHalf + rng.realInRange(-0.12, 0.12),
        notchY + normalY * notchHalf + rng.realInRange(-0.12, 0.12),
      )
      graphics.strokePath()
    }

    const guardCenterX = hiltX + unitX * (8.8 * gripScale)
    const guardCenterY = hiltY + unitY * (8.8 * gripScale)
    const guardHalf = 15 * weightedBladeScale * guardScale
    const guardCrossHalf = 7.8 * weightedBladeScale * guardScale
    graphics.lineStyle(3.2 * weightedBladeScale * guardScale, SWORD_RED_LIGHT, 0.98 * alpha)
    graphics.beginPath()
    graphics.moveTo(guardCenterX - normalX * guardHalf, guardCenterY - normalY * guardHalf)
    graphics.lineTo(guardCenterX + normalX * guardHalf, guardCenterY + normalY * guardHalf)
    graphics.strokePath()

    graphics.lineStyle(2.6 * weightedBladeScale * guardScale, SWORD_RED_LIGHT, 0.95 * alpha)
    graphics.beginPath()
    graphics.moveTo(guardCenterX - unitX * guardCrossHalf, guardCenterY - unitY * guardCrossHalf)
    graphics.lineTo(guardCenterX + unitX * guardCrossHalf, guardCenterY + unitY * guardCrossHalf)
    graphics.strokePath()

    graphics.fillStyle(SWORD_RED_MID, 0.88 * alpha)
    graphics.beginPath()
    graphics.moveTo(guardCenterX + normalX * 3.4, guardCenterY + normalY * 3.4)
    graphics.lineTo(guardCenterX + unitX * 2.8, guardCenterY + unitY * 2.8)
    graphics.lineTo(guardCenterX - normalX * 3.4, guardCenterY - normalY * 3.4)
    graphics.lineTo(guardCenterX - unitX * 2.8, guardCenterY - unitY * 2.8)
    graphics.closePath()
    graphics.fillPath()

    graphics.fillStyle(SWORD_RED_DARK, 0.94 * alpha)
    graphics.fillTriangle(
      guardCenterX - normalX * (guardHalf + 3.4),
      guardCenterY - normalY * (guardHalf + 3.4),
      guardCenterX - normalX * (guardHalf - 0.2) + unitX * 2,
      guardCenterY - normalY * (guardHalf - 0.2) + unitY * 2,
      guardCenterX - normalX * (guardHalf - 0.2) - unitX * 2,
      guardCenterY - normalY * (guardHalf - 0.2) - unitY * 2,
    )
    graphics.fillTriangle(
      guardCenterX + normalX * (guardHalf + 3.4),
      guardCenterY + normalY * (guardHalf + 3.4),
      guardCenterX + normalX * (guardHalf - 0.2) + unitX * 2,
      guardCenterY + normalY * (guardHalf - 0.2) + unitY * 2,
      guardCenterX + normalX * (guardHalf - 0.2) - unitX * 2,
      guardCenterY + normalY * (guardHalf - 0.2) - unitY * 2,
    )

    graphics.fillStyle(SWORD_RED_HIGHLIGHT, 0.78 * alpha)
    graphics.fillCircle(guardCenterX, guardCenterY, 2.2 * weightedBladeScale)

    const gripEndX = hiltX - unitX * (7.6 * gripScale)
    const gripEndY = hiltY - unitY * (7.6 * gripScale)
    graphics.lineStyle(3.4 * weightedBladeScale * Phaser.Math.Clamp(0.86 + gripScale * 0.14, 0.96, 1.2), SWORD_RED_DARK, 0.96 * alpha)
    graphics.beginPath()
    graphics.moveTo(hiltX, hiltY)
    graphics.lineTo(gripEndX, gripEndY)
    graphics.strokePath()

    for (let wrapIndex = 0; wrapIndex < 4; wrapIndex += 1) {
      const t = (wrapIndex + 1) / 5
      const wrapCenterX = Phaser.Math.Linear(hiltX, gripEndX, t)
      const wrapCenterY = Phaser.Math.Linear(hiltY, gripEndY, t)
      const wrapHalf = 1.5 + wrapIndex * 0.18
      graphics.lineStyle(1.05, SWORD_RED_HIGHLIGHT, 0.9 * alpha)
      graphics.beginPath()
      graphics.moveTo(
        wrapCenterX - normalX * wrapHalf + rng.realInRange(-0.18, 0.18),
        wrapCenterY - normalY * wrapHalf + rng.realInRange(-0.18, 0.18),
      )
      graphics.lineTo(
        wrapCenterX + normalX * wrapHalf + rng.realInRange(-0.18, 0.18),
        wrapCenterY + normalY * wrapHalf + rng.realInRange(-0.18, 0.18),
      )
      graphics.strokePath()
    }

    const pommelX = gripEndX - unitX * 1.8 + rng.realInRange(-0.2, 0.2)
    const pommelY = gripEndY - unitY * 1.8 + rng.realInRange(-0.2, 0.2)
    graphics.fillStyle(SWORD_RED_DARK, 0.96 * alpha)
    graphics.fillCircle(pommelX, pommelY, 2.2 * weightedBladeScale * Phaser.Math.Clamp(0.92 + (gripScale - 1) * 0.38, 0.92, 1.2))

    const tasselLength = 15.6 + weightedBladeScale * 1.6 + (gripScale - 1) * 4.2
    const knotX = pommelX + normalX * 0.6
    const knotY = pommelY + 1.6
    graphics.fillStyle(SWORD_RED_LIGHT, 0.92 * alpha)
    graphics.fillCircle(knotX, knotY, 1.55)
    graphics.lineStyle(1.2, SWORD_RED_LIGHT, 0.88 * alpha)
    graphics.beginPath()
    graphics.moveTo(pommelX, pommelY + 0.9)
    graphics.lineTo(knotX, knotY + 0.4)
    graphics.strokePath()

    for (let strand = 0; strand < 5; strand += 1) {
      const spread = (strand - 2) * 1.25
      const startX = knotX + spread * 0.32
      const startY = knotY + 0.5 + Math.abs(spread) * 0.12
      const midX = startX + tasselSwing * 0.35 + spread * 0.5
      const midY = startY + tasselLength * 0.48
      const endX = startX + tasselSwing + spread * 0.9
      const endY = startY + tasselLength + rng.realInRange(-0.6, 0.9)

      graphics.lineStyle(
        Math.max(0.85, 1.15 - Math.abs(spread) * 0.04),
        strand % 2 === 0 ? SWORD_RED_LIGHT : SWORD_RED_HIGHLIGHT,
        0.82 * alpha,
      )
      graphics.beginPath()
      graphics.moveTo(startX, startY)
      graphics.lineTo(midX, midY)
      graphics.lineTo(endX, endY)
      graphics.strokePath()
    }
  }

  /** 绘制金钩裂甲轮廓与装饰细节。 */
  private drawHookSpearShape(
    graphics: Phaser.GameObjects.Graphics,
    buttX: number,
    buttY: number,
    tipX: number,
    tipY: number,
    alpha: number,
    rng: Phaser.Math.RandomDataGenerator,
    tasselSwing: number,
  ) {
    const directionX = tipX - buttX
    const directionY = tipY - buttY
    const length = Math.max(1, Math.hypot(directionX, directionY))
    const unitX = directionX / length
    const unitY = directionY / length
    const normalX = -unitY
    const normalY = unitX
    const headBaseX = tipX - unitX * 18
    const headBaseY = tipY - unitY * 18
    const hookRootX = tipX - unitX * 24
    const hookRootY = tipY - unitY * 24
    const hookTipX = hookRootX + normalX * 15 - unitX * 7
    const hookTipY = hookRootY + normalY * 15 - unitY * 7
    const tasselAnchorX = buttX + unitX * 26
    const tasselAnchorY = buttY + unitY * 26

    graphics.lineStyle(3.8, SPEAR_POLE_DARK, 0.92 * alpha)
    graphics.beginPath()
    graphics.moveTo(buttX, buttY)
    graphics.lineTo(headBaseX, headBaseY)
    graphics.strokePath()

    graphics.lineStyle(1.6, SPEAR_POLE_LIGHT, 0.68 * alpha)
    graphics.beginPath()
    graphics.moveTo(buttX + normalX * 0.7, buttY + normalY * 0.7)
    graphics.lineTo(headBaseX + normalX * 0.7, headBaseY + normalY * 0.7)
    graphics.strokePath()

    graphics.fillStyle(SPEAR_IRON_MID, 0.94 * alpha)
    graphics.beginPath()
    graphics.moveTo(tipX, tipY)
    graphics.lineTo(headBaseX + normalX * 5.2, headBaseY + normalY * 5.2)
    graphics.lineTo(headBaseX - normalX * 4.2, headBaseY - normalY * 4.2)
    graphics.closePath()
    graphics.fillPath()

    graphics.lineStyle(1.3, SPEAR_IRON_DARK, 0.94 * alpha)
    graphics.beginPath()
    graphics.moveTo(tipX, tipY)
    graphics.lineTo(headBaseX + normalX * 5.2, headBaseY + normalY * 5.2)
    graphics.lineTo(headBaseX - normalX * 4.2, headBaseY - normalY * 4.2)
    graphics.closePath()
    graphics.strokePath()

    graphics.lineStyle(2.1, SPEAR_IRON_LIGHT, 0.86 * alpha)
    graphics.beginPath()
    graphics.moveTo(hookRootX, hookRootY)
    graphics.lineTo(hookRootX + normalX * 8 + unitX * 2, hookRootY + normalY * 9 + unitY * 2)
    graphics.lineTo(hookTipX, hookTipY)
    graphics.strokePath()

    graphics.lineStyle(1.1, SPEAR_HOOK_GLOW, 0.54 * alpha)
    graphics.beginPath()
    graphics.moveTo(hookRootX + normalX * 0.8, hookRootY + normalY * 0.8)
    graphics.lineTo(hookRootX + normalX * 6.6 + unitX, hookRootY + normalY * 7.4 + unitY)
    graphics.lineTo(hookTipX - unitX * 0.6, hookTipY - unitY * 0.6)
    graphics.strokePath()

    const tasselLength = 14 + tasselSwing
    const tasselEndX = tasselAnchorX - normalX * (8 + tasselSwing * 0.5) - unitX * 2
    const tasselEndY = tasselAnchorY - normalY * tasselLength + unitY * 2
    graphics.lineStyle(1.4, WARNING_RED_LIGHT, 0.62 * alpha)
    graphics.beginPath()
    graphics.moveTo(tasselAnchorX, tasselAnchorY)
    graphics.lineTo(
      tasselAnchorX - normalX * 4.2,
      tasselAnchorY - normalY * (6 + tasselSwing * 0.3),
    )
    graphics.lineTo(tasselEndX, tasselEndY)
    graphics.strokePath()

    for (let index = 0; index < 2; index += 1) {
      const drift = rng.realInRange(-1.2, 1.2)
      graphics.lineStyle(0.8, WARNING_RED_MID, 0.46 * alpha)
      graphics.beginPath()
      graphics.moveTo(tasselEndX + drift, tasselEndY + index * 1.6)
      graphics.lineTo(
        tasselEndX - normalX * rng.realInRange(3.6, 6.4),
        tasselEndY - normalY * rng.realInRange(3.2, 6),
      )
      graphics.strokePath()
    }
  }

  /** 绘制玄火镇岳挥砍帧纹理。 */
  private drawSwordSlashFrame(textureKey: string, spec: SwordSlashFrame) {
    const size = 136
    const centerX = 42
    const centerY = 72
    const graphics = this.add.graphics({ x: 0, y: 0 })
    const rng = new Phaser.Math.RandomDataGenerator([`slash-${textureKey}`])

    graphics.lineStyle(spec.width + 2.8, SWORD_RED_DARK, spec.alpha * 0.14)
    graphics.beginPath()
    graphics.arc(centerX, centerY, spec.primaryRadius + 3.6, spec.start, spec.end, false)
    graphics.strokePath()

    graphics.lineStyle(spec.width + 1.2, SWORD_RED_MID, spec.alpha * 0.28)
    graphics.beginPath()
    graphics.arc(centerX, centerY, spec.primaryRadius + 0.8, spec.start + 0.04, spec.end - 0.04, false)
    graphics.strokePath()

    graphics.lineStyle(spec.width, SWORD_RED_LIGHT, spec.alpha)
    graphics.beginPath()
    graphics.arc(centerX, centerY, spec.primaryRadius, spec.start, spec.end, false)
    graphics.strokePath()

    graphics.lineStyle(Math.max(1.8, spec.width * 0.26), SWORD_RED_HIGHLIGHT, spec.alpha * 0.88)
    graphics.beginPath()
    graphics.arc(centerX + 1.2, centerY - 0.8, spec.secondaryRadius, spec.start + 0.18, spec.end - 0.22, false)
    graphics.strokePath()

    graphics.lineStyle(Math.max(1.2, spec.width * 0.18), SWORD_RED_HIGHLIGHT, spec.alpha * 0.34)
    graphics.beginPath()
    graphics.arc(centerX + 10, centerY - 2.2, spec.trailRadius, spec.start + 0.34, spec.end - 0.38, false)
    graphics.strokePath()

    const tailAngle = spec.end - 0.06
    const tailX = centerX + Math.cos(tailAngle) * spec.primaryRadius
    const tailY = centerY + Math.sin(tailAngle) * spec.primaryRadius
    graphics.fillStyle(SWORD_RED_MID, spec.alpha * 0.72)
    graphics.fillTriangle(
      tailX + 5,
      tailY,
      tailX - 20,
      tailY - 4.5,
      tailX - 20,
      tailY + 4.5,
    )
    graphics.lineStyle(1.1, SWORD_RED_HIGHLIGHT, spec.alpha * 0.72)
    graphics.beginPath()
    graphics.moveTo(tailX - 18, tailY)
    graphics.lineTo(tailX + 2, tailY)
    graphics.strokePath()

    for (let index = 0; index < spec.fragmentCount; index += 1) {
      const fragmentBlend = spec.fragmentCount === 1 ? 0 : index / (spec.fragmentCount - 1)
      const fragmentAngle = Phaser.Math.Linear(spec.start + 0.22, spec.end - 0.2, fragmentBlend)
      const fragmentRadius = spec.primaryRadius + rng.realInRange(-2, 4)
      const fragmentX = centerX + Math.cos(fragmentAngle) * fragmentRadius
      const fragmentY = centerY + Math.sin(fragmentAngle) * fragmentRadius
      const fragmentTilt = fragmentAngle - Math.PI * 0.5 + rng.realInRange(-0.18, 0.18)
      const fragmentLength = rng.realInRange(4, 8)
      graphics.lineStyle(rng.realInRange(0.7, 1.15), index % 2 === 0 ? SWORD_RED_HIGHLIGHT : SWORD_RED_LIGHT, spec.alpha * rng.realInRange(0.22, 0.42))
      graphics.beginPath()
      graphics.moveTo(fragmentX, fragmentY)
      graphics.lineTo(fragmentX + Math.cos(fragmentTilt) * fragmentLength, fragmentY + Math.sin(fragmentTilt) * fragmentLength)
      graphics.strokePath()
    }

    for (let index = 0; index < Math.max(2, Math.round(spec.fragmentCount * 0.5)); index += 1) {
      const shardAngle = Phaser.Math.Linear(spec.start + 0.2, spec.end - 0.22, index / Math.max(1, Math.round(spec.fragmentCount * 0.5) - 1))
      const shardRadius = spec.secondaryRadius + rng.realInRange(-2, 4)
      const shardX = centerX + Math.cos(shardAngle) * shardRadius
      const shardY = centerY + Math.sin(shardAngle) * shardRadius
      const shardTilt = shardAngle - Math.PI * 0.5 + rng.realInRange(-0.12, 0.12)
      const shardTipX = shardX + Math.cos(shardTilt) * rng.realInRange(6, 10)
      const shardTipY = shardY + Math.sin(shardTilt) * rng.realInRange(6, 10)
      graphics.lineStyle(rng.realInRange(0.8, 1.4), index % 2 === 0 ? SWORD_RED_HIGHLIGHT : SWORD_RED_MID, spec.alpha * rng.realInRange(0.18, 0.34))
      graphics.beginPath()
      graphics.moveTo(shardX, shardY)
      graphics.lineTo(shardTipX, shardTipY)
      graphics.strokePath()
    }

    graphics.generateTexture(textureKey, size, size)
    graphics.destroy()
  }

  /** 生成敌人（追猎者/冲锋者）纹理序列。 */
  private createEnemyTextures() {
    const chaserMovePoses: ChaserFramePose[] = [
      { lean: 0.16, stride: -0.86, bladeTilt: -0.22, cloakDrag: 0.18, eyeGlow: 0.34, dissolve: 0, maskTilt: -0.08 },
      { lean: 0.24, stride: -0.48, bladeTilt: -0.14, cloakDrag: 0.24, eyeGlow: 0.4, dissolve: 0, maskTilt: -0.05 },
      { lean: 0.32, stride: -0.12, bladeTilt: -0.08, cloakDrag: 0.28, eyeGlow: 0.46, dissolve: 0, maskTilt: -0.02 },
      { lean: 0.3, stride: 0.18, bladeTilt: 0.02, cloakDrag: 0.26, eyeGlow: 0.42, dissolve: 0, maskTilt: 0.02 },
      { lean: 0.22, stride: 0.56, bladeTilt: 0.1, cloakDrag: 0.22, eyeGlow: 0.38, dissolve: 0, maskTilt: 0.04 },
      { lean: 0.14, stride: 0.9, bladeTilt: 0.18, cloakDrag: 0.18, eyeGlow: 0.34, dissolve: 0, maskTilt: 0.06 },
    ]
    const chaserDeathPoses: ChaserFramePose[] = [
      { lean: 0.28, stride: 0.08, bladeTilt: 0.12, cloakDrag: 0.24, eyeGlow: 0.3, dissolve: 0.12, maskTilt: 0.04 },
      { lean: 0.38, stride: -0.06, bladeTilt: 0.24, cloakDrag: 0.28, eyeGlow: 0.22, dissolve: 0.42, maskTilt: 0.08 },
      { lean: 0.48, stride: -0.18, bladeTilt: 0.42, cloakDrag: 0.32, eyeGlow: 0.14, dissolve: 0.74, maskTilt: 0.12 },
      { lean: 0.56, stride: -0.24, bladeTilt: 0.58, cloakDrag: 0.36, eyeGlow: 0.08, dissolve: 1, maskTilt: 0.16 },
    ]
    const chargerMovePoses: ChargerFramePose[] = [
      { lean: -0.08, stride: -0.78, shoulderLift: 0.1, warn: 0, charge: 0, runeGlow: 0, armDrive: 0.16, collapse: 0, scatter: 0 },
      { lean: 0, stride: -0.4, shoulderLift: 0.14, warn: 0, charge: 0, runeGlow: 0, armDrive: 0.12, collapse: 0, scatter: 0 },
      { lean: 0.08, stride: -0.08, shoulderLift: 0.18, warn: 0, charge: 0, runeGlow: 0, armDrive: 0.08, collapse: 0, scatter: 0 },
      { lean: 0.08, stride: 0.16, shoulderLift: 0.14, warn: 0, charge: 0, runeGlow: 0, armDrive: 0.08, collapse: 0, scatter: 0 },
      { lean: 0, stride: 0.48, shoulderLift: 0.12, warn: 0, charge: 0, runeGlow: 0, armDrive: 0.12, collapse: 0, scatter: 0 },
      { lean: -0.08, stride: 0.82, shoulderLift: 0.08, warn: 0, charge: 0, runeGlow: 0, armDrive: 0.16, collapse: 0, scatter: 0 },
    ]
    const chargerTellPoses: ChargerFramePose[] = [
      { lean: 0.08, stride: -0.04, shoulderLift: 0.18, warn: 0.28, charge: 0, runeGlow: 0.34, armDrive: 0.2, collapse: 0.04, scatter: 0 },
      { lean: 0.16, stride: -0.02, shoulderLift: 0.24, warn: 0.52, charge: 0, runeGlow: 0.56, armDrive: 0.28, collapse: 0.08, scatter: 0 },
      { lean: 0.24, stride: 0.02, shoulderLift: 0.3, warn: 0.78, charge: 0.08, runeGlow: 0.8, armDrive: 0.38, collapse: 0.14, scatter: 0 },
      { lean: 0.32, stride: 0.04, shoulderLift: 0.36, warn: 1, charge: 0.14, runeGlow: 1, armDrive: 0.5, collapse: 0.2, scatter: 0 },
    ]
    const chargerChargePoses: ChargerFramePose[] = [
      { lean: 0.38, stride: -0.18, shoulderLift: 0.18, warn: 0.56, charge: 0.34, runeGlow: 0.68, armDrive: 0.6, collapse: 0.04, scatter: 0 },
      { lean: 0.5, stride: 0.02, shoulderLift: 0.14, warn: 0.44, charge: 0.62, runeGlow: 0.58, armDrive: 0.82, collapse: 0.02, scatter: 0 },
      { lean: 0.62, stride: 0.18, shoulderLift: 0.1, warn: 0.36, charge: 1, runeGlow: 0.46, armDrive: 1, collapse: 0.02, scatter: 0 },
      { lean: 0.52, stride: 0.28, shoulderLift: 0.12, warn: 0.28, charge: 0.74, runeGlow: 0.38, armDrive: 0.86, collapse: 0.03, scatter: 0 },
    ]
    const chargerDeathPoses: ChargerFramePose[] = [
      { lean: 0.2, stride: 0, shoulderLift: 0.12, warn: 0.24, charge: 0.12, runeGlow: 0.3, armDrive: 0.18, collapse: 0.16, scatter: 0.18 },
      { lean: 0.34, stride: -0.08, shoulderLift: 0.08, warn: 0.16, charge: 0.08, runeGlow: 0.22, armDrive: 0.08, collapse: 0.44, scatter: 0.44 },
      { lean: 0.5, stride: -0.18, shoulderLift: 0.02, warn: 0.1, charge: 0.02, runeGlow: 0.14, armDrive: -0.04, collapse: 0.76, scatter: 0.72 },
      { lean: 0.62, stride: -0.26, shoulderLift: 0, warn: 0.04, charge: 0, runeGlow: 0.06, armDrive: -0.1, collapse: 1, scatter: 1 },
    ]

    CHASER_MOVE_FRAMES.forEach((key, index) => this.drawChaserFrame(key, chaserMovePoses[index], 'move'))
    CHASER_DEATH_FRAMES.forEach((key, index) => this.drawChaserFrame(key, chaserDeathPoses[index], 'death'))
    CHARGER_MOVE_FRAMES.forEach((key, index) => this.drawChargerFrame(key, chargerMovePoses[index], 'move'))
    CHARGER_TELL_FRAMES.forEach((key, index) => this.drawChargerFrame(key, chargerTellPoses[index], 'tell'))
    CHARGER_CHARGE_FRAMES.forEach((key, index) => this.drawChargerFrame(key, chargerChargePoses[index], 'charge'))
    CHARGER_DEATH_FRAMES.forEach((key, index) => this.drawChargerFrame(key, chargerDeathPoses[index], 'death'))
  }

  /** 绘制追猎者帧纹理。 */
  private drawChaserFrame(textureKey: string, pose: ChaserFramePose, mode: 'move' | 'death') {
    const width = 74
    const height = 86
    const centerX = 35
    const shoulderY = 31
    const hipY = 53 + pose.dissolve * 3
    const groundY = 72
    const dissolveAlpha = 1 - pose.dissolve * 0.48
    const leanX = pose.lean * 14
    const headX = centerX + leanX * 0.24
    const headY = 21 + pose.lean * 1.2
    const chestX = centerX - 1 + leanX * 0.44
    const chestY = shoulderY + pose.lean * 1.8
    const hipX = centerX + 5 + leanX
    const weaponHandX = chestX + 14 + pose.stride * 1.8 + pose.lean * 5
    const weaponHandY = shoulderY + 14 - pose.lean * 2.2 + pose.dissolve * 6
    const rearHandX = chestX - 10 - pose.stride * 1.4
    const rearHandY = shoulderY + 17 + Math.abs(pose.stride) * 2.4 + pose.dissolve * 4
    const frontKneeX = hipX + 4 - pose.stride * 4.2
    const frontKneeY = hipY + 14 + Math.max(0, -pose.stride) * 2
    const backKneeX = hipX - 8 + pose.stride * 3.1
    const backKneeY = hipY + 10 + Math.max(0, pose.stride) * 2.6
    const frontFootX = centerX + 8 + pose.stride * 8.8
    const frontFootY = groundY + Math.max(0, -pose.stride) * 1.8 + pose.dissolve * 4
    const backFootX = centerX - 10 - pose.stride * 6.2
    const backFootY = groundY + Math.max(0, pose.stride) * 1.5 + pose.dissolve * 3
    const graphics = this.add.graphics({ x: 0, y: 0 })
    const rng = new Phaser.Math.RandomDataGenerator([`enemy-chaser-${textureKey}`])

    graphics.fillStyle(MONSTER_SHADE, 0.12)
    graphics.fillEllipse(centerX + 2, groundY + 6, 28 - pose.dissolve * 10, 7 - pose.dissolve * 2)

    this.drawTatteredCloak(
      graphics,
      chestX - 2,
      shoulderY - 3,
      hipX,
      groundY,
      16 + pose.cloakDrag * 16,
      12 + pose.lean * 6,
      0.54 * dissolveAlpha,
      rng,
    )
    this.drawChaserBody(
      graphics,
      chestX,
      chestY,
      hipX,
      hipY,
      rearHandX,
      rearHandY,
      weaponHandX,
      weaponHandY,
      frontKneeX,
      frontKneeY,
      backKneeX,
      backKneeY,
      frontFootX,
      frontFootY,
      backFootX,
      backFootY,
      dissolveAlpha,
    )
    this.drawChaserMask(graphics, headX, headY, pose, dissolveAlpha, rng)
    this.drawBrokenBlade(graphics, weaponHandX, weaponHandY, -0.16 + pose.bladeTilt, 18, dissolveAlpha, rng)

    if (mode === 'death') {
      for (let index = 0; index < 8; index += 1) {
        const scatterX = centerX + rng.realInRange(-18, 18) + pose.dissolve * index * 1.4
        const scatterY = groundY - 12 + rng.realInRange(-18, 8) + pose.dissolve * 8
        graphics.fillStyle(index % 2 === 0 ? MONSTER_SHADE : MONSTER_BROWN, 0.28 * dissolveAlpha)
        graphics.fillCircle(scatterX, scatterY, rng.realInRange(1.6, 4.6) * (1 + pose.dissolve * 0.2))
      }
    }

    graphics.generateTexture(textureKey, width, height)
    graphics.destroy()
  }

  /** 绘制冲锋者帧纹理（含预警与冲锋阶段）。 */
  private drawChargerFrame(textureKey: string, pose: ChargerFramePose, mode: 'move' | 'tell' | 'charge' | 'death') {
    const width = 96
    const height = 98
    const centerX = 46
    const groundY = 82
    const leanX = pose.lean * 16 + pose.charge * 10
    const headX = centerX + leanX * 0.22
    const headY = 20 + pose.collapse * 2.4
    const chestTopY = 33 + pose.collapse * 2.2
    const chestBottomY = 57 + pose.collapse * 5.2
    const chestLeftX = centerX - 18 + leanX * 0.22
    const chestRightX = centerX + 20 + leanX * 0.72
    const hipX = centerX + 2 + leanX
    const hipY = 64 + pose.collapse * 6
    const rearShoulderX = chestLeftX + 2
    const frontShoulderX = chestRightX - 3
    const rearElbowX = chestLeftX - 8 - pose.armDrive * 4 + pose.stride * 2.4
    const rearElbowY = chestTopY + 16 + pose.charge * 4
    const frontElbowX = chestRightX + 4 + pose.armDrive * 7 + pose.charge * 8
    const frontElbowY = chestTopY + 18 + pose.charge * 5
    const rearHandX = rearElbowX - 6 - pose.armDrive * 2
    const rearHandY = rearElbowY + 11 + pose.collapse * 3
    const frontHandX = frontElbowX + 8 + pose.charge * 7
    const frontHandY = frontElbowY + 10 + pose.collapse * 3
    const frontKneeX = hipX + 8 - pose.stride * 5 + pose.charge * 4
    const frontKneeY = hipY + 10 + pose.charge * 2
    const backKneeX = hipX - 10 + pose.stride * 4
    const backKneeY = hipY + 9 + Math.abs(pose.stride) * 2
    const frontFootX = centerX + 12 + pose.stride * 9 + pose.charge * 10
    const frontFootY = groundY + Math.max(0, -pose.stride) * 2 + pose.collapse * 2.6
    const backFootX = centerX - 13 - pose.stride * 7
    const backFootY = groundY + Math.max(0, pose.stride) * 2 + pose.collapse * 2
    const graphics = this.add.graphics({ x: 0, y: 0 })
    const rng = new Phaser.Math.RandomDataGenerator([`enemy-charger-${textureKey}`])
    const alpha = 1 - pose.collapse * 0.38

    graphics.fillStyle(MONSTER_SHADE, 0.14)
    graphics.fillEllipse(centerX + 1 + pose.charge * 3, groundY + 7, 40 - pose.collapse * 8, 10 - pose.collapse * 2)

    this.drawChargerBody(
      graphics,
      chestLeftX,
      chestRightX,
      chestTopY,
      chestBottomY,
      hipX,
      hipY,
      rearElbowX,
      rearElbowY,
      frontElbowX,
      frontElbowY,
      rearHandX,
      rearHandY,
      frontHandX,
      frontHandY,
      frontKneeX,
      frontKneeY,
      backKneeX,
      backKneeY,
      frontFootX,
      frontFootY,
      backFootX,
      backFootY,
      pose,
      alpha,
    )
    this.drawChargerShoulderPlates(graphics, rearShoulderX, frontShoulderX, chestTopY + 2, pose, alpha)
    this.drawChargerHelmet(graphics, headX, headY, pose, alpha)
    this.drawChargerForeguard(graphics, rearElbowX, rearElbowY, rearHandX, rearHandY, 7, alpha)
    this.drawChargerForeguard(graphics, frontElbowX, frontElbowY, frontHandX, frontHandY, 9, alpha)
    this.drawWarningRunes(graphics, headX, chestLeftX, chestRightX, chestTopY, chestBottomY, groundY, pose, alpha, mode)

    if (mode === 'death') {
      for (let index = 0; index < 6; index += 1) {
        const shardX = centerX + rng.realInRange(-18, 20) + pose.scatter * 18 * (index % 2 === 0 ? 1 : -1)
        const shardY = chestBottomY - 4 + rng.realInRange(-14, 14) + pose.scatter * index * 3
        const shardW = rng.realInRange(4, 8)
        const shardH = rng.realInRange(2.5, 5.5)
        graphics.fillStyle(index % 2 === 0 ? ARMOR_MID : MONSTER_SHADE, 0.3 * alpha)
        graphics.fillRect(shardX, shardY, shardW, shardH)
      }
    }

    graphics.generateTexture(textureKey, width, height)
    graphics.destroy()
  }

  /** 绘制追猎者身体结构。 */
  private drawChaserBody(
    graphics: Phaser.GameObjects.Graphics,
    chestX: number,
    chestY: number,
    hipX: number,
    hipY: number,
    rearHandX: number,
    rearHandY: number,
    weaponHandX: number,
    weaponHandY: number,
    frontKneeX: number,
    frontKneeY: number,
    backKneeX: number,
    backKneeY: number,
    frontFootX: number,
    frontFootY: number,
    backFootX: number,
    backFootY: number,
    alpha: number,
  ) {
    graphics.fillStyle(MONSTER_INK, 0.92 * alpha)
    graphics.beginPath()
    graphics.moveTo(chestX - 5, chestY - 2)
    graphics.lineTo(chestX + 4, chestY - 1)
    graphics.lineTo(hipX + 4, hipY + 5)
    graphics.lineTo(hipX - 4, hipY + 4)
    graphics.closePath()
    graphics.fillPath()

    graphics.fillStyle(MONSTER_BROWN, 0.42 * alpha)
    graphics.beginPath()
    graphics.moveTo(chestX - 3, chestY)
    graphics.lineTo(chestX + 2, chestY + 1)
    graphics.lineTo(hipX + 1, hipY + 3)
    graphics.lineTo(hipX - 3, hipY + 2)
    graphics.closePath()
    graphics.fillPath()

    this.drawEnemyStroke(graphics, [{ x: chestX - 1, y: chestY + 1 }, { x: rearHandX - 3, y: rearHandY - 6 }, { x: rearHandX, y: rearHandY }], 2, MONSTER_SHADE, 0.9 * alpha)
    this.drawEnemyStroke(graphics, [{ x: chestX + 2, y: chestY }, { x: weaponHandX - 6, y: weaponHandY - 7 }, { x: weaponHandX, y: weaponHandY }], 2.3, MONSTER_INK, 0.96 * alpha)
    this.drawEnemyStroke(graphics, [{ x: hipX, y: hipY }, { x: backKneeX, y: backKneeY }, { x: backFootX, y: backFootY }], 2.25, MONSTER_SHADE, 0.92 * alpha)
    this.drawEnemyStroke(graphics, [{ x: hipX + 1, y: hipY }, { x: frontKneeX, y: frontKneeY }, { x: frontFootX, y: frontFootY }], 2.4, MONSTER_INK, 0.96 * alpha)
    graphics.fillStyle(MONSTER_SHADE, 0.72 * alpha)
    graphics.fillCircle(frontKneeX, frontKneeY, 1.8)
    graphics.fillCircle(backKneeX, backKneeY, 1.5)
  }

  /** 绘制追猎者面甲与眼部发光效果。 */
  private drawChaserMask(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    centerY: number,
    pose: ChaserFramePose,
    alpha: number,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const topWidth = 7
    const bottomWidth = 10
    const height = 15
    const tilt = pose.maskTilt * 6

    graphics.fillStyle(MONSTER_SMOKE, 0.82 * alpha)
    graphics.beginPath()
    graphics.moveTo(centerX - topWidth * 0.5 + tilt * 0.08, centerY - height * 0.5)
    graphics.lineTo(centerX + topWidth * 0.5 + tilt * 0.08, centerY - height * 0.5 + 0.8)
    graphics.lineTo(centerX + bottomWidth * 0.5 - tilt * 0.12, centerY + height * 0.5)
    graphics.lineTo(centerX - bottomWidth * 0.5 - tilt * 0.12, centerY + height * 0.5 - 0.6)
    graphics.closePath()
    graphics.fillPath()

    graphics.lineStyle(1.4, MONSTER_INK, 0.96 * alpha)
    graphics.strokePath()

    graphics.fillStyle(WARNING_RED_LIGHT, (0.24 + pose.eyeGlow * 0.46) * alpha)
    graphics.fillEllipse(centerX - 2.2, centerY - 1.8, 2.2, 1.6)
    graphics.fillEllipse(centerX + 2.2, centerY - 1.1, 2.2, 1.6)
    graphics.lineStyle(0.9, MONSTER_INK, 0.56 * alpha)
    graphics.beginPath()
    graphics.moveTo(centerX - 1.2 + rng.realInRange(-0.2, 0.2), centerY + 1)
    graphics.lineTo(centerX + 0.8 + rng.realInRange(-0.2, 0.2), centerY + 5.6)
    graphics.strokePath()
  }

  /** 绘制追猎者破损刀刃。 */
  private drawBrokenBlade(
    graphics: Phaser.GameObjects.Graphics,
    handX: number,
    handY: number,
    angle: number,
    length: number,
    alpha: number,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const tipX = handX + Math.cos(angle) * length
    const tipY = handY + Math.sin(angle) * length
    const normalX = -Math.sin(angle)
    const normalY = Math.cos(angle)

    graphics.fillStyle(MONSTER_SHADE, 0.84 * alpha)
    graphics.beginPath()
    graphics.moveTo(handX + normalX * 2.2, handY + normalY * 2.2)
    graphics.lineTo(tipX + normalX * 1.1, tipY + normalY * 1.1)
    graphics.lineTo(tipX - normalX * 0.8 - Math.cos(angle) * 2.8, tipY - normalY * 0.8 - Math.sin(angle) * 2.8)
    graphics.lineTo(tipX - normalX * 2.6, tipY - normalY * 2.6)
    graphics.lineTo(handX - normalX * 2.2, handY - normalY * 2.2)
    graphics.closePath()
    graphics.fillPath()

    graphics.lineStyle(1.15, MONSTER_INK, 0.94 * alpha)
    graphics.beginPath()
    graphics.moveTo(handX + normalX * 2.2, handY + normalY * 2.2)
    graphics.lineTo(tipX + normalX * 1.1, tipY + normalY * 1.1)
    graphics.lineTo(tipX - normalX * 0.8 - Math.cos(angle) * 2.8, tipY - normalY * 0.8 - Math.sin(angle) * 2.8)
    graphics.lineTo(tipX - normalX * 2.6, tipY - normalY * 2.6)
    graphics.lineTo(handX - normalX * 2.2, handY - normalY * 2.2)
    graphics.closePath()
    graphics.strokePath()

    for (let index = 0; index < 2; index += 1) {
      const notchT = 0.45 + index * 0.18
      const notchX = Phaser.Math.Linear(handX, tipX, notchT) + rng.realInRange(-0.4, 0.4)
      const notchY = Phaser.Math.Linear(handY, tipY, notchT) + rng.realInRange(-0.4, 0.4)
      graphics.lineStyle(0.9, MONSTER_INK, 0.68 * alpha)
      graphics.beginPath()
      graphics.moveTo(notchX - normalX * 2.2, notchY - normalY * 2.2)
      graphics.lineTo(notchX + normalX * 0.8, notchY + normalY * 0.8)
      graphics.strokePath()
    }

    graphics.lineStyle(2.1, MONSTER_BROWN, 0.88 * alpha)
    graphics.beginPath()
    graphics.moveTo(handX, handY)
    graphics.lineTo(handX - Math.cos(angle) * 5, handY - Math.sin(angle) * 5)
    graphics.strokePath()
  }

  /** 绘制追猎者残破披风。 */
  private drawTatteredCloak(
    graphics: Phaser.GameObjects.Graphics,
    shoulderX: number,
    shoulderY: number,
    hipX: number,
    groundY: number,
    backReach: number,
    frontReach: number,
    alpha: number,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const hemY = groundY - 7
    const backX = shoulderX - backReach
    const midX = hipX - 8
    const frontX = hipX + frontReach

    graphics.fillStyle(MONSTER_SHADE, alpha)
    graphics.beginPath()
    graphics.moveTo(shoulderX - 4, shoulderY)
    graphics.lineTo(shoulderX + 7, shoulderY + 1.5)
    graphics.lineTo(frontX, hemY - 4)
    graphics.lineTo(midX + 5, hemY + 5)
    graphics.lineTo(midX - 6, hemY - 1)
    graphics.lineTo(backX, hemY + 3)
    graphics.closePath()
    graphics.fillPath()

    graphics.lineStyle(1.4, MONSTER_INK, 0.88 * alpha)
    graphics.beginPath()
    graphics.moveTo(shoulderX - 4, shoulderY)
    graphics.lineTo(shoulderX + 7, shoulderY + 1.5)
    graphics.lineTo(frontX, hemY - 4)
    graphics.lineTo(midX + 5, hemY + 5)
    graphics.lineTo(midX - 6, hemY - 1)
    graphics.lineTo(backX, hemY + 3)
    graphics.closePath()
    graphics.strokePath()

    for (let index = 0; index < 4; index += 1) {
      const stripX = Phaser.Math.Linear(backX + 4, frontX - 5, index / 3)
      this.drawEnemyStroke(
        graphics,
        [
          { x: shoulderX + rng.realInRange(-1.4, 1.2), y: shoulderY + rng.realInRange(-0.4, 1.2) },
          { x: stripX + rng.realInRange(-2, 2), y: hemY - 1 + rng.realInRange(-3, 4) },
        ],
        0.9,
        MONSTER_BROWN,
        0.36 * alpha,
      )
    }
  }

  /** 绘制冲锋者主体结构。 */
  private drawChargerBody(
    graphics: Phaser.GameObjects.Graphics,
    chestLeftX: number,
    chestRightX: number,
    chestTopY: number,
    chestBottomY: number,
    hipX: number,
    hipY: number,
    rearElbowX: number,
    rearElbowY: number,
    frontElbowX: number,
    frontElbowY: number,
    rearHandX: number,
    rearHandY: number,
    frontHandX: number,
    frontHandY: number,
    frontKneeX: number,
    frontKneeY: number,
    backKneeX: number,
    backKneeY: number,
    frontFootX: number,
    frontFootY: number,
    backFootX: number,
    backFootY: number,
    pose: ChargerFramePose,
    alpha: number,
  ) {
    const waistClothDrop = 6 + pose.charge * 5 + pose.collapse * 3

    graphics.fillStyle(ARMOR_DARK, 0.96 * alpha)
    graphics.beginPath()
    graphics.moveTo(chestLeftX, chestTopY + 3)
    graphics.lineTo(chestRightX, chestTopY)
    graphics.lineTo(chestRightX - 2, chestBottomY)
    graphics.lineTo(hipX + 9, hipY)
    graphics.lineTo(hipX - 10, hipY + 1)
    graphics.lineTo(chestLeftX + 2, chestBottomY + 1)
    graphics.closePath()
    graphics.fillPath()

    graphics.fillStyle(ARMOR_MID, 0.54 * alpha)
    graphics.beginPath()
    graphics.moveTo(chestLeftX + 4, chestTopY + 5)
    graphics.lineTo(chestRightX - 4, chestTopY + 3)
    graphics.lineTo(chestRightX - 5, chestBottomY - 3)
    graphics.lineTo(chestLeftX + 5, chestBottomY - 1)
    graphics.closePath()
    graphics.fillPath()

    graphics.lineStyle(1.8, ARMOR_EDGE, 0.76 * alpha)
    graphics.beginPath()
    graphics.moveTo(chestLeftX, chestTopY + 3)
    graphics.lineTo(chestRightX, chestTopY)
    graphics.lineTo(chestRightX - 2, chestBottomY)
    graphics.lineTo(hipX + 9, hipY)
    graphics.lineTo(hipX - 10, hipY + 1)
    graphics.lineTo(chestLeftX + 2, chestBottomY + 1)
    graphics.closePath()
    graphics.strokePath()

    graphics.fillStyle(MONSTER_BROWN, 0.54 * alpha)
    graphics.beginPath()
    graphics.moveTo(hipX - 10, hipY)
    graphics.lineTo(hipX + 9, hipY - 1)
    graphics.lineTo(hipX + 3, hipY + waistClothDrop)
    graphics.lineTo(hipX - 7, hipY + waistClothDrop - 2)
    graphics.closePath()
    graphics.fillPath()

    this.drawEnemyStroke(graphics, [{ x: chestLeftX + 3, y: chestTopY + 10 }, { x: rearElbowX, y: rearElbowY }, { x: rearHandX, y: rearHandY }], 5.2, MONSTER_SHADE, 0.92 * alpha)
    this.drawEnemyStroke(graphics, [{ x: chestRightX - 2, y: chestTopY + 11 }, { x: frontElbowX, y: frontElbowY }, { x: frontHandX, y: frontHandY }], 6, MONSTER_INK, 0.96 * alpha)
    this.drawEnemyStroke(graphics, [{ x: hipX - 3, y: hipY }, { x: backKneeX, y: backKneeY }, { x: backFootX, y: backFootY }], 5.2, MONSTER_SHADE, 0.92 * alpha)
    this.drawEnemyStroke(graphics, [{ x: hipX + 5, y: hipY }, { x: frontKneeX, y: frontKneeY }, { x: frontFootX, y: frontFootY }], 5.6, MONSTER_INK, 0.96 * alpha)
  }

  /** 绘制冲锋者头盔。 */
  private drawChargerHelmet(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    centerY: number,
    pose: ChargerFramePose,
    alpha: number,
  ) {
    const width = 24 - pose.collapse * 3
    const height = 20 - pose.collapse * 2
    const browDrop = pose.warn * 1.4 + pose.charge * 2

    graphics.fillStyle(ARMOR_DARK, 0.96 * alpha)
    graphics.fillRoundedRect(centerX - width * 0.5, centerY - height * 0.4, width, height, 5)
    graphics.fillStyle(ARMOR_MID, 0.42 * alpha)
    graphics.fillRoundedRect(centerX - width * 0.34, centerY - height * 0.18, width * 0.68, height * 0.36, 4)

    graphics.lineStyle(1.8, ARMOR_EDGE, 0.76 * alpha)
    graphics.strokeRoundedRect(centerX - width * 0.5, centerY - height * 0.4, width, height, 5)

    graphics.fillStyle(MONSTER_SHADE, 0.9 * alpha)
    graphics.fillRect(centerX - 7, centerY + 1.8 + browDrop, 14, 7.6)

    graphics.fillStyle(WARNING_RED_LIGHT, (0.14 + pose.runeGlow * 0.42) * alpha)
    graphics.fillRect(centerX - 5.2, centerY + 3.6 + browDrop, 3.2, 1.6)
    graphics.fillRect(centerX + 2, centerY + 3.2 + browDrop, 3.2, 1.6)

    graphics.lineStyle(1.1, WARNING_RED_MID, (0.18 + pose.runeGlow * 0.38) * alpha)
    graphics.beginPath()
    graphics.moveTo(centerX, centerY - 6)
    graphics.lineTo(centerX, centerY + 8)
    graphics.strokePath()
  }

  /** 绘制冲锋者肩甲。 */
  private drawChargerShoulderPlates(
    graphics: Phaser.GameObjects.Graphics,
    rearShoulderX: number,
    frontShoulderX: number,
    shoulderY: number,
    pose: ChargerFramePose,
    alpha: number,
  ) {
    const lift = pose.shoulderLift * 6
    const spread = 9 + pose.charge * 3

    graphics.fillStyle(ARMOR_MID, 0.88 * alpha)
    graphics.beginPath()
    graphics.moveTo(rearShoulderX - spread, shoulderY + 3 - lift)
    graphics.lineTo(rearShoulderX + 5, shoulderY - 4 - lift * 0.6)
    graphics.lineTo(rearShoulderX + 6, shoulderY + 8)
    graphics.lineTo(rearShoulderX - spread + 4, shoulderY + 11)
    graphics.closePath()
    graphics.fillPath()
    graphics.lineStyle(1.4, ARMOR_EDGE, 0.72 * alpha)
    graphics.strokePath()

    graphics.fillStyle(ARMOR_MID, 0.88 * alpha)
    graphics.beginPath()
    graphics.moveTo(frontShoulderX - 5, shoulderY - 4 - lift * 0.6)
    graphics.lineTo(frontShoulderX + spread, shoulderY + 1 - lift)
    graphics.lineTo(frontShoulderX + spread - 4, shoulderY + 12)
    graphics.lineTo(frontShoulderX - 6, shoulderY + 9)
    graphics.closePath()
    graphics.fillPath()
    graphics.strokePath()
  }

  /** 绘制冲锋者前臂护甲。 */
  private drawChargerForeguard(
    graphics: Phaser.GameObjects.Graphics,
    elbowX: number,
    elbowY: number,
    handX: number,
    handY: number,
    guardWidth: number,
    alpha: number,
  ) {
    const angle = Math.atan2(handY - elbowY, handX - elbowX)
    const normalX = -Math.sin(angle)
    const normalY = Math.cos(angle)
    const inset = 5

    graphics.fillStyle(ARMOR_MID, 0.9 * alpha)
    graphics.beginPath()
    graphics.moveTo(elbowX + normalX * guardWidth, elbowY + normalY * guardWidth)
    graphics.lineTo(elbowX - normalX * guardWidth, elbowY - normalY * guardWidth)
    graphics.lineTo(handX - normalX * (guardWidth - 1) - Math.cos(angle) * inset, handY - normalY * (guardWidth - 1) - Math.sin(angle) * inset)
    graphics.lineTo(handX + normalX * (guardWidth - 1) - Math.cos(angle) * inset, handY + normalY * (guardWidth - 1) - Math.sin(angle) * inset)
    graphics.closePath()
    graphics.fillPath()

    graphics.lineStyle(1.1, ARMOR_EDGE, 0.72 * alpha)
    graphics.strokePath()
  }

  /** 绘制冲锋预警符文发光。 */
  private drawWarningRunes(
    graphics: Phaser.GameObjects.Graphics,
    headX: number,
    chestLeftX: number,
    chestRightX: number,
    chestTopY: number,
    chestBottomY: number,
    groundY: number,
    pose: ChargerFramePose,
    alpha: number,
    mode: 'move' | 'tell' | 'charge' | 'death',
  ) {
    if (pose.runeGlow <= 0.01 && mode === 'move') {
      return
    }

    const glow = (0.16 + pose.runeGlow * 0.52) * alpha
    graphics.lineStyle(1.25 + pose.warn * 0.7, WARNING_RED_MID, glow)
    graphics.beginPath()
    graphics.moveTo(headX - 6, chestTopY + 10)
    graphics.lineTo(headX, chestTopY + 16)
    graphics.lineTo(headX + 6, chestTopY + 10)
    graphics.moveTo(headX - 10, chestTopY + 19)
    graphics.lineTo(headX, chestTopY + 24)
    graphics.lineTo(headX + 10, chestTopY + 19)
    graphics.strokePath()

    if (mode === 'tell' || mode === 'charge') {
      graphics.lineStyle(1.4 + pose.warn * 0.6, WARNING_RED_LIGHT, (0.22 + pose.runeGlow * 0.48) * alpha)
      graphics.beginPath()
      graphics.moveTo(chestLeftX + 6, chestBottomY - 7)
      graphics.lineTo(chestLeftX + 12, chestBottomY - 1)
      graphics.lineTo(chestRightX - 10, chestBottomY - 8)
      graphics.lineTo(chestRightX - 4, chestBottomY - 2)
      graphics.strokePath()

      for (let index = 0; index < 3; index += 1) {
        const lineY = groundY + 1 + index * 2
        const span = 10 + pose.warn * 12 - index * 3
        graphics.lineStyle(1, WARNING_RED_MID, (0.1 + pose.warn * 0.2) * alpha)
        graphics.beginPath()
        graphics.moveTo(headX - span, lineY)
        graphics.lineTo(headX + span, lineY)
        graphics.strokePath()
      }
    }
  }

  /** 绘制箭矢本体纹理。 */
  private createArrowTexture(key: string) {
    const graphics = this.make.graphics()
    graphics.fillStyle(BOW_BLUE_DARK, 0.98)
    graphics.fillRect(2, 4, 18, 2)
    graphics.fillStyle(BOW_BLUE_MID, 0.96)
    graphics.fillRect(2, 3, 18, 4)
    graphics.fillStyle(BOW_BLUE_LIGHT, 0.96)
    graphics.fillTriangle(18, 1, 18, 9, 25, 5)
    graphics.fillTriangle(0, 1, 0, 9, 5, 5)
    graphics.lineStyle(1, BOW_BLUE_HIGHLIGHT, 0.8)
    graphics.beginPath()
    graphics.moveTo(4, 4)
    graphics.lineTo(18.5, 4)
    graphics.strokePath()
    graphics.generateTexture(key, 26, 10)
    graphics.destroy()
  }

  /** 生成箭尾拖影纹理序列。 */
  private createArrowTrailTextures() {
    const frames: ArrowTrailFrame[] = [
      { length: 24, width: 6.5, alpha: 0.26, glowAlpha: 0.34 },
      { length: 32, width: 9, alpha: 0.42, glowAlpha: 0.56 },
      { length: 20, width: 5.4, alpha: 0.2, glowAlpha: 0.28 },
    ]

    ARROW_TRAIL_FRAMES.forEach((key, index) => {
      this.drawArrowTrailFrame(key, frames[index])
    })
  }

  /** 绘制手持霜翎逐月形态。 */
  private drawHeldBow(
    graphics: Phaser.GameObjects.Graphics,
    gripX: number,
    gripY: number,
    spec: {
      angle: number
      drawStrength: number
      length: number
      arrowOffset: number
      nockArrow: boolean
      alphaScale?: number
      highlightAlphaScale?: number
      stringAlphaScale?: number
    },
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const alphaScale = spec.alphaScale ?? 1
    const highlightAlphaScale = spec.highlightAlphaScale ?? alphaScale
    const stringAlphaScale = spec.stringAlphaScale ?? alphaScale
    const halfLength = spec.length * 0.5
    const axisX = Math.sin(spec.angle)
    const axisY = -Math.cos(spec.angle)
    const normalX = Math.cos(spec.angle)
    const normalY = Math.sin(spec.angle)
    const limbArc = 12.2 + spec.drawStrength * 4.6
    const tipFlare = 7 + spec.drawStrength * 1.2
    const shoulderArc = limbArc * 0.76
    const innerArc = limbArc * 0.54
    const topTipBaseX = gripX - axisX * halfLength
    const topTipBaseY = gripY - axisY * halfLength
    const bottomTipBaseX = gripX + axisX * halfLength
    const bottomTipBaseY = gripY + axisY * halfLength
    const topTipX = topTipBaseX + normalX * tipFlare
    const topTipY = topTipBaseY + normalY * tipFlare
    const bottomTipX = bottomTipBaseX + normalX * tipFlare
    const bottomTipY = bottomTipBaseY + normalY * tipFlare
    const topShoulderX = gripX - axisX * (halfLength * 0.72) + normalX * shoulderArc
    const topShoulderY = gripY - axisY * (halfLength * 0.72) + normalY * shoulderArc
    const bottomShoulderX = gripX + axisX * (halfLength * 0.72) + normalX * shoulderArc
    const bottomShoulderY = gripY + axisY * (halfLength * 0.72) + normalY * shoulderArc
    const topMidX = gripX - axisX * (halfLength * 0.38) + normalX * limbArc
    const topMidY = gripY - axisY * (halfLength * 0.38) + normalY * limbArc
    const bottomMidX = gripX + axisX * (halfLength * 0.38) + normalX * limbArc
    const bottomMidY = gripY + axisY * (halfLength * 0.38) + normalY * limbArc
    const topInnerX = gripX - axisX * (halfLength * 0.14) + normalX * innerArc
    const topInnerY = gripY - axisY * (halfLength * 0.14) + normalY * innerArc
    const bottomInnerX = gripX + axisX * (halfLength * 0.14) + normalX * innerArc
    const bottomInnerY = gripY + axisY * (halfLength * 0.14) + normalY * innerArc
    const gripInkX = gripX + rng.realInRange(-0.18, 0.18)
    const gripInkY = gripY + rng.realInRange(-0.18, 0.18)
    const stringPullX = gripX - normalX * (8.6 + spec.drawStrength * 15.4)
    const stringPullY = gripY - normalY * (0.2 + spec.drawStrength * 2.2)
    const arrowTailX = stringPullX - normalX * (10.5 + spec.drawStrength * 7.2) + spec.arrowOffset
    const arrowTailY = stringPullY - axisY * 0.2
    const arrowTipX = gripX + normalX * 18.5 + spec.arrowOffset
    const arrowTipY = gripY + normalY * 0.8
    const curvePoints = [
      new Phaser.Math.Vector2(topTipX, topTipY),
      new Phaser.Math.Vector2(topShoulderX, topShoulderY),
      new Phaser.Math.Vector2(topMidX, topMidY),
      new Phaser.Math.Vector2(topInnerX, topInnerY),
      new Phaser.Math.Vector2(gripInkX, gripInkY),
      new Phaser.Math.Vector2(bottomInnerX, bottomInnerY),
      new Phaser.Math.Vector2(bottomMidX, bottomMidY),
      new Phaser.Math.Vector2(bottomShoulderX, bottomShoulderY),
      new Phaser.Math.Vector2(bottomTipX, bottomTipY),
    ]
    const highlightPoints = [
      new Phaser.Math.Vector2(topTipX + normalX * 0.6, topTipY + normalY * 0.6),
      new Phaser.Math.Vector2(topShoulderX + normalX * 0.72, topShoulderY + normalY * 0.72),
      new Phaser.Math.Vector2(topMidX + normalX * 0.5, topMidY + normalY * 0.5),
      new Phaser.Math.Vector2(topInnerX + normalX * 0.34, topInnerY + normalY * 0.34),
      new Phaser.Math.Vector2(gripX, gripY),
      new Phaser.Math.Vector2(bottomInnerX + normalX * 0.34, bottomInnerY + normalY * 0.34),
      new Phaser.Math.Vector2(bottomMidX + normalX * 0.5, bottomMidY + normalY * 0.5),
      new Phaser.Math.Vector2(bottomShoulderX + normalX * 0.72, bottomShoulderY + normalY * 0.72),
      new Phaser.Math.Vector2(bottomTipX + normalX * 0.6, bottomTipY + normalY * 0.6),
    ]
    const innerLinePoints = [
      new Phaser.Math.Vector2(topInnerX, topInnerY),
      new Phaser.Math.Vector2(gripX + normalX * 0.7, gripY + normalY * 0.7),
      new Phaser.Math.Vector2(bottomInnerX, bottomInnerY),
    ]
    const strokeSpline = (points: Phaser.Math.Vector2[], width: number, color: number, alpha: number) => {
      const sampled = new Phaser.Curves.Spline(points).getPoints(22)
      graphics.lineStyle(width, color, alpha)
      graphics.beginPath()
      graphics.moveTo(sampled[0].x, sampled[0].y)
      for (let index = 1; index < sampled.length; index += 1) {
        graphics.lineTo(sampled[index].x, sampled[index].y)
      }
      graphics.strokePath()
    }

    strokeSpline(curvePoints, 4.1, BOW_BLUE_DARK, 0.96 * alphaScale)
    strokeSpline(highlightPoints, 2.6, BOW_BLUE_LIGHT, 0.92 * highlightAlphaScale)
    strokeSpline(innerLinePoints, 1.25, BOW_BLUE_HIGHLIGHT, 0.8 * highlightAlphaScale)

    graphics.lineStyle(1.4, BOW_STRING, 0.86 * stringAlphaScale)
    graphics.beginPath()
    graphics.moveTo(topTipX + normalX * 1.8, topTipY + normalY * 1.8)
    graphics.lineTo(stringPullX, stringPullY)
    graphics.lineTo(bottomTipX + normalX * 1.8, bottomTipY + normalY * 1.8)
    graphics.strokePath()

    graphics.lineStyle(1.1, BOW_BLUE_HIGHLIGHT, 0.64 * highlightAlphaScale)
    graphics.beginPath()
    graphics.moveTo(topTipX + normalX * 1.6, topTipY + normalY * 1.6)
    graphics.lineTo(topShoulderX + normalX * 1.2, topShoulderY + normalY * 1.2)
    graphics.moveTo(bottomTipX + normalX * 1.6, bottomTipY + normalY * 1.6)
    graphics.lineTo(bottomShoulderX + normalX * 1.2, bottomShoulderY + normalY * 1.2)
    graphics.strokePath()

    graphics.fillStyle(BOW_BLUE_MID, 0.94 * alphaScale)
    graphics.fillCircle(gripX, gripY, 2.5)
    graphics.fillStyle(BOW_BLUE_HIGHLIGHT, 0.78 * highlightAlphaScale)
    graphics.fillCircle(gripX + normalX * 0.3, gripY + normalY * 0.3, 1.2)

    if (!spec.nockArrow) {
      return
    }

    graphics.lineStyle(1.45, BOW_BLUE_DARK, 0.94 * alphaScale)
    graphics.beginPath()
    graphics.moveTo(arrowTailX, arrowTailY)
    graphics.lineTo(arrowTipX, arrowTipY)
    graphics.strokePath()

    graphics.lineStyle(1.05, BOW_BLUE_HIGHLIGHT, 0.82 * highlightAlphaScale)
    graphics.beginPath()
    graphics.moveTo(arrowTailX + normalX * 0.4, arrowTailY + normalY * 0.4)
    graphics.lineTo(arrowTipX - normalX * 2.4, arrowTipY - normalY * 2.4)
    graphics.strokePath()

    graphics.fillStyle(BOW_BLUE_LIGHT, 0.92 * alphaScale)
    graphics.fillTriangle(
      arrowTipX,
      arrowTipY,
      arrowTipX - normalX * 6 + axisX * 2.1,
      arrowTipY - normalY * 6 + axisY * 2.1,
      arrowTipX - normalX * 6 - axisX * 2.1,
      arrowTipY - normalY * 6 - axisY * 2.1,
    )
    graphics.fillTriangle(
      arrowTailX,
      arrowTailY,
      arrowTailX + normalX * 4.4 + axisX * 2,
      arrowTailY + normalY * 4.4 + axisY * 2,
      arrowTailX + normalX * 4.4 - axisX * 2,
      arrowTailY + normalY * 4.4 - axisY * 2,
    )
  }

  /** 绘制箭尾拖影单帧。 */
  private drawArrowTrailFrame(textureKey: string, spec: ArrowTrailFrame) {
    const width = 44
    const height = 20
    const centerY = height / 2
    const graphics = this.add.graphics({ x: 0, y: 0 })
    const tailEndX = 6
    const tipX = tailEndX + spec.length

    graphics.fillStyle(BOW_BLUE_MID, spec.alpha)
    graphics.fillEllipse(tailEndX + spec.length * 0.45, centerY, spec.length * 0.95, spec.width)
    graphics.fillStyle(BOW_BLUE_LIGHT, spec.glowAlpha)
    graphics.fillEllipse(tailEndX + spec.length * 0.56, centerY, spec.length * 0.62, spec.width * 0.72)
    graphics.fillStyle(BOW_BLUE_HIGHLIGHT, spec.glowAlpha * 0.84)
    graphics.fillTriangle(
      tipX,
      centerY,
      tipX - 8,
      centerY - spec.width * 0.28,
      tipX - 8,
      centerY + spec.width * 0.28,
    )
    graphics.generateTexture(textureKey, width, height)
    graphics.destroy()
  }

  /** 绘制武侠斗笠细节。 */
  private drawWuxiaHat(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    brimY: number,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const brimWidth = 42
    const brimHeight = 10.6
    const coneHeight = 16.2
    const apexX = centerX + rng.realInRange(-0.4, 0.4)
    const apexY = brimY - coneHeight

    graphics.fillStyle(INK_MID, 0.3)
    graphics.fillEllipse(centerX, brimY + 1.7, brimWidth * 0.96, brimHeight * 0.84)

    graphics.fillStyle(INK_MID, 0.36)
    graphics.beginPath()
    graphics.moveTo(apexX, apexY)
    graphics.lineTo(centerX + brimWidth * 0.52, brimY + 0.6)
    graphics.lineTo(centerX - brimWidth * 0.52, brimY + 0.6)
    graphics.closePath()
    graphics.fillPath()

    graphics.lineStyle(2.2, INK_DARK, 0.98)
    graphics.beginPath()
    graphics.moveTo(apexX, apexY)
    graphics.lineTo(centerX + brimWidth * 0.52, brimY + 0.6)
    graphics.lineTo(centerX - brimWidth * 0.52, brimY + 0.6)
    graphics.closePath()
    graphics.strokePath()
    graphics.strokeEllipse(centerX, brimY, brimWidth, brimHeight)
    graphics.lineStyle(1.4, INK_DARK, 0.9)
    graphics.strokeEllipse(centerX, brimY + 1.4, brimWidth * 0.9, brimHeight * 0.64)

    for (let index = 0; index < 5; index += 1) {
      const ratio = index / 4
      const brimX = Phaser.Math.Linear(centerX - brimWidth * 0.44, centerX + brimWidth * 0.44, ratio)
      this.drawDecorativeStroke(
        graphics,
        { x: apexX, y: apexY + 1.2 },
        { x: brimX, y: brimY + 0.4 },
        1,
        rng,
      )
    }

    for (let offset = -14; offset <= 14; offset += 4) {
      this.drawDecorativeStroke(
        graphics,
        { x: centerX + offset - 1.9, y: brimY - 3.2 },
        { x: centerX + offset + 1.9, y: brimY + 2.8 },
        1.05,
        rng,
      )
    }
  }

  /** 绘制角色后披风层。 */
  private drawCloakBack(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    shoulderY: number,
    legEndY: number,
    state: StickmanRenderState,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const cloakTopY = shoulderY - 3
    const hemY = legEndY - (state.isRun ? 1 : 4) - state.cloakLift * 2.6
    const sway = state.gait * 4.2 + state.lean * 9
    const backTrail = state.isRun ? 26 + Math.abs(state.gait) * 8 : 17
    const frontReach = state.isRun ? 11.8 : 16
    const leftShoulderX = centerX - 8.8
    const rightShoulderX = centerX + 8.8
    const hemBackX = centerX - backTrail + sway * 0.22
    const hemMidX = centerX - (state.isRun ? 10.4 : 2.4) + sway * 0.34
    const hemFrontX = centerX + frontReach + sway * 0.08

    graphics.fillStyle(INK_DARK, 0.5)
    graphics.beginPath()
    graphics.moveTo(leftShoulderX, cloakTopY)
    graphics.lineTo(rightShoulderX, cloakTopY)
    graphics.lineTo(hemFrontX, hemY - 2)
    graphics.lineTo(hemMidX, hemY + 4.4)
    graphics.lineTo(hemBackX, hemY + 0.8)
    graphics.closePath()
    graphics.fillPath()

    graphics.lineStyle(1.85, INK_DARK, 0.96)
    graphics.beginPath()
    graphics.moveTo(leftShoulderX, cloakTopY)
    graphics.lineTo(rightShoulderX, cloakTopY)
    graphics.lineTo(hemFrontX, hemY - 2)
    graphics.lineTo(hemMidX, hemY + 4.4)
    graphics.lineTo(hemBackX, hemY + 0.8)
    graphics.closePath()
    graphics.strokePath()

    for (let layer = 0; layer < 3; layer += 1) {
      const layerLift = layer * 3.2 + state.cloakLift * 1.2
      graphics.lineStyle(1.25 - layer * 0.2, INK_DARK, 0.6 - layer * 0.1)
      graphics.beginPath()
      graphics.moveTo(hemBackX + layer * 3, hemY - layerLift)
      graphics.lineTo(hemMidX + layer * 2.2, hemY + 1.8 - layerLift)
      graphics.lineTo(hemFrontX - layer * 2.6, hemY - 3.1 - layerLift)
      graphics.strokePath()
    }

    for (let index = 0; index < 7; index += 1) {
      const blend = index / 6
      const fromX = Phaser.Math.Linear(leftShoulderX + 1.2, rightShoulderX - 1.2, blend)
      const toX = Phaser.Math.Linear(hemBackX + 4.8, hemFrontX - 3.2, blend)
      this.drawDecorativeStroke(
        graphics,
        { x: fromX + rng.realInRange(-1.3, 1.3), y: cloakTopY + 1.8 + rng.realInRange(-0.8, 0.8) },
        { x: toX + rng.realInRange(-1.8, 1.8), y: hemY - 0.5 + rng.realInRange(-2.2, 2.2) },
        0.95,
        rng,
      )
    }
  }

  /** 绘制角色前披风层。 */
  private drawCloakFront(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    shoulderY: number,
    legEndY: number,
    state: StickmanRenderState,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const chestY = shoulderY + 2
    const hemY = legEndY - 7 - state.cloakLift * 2.4

    if (state.isRun) {
      const forwardX = centerX + 13.4 + state.gait * 1.4
      const foldX = centerX + 2.2
      const swayY = Math.abs(state.gait) * 2.2
      const innerBackX = centerX - 8.8 + state.gait * 0.6
      const innerFrontX = forwardX + 1.2

      graphics.fillStyle(INK_DARK, 0.66)
      graphics.beginPath()
      graphics.moveTo(innerBackX, chestY - 0.2)
      graphics.lineTo(innerFrontX, chestY + 8.6)
      graphics.lineTo(forwardX - 2.3, hemY - 0.8 + swayY)
      graphics.lineTo(centerX - 8, hemY - 7.8 + swayY * 0.5)
      graphics.closePath()
      graphics.fillPath()

      graphics.fillStyle(INK_MID, 0.4)
      graphics.beginPath()
      graphics.moveTo(foldX, chestY + 0.6)
      graphics.lineTo(forwardX, chestY + 8.3)
      graphics.lineTo(forwardX - 3.1, hemY - 3 + swayY)
      graphics.lineTo(foldX - 0.4, hemY - 8 + swayY * 0.6)
      graphics.closePath()
      graphics.fillPath()

      graphics.lineStyle(1.65, INK_DARK, 0.93)
      graphics.beginPath()
      graphics.moveTo(foldX, chestY + 0.6)
      graphics.lineTo(forwardX, chestY + 8.3)
      graphics.lineTo(forwardX - 3.1, hemY - 3 + swayY)
      graphics.strokePath()

      for (let i = 0; i < 3; i += 1) {
        this.drawDecorativeStroke(
          graphics,
          { x: foldX + i * 2.1, y: chestY + 1.6 + i * 1.1 },
          { x: forwardX - 2.8 - i * 1.4, y: hemY - 4.6 + i * 1.1 },
          0.88,
          rng,
        )
      }
      return
    }

    const sway = state.lean * 2.8
    graphics.fillStyle(INK_DARK, 0.62)
    graphics.beginPath()
    graphics.moveTo(centerX - 8.6, chestY + 0.2)
    graphics.lineTo(centerX + 8.6, chestY + 0.2)
    graphics.lineTo(centerX + 5.8 + sway * 0.15, hemY - 5.2)
    graphics.lineTo(centerX - 5.8 + sway * 0.15, hemY - 5.2)
    graphics.closePath()
    graphics.fillPath()

    graphics.fillStyle(INK_MID, 0.36)
    graphics.beginPath()
    graphics.moveTo(centerX - 2.2, chestY)
    graphics.lineTo(centerX - 12.1 + sway * 0.3, chestY + 8.3)
    graphics.lineTo(centerX - 8.5 + sway * 0.2, hemY)
    graphics.lineTo(centerX - 1, hemY - 7)
    graphics.closePath()
    graphics.fillPath()

    graphics.beginPath()
    graphics.moveTo(centerX + 2.2, chestY)
    graphics.lineTo(centerX + 12.1 + sway * 0.3, chestY + 8.3)
    graphics.lineTo(centerX + 8.5 + sway * 0.2, hemY)
    graphics.lineTo(centerX + 1, hemY - 7)
    graphics.closePath()
    graphics.fillPath()

    graphics.lineStyle(1.48, INK_DARK, 0.9)
    graphics.beginPath()
    graphics.moveTo(centerX - 2.2, chestY)
    graphics.lineTo(centerX - 12.1 + sway * 0.3, chestY + 8.3)
    graphics.lineTo(centerX - 8.5 + sway * 0.2, hemY)
    graphics.strokePath()
    graphics.beginPath()
    graphics.moveTo(centerX + 2.2, chestY)
    graphics.lineTo(centerX + 12.1 + sway * 0.3, chestY + 8.3)
    graphics.lineTo(centerX + 8.5 + sway * 0.2, hemY)
    graphics.strokePath()
  }

  /** 绘制主要轮廓笔触。 */
  private drawMainStroke(
    graphics: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    width: number,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const segments = 7
    for (let index = 0; index < segments; index += 1) {
      const t0 = index / segments
      const t1 = (index + 1) / segments
      const jitter = 0.45
      const startX = Phaser.Math.Linear(from.x, to.x, t0) + rng.realInRange(-jitter, jitter)
      const startY = Phaser.Math.Linear(from.y, to.y, t0) + rng.realInRange(-jitter, jitter)
      const endX = Phaser.Math.Linear(from.x, to.x, t1) + rng.realInRange(-jitter, jitter)
      const endY = Phaser.Math.Linear(from.y, to.y, t1) + rng.realInRange(-jitter, jitter)

      graphics.lineStyle(
        Math.max(1.2, width * rng.realInRange(0.92, 1.08)),
        INK_DARK,
        rng.realInRange(0.82, 0.97),
      )
      graphics.beginPath()
      graphics.moveTo(startX, startY)
      graphics.lineTo(endX, endY)
      graphics.strokePath()
    }
  }

  /** 绘制次级轮廓笔触。 */
  private drawSecondaryStroke(
    graphics: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    width: number,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const segments = 5
    for (let index = 0; index < segments; index += 1) {
      const t0 = index / segments
      const t1 = (index + 1) / segments
      const jitter = 0.4
      const startX = Phaser.Math.Linear(from.x, to.x, t0) + rng.realInRange(-jitter, jitter)
      const startY = Phaser.Math.Linear(from.y, to.y, t0) + rng.realInRange(-jitter, jitter)
      const endX = Phaser.Math.Linear(from.x, to.x, t1) + rng.realInRange(-jitter, jitter)
      const endY = Phaser.Math.Linear(from.y, to.y, t1) + rng.realInRange(-jitter, jitter)

      graphics.lineStyle(
        Math.max(1, width * rng.realInRange(0.9, 1.12)),
        INK_DARK,
        rng.realInRange(0.44, 0.7),
      )
      graphics.beginPath()
      graphics.moveTo(startX, startY)
      graphics.lineTo(endX, endY)
      graphics.strokePath()
    }
  }

  /** 绘制敌人轮廓笔触。 */
  private drawEnemyStroke(
    graphics: Phaser.GameObjects.Graphics,
    points: Array<{ x: number; y: number }>,
    width: number,
    color: number,
    alpha: number,
  ) {
    if (points.length < 2) {
      return
    }

    graphics.lineStyle(width, color, alpha)
    graphics.beginPath()
    graphics.moveTo(points[0].x, points[0].y)
    for (let index = 1; index < points.length; index += 1) {
      graphics.lineTo(points[index].x, points[index].y)
    }
    graphics.strokePath()
  }

  /** 绘制装饰线条。 */
  private drawDecorativeStroke(
    graphics: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    width: number,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    const segments = 6
    for (let index = 0; index < segments; index += 1) {
      if (index > 0 && index < segments - 1 && rng.frac() < 0.24) {
        continue
      }
      const t0 = index / segments
      const t1 = (index + 1) / segments
      const jitter = 0.6
      const startX = Phaser.Math.Linear(from.x, to.x, t0) + rng.realInRange(-jitter, jitter)
      const startY = Phaser.Math.Linear(from.y, to.y, t0) + rng.realInRange(-jitter, jitter)
      const endX = Phaser.Math.Linear(from.x, to.x, t1) + rng.realInRange(-jitter, jitter)
      const endY = Phaser.Math.Linear(from.y, to.y, t1) + rng.realInRange(-jitter, jitter)

      graphics.lineStyle(
        Math.max(0.7, width * rng.realInRange(0.82, 1.22)),
        INK_DARK,
        rng.realInRange(0.32, 0.58),
      )
      graphics.beginPath()
      graphics.moveTo(startX, startY)
      graphics.lineTo(endX, endY)
      graphics.strokePath()
    }
  }

  /** 绘制干笔风格圆弧。 */
  private drawDryCircle(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    centerY: number,
    radius: number,
    width: number,
    rng: Phaser.Math.RandomDataGenerator,
  ) {
    for (let index = 0; index < 3; index += 1) {
      graphics.lineStyle(Math.max(1, width - index * 0.6), INK_DARK, rng.realInRange(0.8, 0.97))
      graphics.strokeCircle(
        centerX + rng.realInRange(-0.5, 0.5),
        centerY + rng.realInRange(-0.5, 0.5),
        radius + rng.realInRange(-0.45, 0.45),
      )
    }
  }

  /** 注册玩家相关动画（待机/移动/攻击/死亡/特效）。 */
  private createHeroAnimations() {
    if (!this.anims.exists(HERO_ANIM.sword_idle)) {
      this.anims.create({
        key: HERO_ANIM.sword_idle,
        frames: HERO_SWORD_IDLE_FRAMES.map((key) => ({ key })),
        frameRate: 4,
        repeat: -1,
      })
    }

    if (!this.anims.exists(HERO_ANIM.sword_move)) {
      this.anims.create({
        key: HERO_ANIM.sword_move,
        frames: HERO_SWORD_MOVE_FRAMES.map((key) => ({ key })),
        frameRate: 10,
        repeat: -1,
      })
    }

    if (!this.anims.exists(HERO_ANIM.sword_attack)) {
      const swordAttackDurations = [68, 78, 32, 38, 44] as const
      this.anims.create({
        key: HERO_ANIM.sword_attack,
        frames: HERO_SWORD_ATTACK_FRAMES.map((key, index) => ({ key, duration: swordAttackDurations[index] })),
        repeat: 0,
      })
    }

    if (!this.anims.exists(HERO_ANIM.hook_spear_idle)) {
      this.anims.create({
        key: HERO_ANIM.hook_spear_idle,
        frames: HERO_HOOK_SPEAR_IDLE_FRAMES.map((key) => ({ key })),
        frameRate: 4,
        repeat: -1,
      })
    }

    if (!this.anims.exists(HERO_ANIM.hook_spear_move)) {
      this.anims.create({
        key: HERO_ANIM.hook_spear_move,
        frames: HERO_HOOK_SPEAR_MOVE_FRAMES.map((key) => ({ key })),
        frameRate: 10,
        repeat: -1,
      })
    }

    if (!this.anims.exists(HERO_ANIM.hook_spear_attack)) {
      const hookSpearAttackDurations = [64, 74, 34, 40, 52] as const
      this.anims.create({
        key: HERO_ANIM.hook_spear_attack,
        frames: HERO_HOOK_SPEAR_ATTACK_FRAMES.map((key, index) => ({ key, duration: hookSpearAttackDurations[index] })),
        repeat: 0,
      })
    }

    if (!this.anims.exists(HERO_ANIM.bow_idle)) {
      this.anims.create({
        key: HERO_ANIM.bow_idle,
        frames: HERO_BOW_IDLE_FRAMES.map((key) => ({ key })),
        frameRate: 4,
        repeat: -1,
      })
    }

    if (!this.anims.exists(HERO_ANIM.bow_move)) {
      this.anims.create({
        key: HERO_ANIM.bow_move,
        frames: HERO_BOW_MOVE_FRAMES.map((key) => ({ key })),
        frameRate: 10,
        repeat: -1,
      })
    }

    if (!this.anims.exists(HERO_ANIM.bow_attack)) {
      this.anims.create({
        key: HERO_ANIM.bow_attack,
        frames: HERO_BOW_ATTACK_FRAMES.map((key) => ({ key })),
        frameRate: 20,
        repeat: 0,
      })
    }

    if (!this.anims.exists(HERO_ANIM.death)) {
      this.anims.create({
        key: HERO_ANIM.death,
        frames: HERO_DEATH_FRAMES.map((key) => ({ key })),
        frameRate: 12,
        repeat: 0,
      })
    }

    if (!this.anims.exists(HERO_ANIM.sword_slash)) {
      const swordSlashDurations = [42, 52, 46, 76] as const
      this.anims.create({
        key: HERO_ANIM.sword_slash,
        frames: SWORD_SLASH_FRAMES.map((key, index) => ({ key, duration: swordSlashDurations[index] })),
        repeat: 0,
      })
    }

    if (!this.anims.exists(HERO_ANIM.arrow_trail)) {
      this.anims.create({
        key: HERO_ANIM.arrow_trail,
        frames: ARROW_TRAIL_FRAMES.map((key) => ({ key })),
        frameRate: 18,
        repeat: -1,
      })
    }
  }

  /** 注册敌人相关动画（移动/预警/冲锋/死亡）。 */
  private createEnemyAnimations() {
    if (!this.anims.exists(ENEMY_ANIM.chaser_move)) {
      this.anims.create({
        key: ENEMY_ANIM.chaser_move,
        frames: CHASER_MOVE_FRAMES.map((key) => ({ key })),
        frameRate: 10,
        repeat: -1,
      })
    }

    if (!this.anims.exists(ENEMY_ANIM.chaser_death)) {
      this.anims.create({
        key: ENEMY_ANIM.chaser_death,
        frames: CHASER_DEATH_FRAMES.map((key) => ({ key })),
        frameRate: 14,
        repeat: 0,
      })
    }

    if (!this.anims.exists(ENEMY_ANIM.charger_move)) {
      this.anims.create({
        key: ENEMY_ANIM.charger_move,
        frames: CHARGER_MOVE_FRAMES.map((key) => ({ key })),
        frameRate: 8,
        repeat: -1,
      })
    }

    if (!this.anims.exists(ENEMY_ANIM.charger_tell)) {
      this.anims.create({
        key: ENEMY_ANIM.charger_tell,
        frames: CHARGER_TELL_FRAMES.map((key) => ({ key })),
        frameRate: 8,
        repeat: -1,
      })
    }

    if (!this.anims.exists(ENEMY_ANIM.charger_charge)) {
      this.anims.create({
        key: ENEMY_ANIM.charger_charge,
        frames: CHARGER_CHARGE_FRAMES.map((key) => ({ key })),
        frameRate: 14,
        repeat: -1,
      })
    }

    if (!this.anims.exists(ENEMY_ANIM.charger_death)) {
      this.anims.create({
        key: ENEMY_ANIM.charger_death,
        frames: CHARGER_DEATH_FRAMES.map((key) => ({ key })),
        frameRate: 14,
        repeat: 0,
      })
    }
  }
}
