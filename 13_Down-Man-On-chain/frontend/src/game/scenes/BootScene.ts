/**
 * 启动场景。
 * 负责同步生成水墨风背景、角色帧、平台纹理与动画定义，
 * 让运行时无需依赖外部图片资源。
 */
import Phaser from 'phaser'
import {
  INK_SPLASH_TEXTURE_KEY,
  INK_WASH_TEXTURE_KEY,
  PAPER_TEXTURE_KEY,
  PLATFORM_MOVING_TEXTURE_KEY,
  PLATFORM_STABLE_TEXTURE_KEY,
  PLATFORM_VANISHING_TEXTURE_KEY,
  STICKMAN_ANIM,
  STICKMAN_DEATH_FRAMES,
  STICKMAN_FALL_FRAMES,
  STICKMAN_HIT_FRAMES,
  STICKMAN_IDLE_FRAMES,
  STICKMAN_LAND_FRAMES,
  STICKMAN_RUN_FRAMES,
} from '../entities/assetKeys'

type StickmanPose = {
  armSwing: number
  legSwing: number
  bodyTilt: number
  headYOffset: number
}

// renderState 是把姿态参数进一步翻译成“当前该如何画披风、斗笠和侧身”的中间语义。
type StickmanRenderState = {
  isRun: boolean
  isFall: boolean
  isLand: boolean
  gait: number
  lean: number
  cloakLift: number
}

// 角色贴图尺寸与整套水墨/岩石/刀剑配色。
const STICKMAN_WIDTH = 84
const STICKMAN_HEIGHT = 146
const INK_DARK = 0x101010
const INK_MID = 0x3d3d3d
const ROCK_OBSIDIAN = 0x080808
const ROCK_BASALT_DARK = 0x141414
const ROCK_BASALT_MID = 0x242424
const ROCK_BASALT_LIGHT = 0x464646
const ROCK_ASH_LIGHT = 0x6a6a6a
const ROCK_CHALK_WHITE = 0xf2f2f2
const SWORD_RED_DARK = 0x4d1010
const SWORD_RED_MID = 0x7c1717
const SWORD_RED_LIGHT = 0xb82a2a
const SWORD_RED_HIGHLIGHT = 0xe07373

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'boot-scene' })
  }

  // Boot 只做资源生成与动画注册，完成后立刻切到主场景。
  create(): void {
    this.createBackgroundTextures()
    this.createStickmanTextures()
    this.createPlatformTextures()
    this.createInkSplashTexture()
    this.createStickmanAnimations()

    this.scene.start('game-scene')
    this.scene.launch('overlay-bridge-scene')
  }

  // 背景与角色贴图都在 Boot 阶段一次性生成，后续场景直接复用 texture key。
  private createBackgroundTextures(): void {
    this.createPaperTexture()
    this.createInkWashTexture()
  }

  private createStickmanTextures(): void {
    // 每组 pose 只是同一骨架的关键帧参数，后续复用相同绘制逻辑出图。
    const idlePoses: StickmanPose[] = [
      { armSwing: -0.22, legSwing: -0.12, bodyTilt: -0.05, headYOffset: 0 },
      { armSwing: 0.22, legSwing: 0.1, bodyTilt: 0.05, headYOffset: 1 },
    ]

    const runPoses: StickmanPose[] = [
      { armSwing: -0.98, legSwing: 0.72, bodyTilt: -0.26, headYOffset: 0 },
      { armSwing: -0.62, legSwing: 0.42, bodyTilt: -0.17, headYOffset: 0 },
      { armSwing: -0.2, legSwing: 0.1, bodyTilt: -0.08, headYOffset: 0 },
      { armSwing: 0.2, legSwing: -0.1, bodyTilt: 0.08, headYOffset: 0 },
      { armSwing: 0.62, legSwing: -0.42, bodyTilt: 0.17, headYOffset: 0 },
      { armSwing: 0.98, legSwing: -0.72, bodyTilt: 0.26, headYOffset: 0 },
    ]

    const fallPoses: StickmanPose[] = [
      { armSwing: 0.22, legSwing: 0.36, bodyTilt: 0.04, headYOffset: 0 },
      { armSwing: 0.08, legSwing: 0.58, bodyTilt: -0.02, headYOffset: 1 },
      { armSwing: -0.12, legSwing: 0.76, bodyTilt: -0.08, headYOffset: 1 },
    ]

    const landPoses: StickmanPose[] = [
      { armSwing: 0.74, legSwing: -0.92, bodyTilt: 0.24, headYOffset: 5 },
      { armSwing: 0.4, legSwing: -0.48, bodyTilt: 0.1, headYOffset: 3 },
      { armSwing: 0.14, legSwing: -0.18, bodyTilt: 0.02, headYOffset: 1 },
    ]

    const hitPoses: StickmanPose[] = [
      { armSwing: 0.8, legSwing: -0.4, bodyTilt: 0.28, headYOffset: 2 },
      { armSwing: 0.38, legSwing: -0.18, bodyTilt: 0.16, headYOffset: 1 },
    ]

    const deathPoses: StickmanPose[] = [
      { armSwing: 0.15, legSwing: 0.12, bodyTilt: 0.2, headYOffset: 0 },
      { armSwing: 0.35, legSwing: -0.12, bodyTilt: 0.48, headYOffset: 0 },
      { armSwing: 0.64, legSwing: -0.34, bodyTilt: 0.78, headYOffset: 1 },
      { armSwing: 0.82, legSwing: -0.5, bodyTilt: 1.04, headYOffset: 2 },
      { armSwing: 0.95, legSwing: -0.62, bodyTilt: 1.22, headYOffset: 3 },
    ]

    STICKMAN_IDLE_FRAMES.forEach((key, index) => {
      this.drawStickmanFrame(key, idlePoses[index])
    })

    STICKMAN_RUN_FRAMES.forEach((key, index) => {
      this.drawStickmanFrame(key, runPoses[index])
    })

    STICKMAN_FALL_FRAMES.forEach((key, index) => {
      this.drawStickmanFrame(key, fallPoses[index])
    })

    STICKMAN_LAND_FRAMES.forEach((key, index) => {
      this.drawStickmanFrame(key, landPoses[index])
    })

    STICKMAN_HIT_FRAMES.forEach((key, index) => {
      this.drawStickmanFrame(key, hitPoses[index])
    })

    STICKMAN_DEATH_FRAMES.forEach((key, index) => {
      this.drawStickmanFrame(key, deathPoses[index])
    })
  }

  // 单帧角色贴图按“披风 -> 背剑 -> 身体 -> 前披风 -> 斗笠”的层次绘制。
  private drawStickmanFrame(textureKey: string, pose: StickmanPose): void {
    const rng = new Phaser.Math.RandomDataGenerator([`stickman-${textureKey}`])
    const centerX = STICKMAN_WIDTH / 2
    const headY = 24 + pose.headYOffset * 0.8
    const headRadius = 7.4

    const shoulderY = 43
    const torsoBottomY = 80
    const legEndY = 129

    const isRun = textureKey.startsWith('stickman-run')
    const isFall = textureKey.startsWith('stickman-fall')
    const isLand = textureKey.startsWith('stickman-land')
    const renderState: StickmanRenderState = {
      isRun,
      isFall,
      isLand,
      gait: Phaser.Math.Clamp(pose.armSwing, -1, 1),
      lean: pose.bodyTilt,
      cloakLift: isFall ? 1 : isLand ? -0.48 : 0,
    }

    const graphics = this.add.graphics({ x: 0, y: 0 })
    graphics.clear()

    this.drawCloakBack(graphics, centerX, shoulderY, legEndY, renderState, rng)
    this.drawBackSword(graphics, centerX, shoulderY, legEndY, renderState, rng)
    if (renderState.isRun) {
      this.drawRunSideBody(graphics, centerX, headY, headRadius, shoulderY, torsoBottomY, legEndY, renderState, rng)
    } else {
      this.drawFrontalBody(graphics, centerX, headY, headRadius, shoulderY, torsoBottomY, legEndY, pose, rng)
    }
    this.drawCloakFront(graphics, centerX, shoulderY, legEndY, renderState, rng)
    this.drawDryCircle(graphics, centerX, headY, headRadius, 2.2, rng)
    this.drawWuxiaHat(graphics, centerX + renderState.lean * 1.4, headY - 3.2, rng)

    graphics.generateTexture(textureKey, STICKMAN_WIDTH, STICKMAN_HEIGHT)
    graphics.destroy()
  }

  // 站立/落地等正面帧更强调四肢对称和正面轮廓。
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
  ): void {
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

  // 跑动帧使用侧身骨架，突出前后摆臂和躯干前倾。
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
  ): void {
    const gait = state.gait
    const neckX = centerX + 2.8 + state.lean * 2
    const shoulderX = neckX + 2.4
    const hipX = shoulderX + 4.9 + Math.max(0, gait) * 0.9

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
      { x: shoulderX + 13.8 + gait * 4.6, y: shoulderY + 13.8 + Math.abs(gait) * 2.3 },
      2.8,
      rng,
    )
    this.drawSecondaryStroke(
      graphics,
      { x: shoulderX - 1.2, y: shoulderY + 1.2 },
      { x: shoulderX - 8.5 + gait * 2.8, y: shoulderY + 11.8 },
      1.6,
      rng,
    )
    this.drawMainStroke(
      graphics,
      { x: hipX, y: torsoBottomY + 0.6 },
      { x: hipX + 5.8 - gait * 8.2, y: legEndY - 2.5 + Math.abs(gait) * 1.9 },
      2.9,
      rng,
    )
    this.drawSecondaryStroke(
      graphics,
      { x: hipX - 1.5, y: torsoBottomY + 1.6 },
      { x: hipX - 11.3 + gait * 4.1, y: legEndY - 11.4 },
      1.7,
      rng,
    )
  }

  // 背剑是角色识别度最高的视觉元素，因此拆成独立绘制链路。
  private drawBackSword(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    shoulderY: number,
    legEndY: number,
    state: StickmanRenderState,
    rng: Phaser.Math.RandomDataGenerator,
  ): void {
    const runFactor = state.isRun ? 1 : 0
    const sway = state.gait * 3.6 + state.lean * 8.6

    const hiltX = centerX - 20.2 + sway * 0.14
    const hiltY = shoulderY - 21.6 - runFactor * 2.1
    const tipX = centerX + 26.2 + sway * 0.5
    const tipY = legEndY - 6.8 + runFactor * 3

    const directionX = tipX - hiltX
    const directionY = tipY - hiltY
    const length = Math.max(1, Math.hypot(directionX, directionY))
    const unitX = directionX / length
    const unitY = directionY / length
    const normalX = -unitY
    const normalY = unitX

    const bladeHalf = (4.7 + runFactor * 0.55) * 1.12
    const bladeTipInset = 8.8

    const leftRootX = hiltX + normalX * bladeHalf
    const leftRootY = hiltY + normalY * bladeHalf
    const rightRootX = hiltX - normalX * bladeHalf
    const rightRootY = hiltY - normalY * bladeHalf
    const leftMidX = tipX - unitX * bladeTipInset + normalX * (bladeHalf * 0.6)
    const leftMidY = tipY - unitY * bladeTipInset + normalY * (bladeHalf * 0.6)
    const rightMidX = tipX - unitX * bladeTipInset - normalX * (bladeHalf * 0.6)
    const rightMidY = tipY - unitY * bladeTipInset - normalY * (bladeHalf * 0.6)

    graphics.fillStyle(SWORD_RED_MID, 0.92)
    graphics.beginPath()
    graphics.moveTo(leftRootX, leftRootY)
    graphics.lineTo(leftMidX, leftMidY)
    graphics.lineTo(tipX, tipY)
    graphics.lineTo(rightMidX, rightMidY)
    graphics.lineTo(rightRootX, rightRootY)
    graphics.closePath()
    graphics.fillPath()

    graphics.lineStyle(2.2, SWORD_RED_LIGHT, 0.99)
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

    graphics.fillStyle(SWORD_RED_DARK, 0.42)
    graphics.beginPath()
    graphics.moveTo(leftRootX, leftRootY)
    graphics.lineTo(leftMidX, leftMidY)
    graphics.lineTo(facetTipX, facetTipY)
    graphics.lineTo(facetMidX, facetMidY)
    graphics.lineTo(facetRootX, facetRootY)
    graphics.closePath()
    graphics.fillPath()

    graphics.lineStyle(1.2, SWORD_RED_HIGHLIGHT, 0.5)
    graphics.beginPath()
    graphics.moveTo(hiltX + normalX * 0.45, hiltY + normalY * 0.45)
    graphics.lineTo(tipX - unitX * 9.2 + normalX * 0.45, tipY - unitY * 9.2 + normalY * 0.45)
    graphics.strokePath()

    graphics.lineStyle(1.05, SWORD_RED_DARK, 0.58)
    graphics.beginPath()
    graphics.moveTo(hiltX - normalX * 1.5, hiltY - normalY * 1.5)
    graphics.lineTo(tipX - unitX * 10.6 - normalX * 1.5, tipY - unitY * 10.6 - normalY * 1.5)
    graphics.strokePath()

    for (let notchIndex = 0; notchIndex < 4; notchIndex += 1) {
      const t = 0.2 + notchIndex * 0.16
      const notchX = Phaser.Math.Linear(hiltX, tipX - unitX * 12, t)
      const notchY = Phaser.Math.Linear(hiltY, tipY - unitY * 12, t)
      const notchHalf = 1.45 + notchIndex * 0.22
      graphics.lineStyle(0.95, SWORD_RED_HIGHLIGHT, 0.72)
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

    const guardCenterX = hiltX + unitX * 8.8
    const guardCenterY = hiltY + unitY * 8.8
    const guardHalf = 15 + runFactor * 1.8
    const guardCrossHalf = 7.8 + runFactor * 1
    graphics.lineStyle(3.3, SWORD_RED_LIGHT, 0.99)
    graphics.beginPath()
    graphics.moveTo(
      guardCenterX - normalX * guardHalf,
      guardCenterY - normalY * guardHalf,
    )
    graphics.lineTo(
      guardCenterX + normalX * guardHalf,
      guardCenterY + normalY * guardHalf,
    )
    graphics.strokePath()

    graphics.lineStyle(2.8, SWORD_RED_LIGHT, 0.96)
    graphics.beginPath()
    graphics.moveTo(
      guardCenterX - unitX * guardCrossHalf,
      guardCenterY - unitY * guardCrossHalf,
    )
    graphics.lineTo(
      guardCenterX + unitX * guardCrossHalf,
      guardCenterY + unitY * guardCrossHalf,
    )
    graphics.strokePath()

    graphics.fillStyle(SWORD_RED_MID, 0.9)
    graphics.beginPath()
    graphics.moveTo(guardCenterX + normalX * 3.4, guardCenterY + normalY * 3.4)
    graphics.lineTo(guardCenterX + unitX * 2.8, guardCenterY + unitY * 2.8)
    graphics.lineTo(guardCenterX - normalX * 3.4, guardCenterY - normalY * 3.4)
    graphics.lineTo(guardCenterX - unitX * 2.8, guardCenterY - unitY * 2.8)
    graphics.closePath()
    graphics.fillPath()

    graphics.fillStyle(SWORD_RED_DARK, 0.94)
    graphics.fillTriangle(
      guardCenterX - normalX * (guardHalf + 3.8),
      guardCenterY - normalY * (guardHalf + 3.8),
      guardCenterX - normalX * (guardHalf - 0.2) + unitX * 2.1,
      guardCenterY - normalY * (guardHalf - 0.2) + unitY * 2.1,
      guardCenterX - normalX * (guardHalf - 0.2) - unitX * 2.1,
      guardCenterY - normalY * (guardHalf - 0.2) - unitY * 2.1,
    )
    graphics.fillTriangle(
      guardCenterX + normalX * (guardHalf + 3.8),
      guardCenterY + normalY * (guardHalf + 3.8),
      guardCenterX + normalX * (guardHalf - 0.2) + unitX * 2.1,
      guardCenterY + normalY * (guardHalf - 0.2) + unitY * 2.1,
      guardCenterX + normalX * (guardHalf - 0.2) - unitX * 2.1,
      guardCenterY + normalY * (guardHalf - 0.2) - unitY * 2.1,
    )

    graphics.fillStyle(SWORD_RED_HIGHLIGHT, 0.78)
    graphics.fillCircle(guardCenterX, guardCenterY, 2.2)

    const gripEndX = hiltX - unitX * 7.6
    const gripEndY = hiltY - unitY * 7.6
    graphics.lineStyle(3.6, SWORD_RED_DARK, 0.96)
    graphics.beginPath()
    graphics.moveTo(hiltX, hiltY)
    graphics.lineTo(gripEndX, gripEndY)
    graphics.strokePath()

    for (let wrapIndex = 0; wrapIndex < 4; wrapIndex += 1) {
      const t = (wrapIndex + 1) / 5
      const wrapCenterX = Phaser.Math.Linear(hiltX, gripEndX, t)
      const wrapCenterY = Phaser.Math.Linear(hiltY, gripEndY, t)
      const wrapHalf = 1.5 + wrapIndex * 0.18
      graphics.lineStyle(1.1, SWORD_RED_HIGHLIGHT, 0.9)
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

    graphics.fillStyle(SWORD_RED_DARK, 0.96)
    graphics.fillCircle(pommelX, pommelY, 2.2)

    const tasselSway = state.gait * 3 + state.lean * 1.2
    const tasselLength = 15.6 + runFactor * 2.2
    const knotX = pommelX + normalX * 0.6
    const knotY = pommelY + 1.6

    graphics.fillStyle(SWORD_RED_LIGHT, 0.92)
    graphics.fillCircle(knotX, knotY, 1.55)
    graphics.lineStyle(1.2, SWORD_RED_LIGHT, 0.88)
    graphics.beginPath()
    graphics.moveTo(pommelX, pommelY + 0.9)
    graphics.lineTo(knotX, knotY + 0.4)
    graphics.strokePath()

    for (let strand = 0; strand < 5; strand += 1) {
      const spread = (strand - 2) * 1.25
      const startX = knotX + spread * 0.32
      const startY = knotY + 0.5 + Math.abs(spread) * 0.12
      const midX = startX + tasselSway * 0.35 + spread * 0.5
      const midY = startY + tasselLength * 0.48
      const endX = startX + tasselSway + spread * 0.9
      const endY = startY + tasselLength + rng.realInRange(-0.6, 0.9)

      graphics.lineStyle(
        Math.max(0.85, 1.15 - Math.abs(spread) * 0.04),
        strand % 2 === 0 ? SWORD_RED_LIGHT : SWORD_RED_HIGHLIGHT,
        0.82,
      )
      graphics.beginPath()
      graphics.moveTo(startX, startY)
      graphics.lineTo(midX, midY)
      graphics.lineTo(endX, endY)
      graphics.strokePath()

      graphics.fillStyle(SWORD_RED_HIGHLIGHT, 0.72)
      graphics.fillCircle(endX, endY, 0.42)
    }
  }

  private createPlatformTextures(): void {
    const width = 240
    const height = 34
    this.createOnePlatformTexture(PLATFORM_STABLE_TEXTURE_KEY, width, height, 'stable')
    this.createOnePlatformTexture(PLATFORM_MOVING_TEXTURE_KEY, width, height, 'moving')
    this.createOnePlatformTexture(PLATFORM_VANISHING_TEXTURE_KEY, width, height, 'vanishing')
  }

  // 三类平台共享石质基底，只在局部细节上强化移动/消失的辨识度。
  private createOnePlatformTexture(
    key: string,
    width: number,
    height: number,
    type: 'stable' | 'moving' | 'vanishing',
  ): void {
    const graphics = this.add.graphics({ x: 0, y: 0 })
    const rng = new Phaser.Math.RandomDataGenerator([`platform-${key}`])

    graphics.fillStyle(ROCK_BASALT_DARK, 0.98)
    graphics.fillRoundedRect(0, 0, width, height, 8)

    graphics.fillStyle(ROCK_OBSIDIAN, 0.42)
    graphics.fillRoundedRect(2, height * 0.55, width - 4, height * 0.4, 6)

    for (let index = 0; index < 48; index += 1) {
      graphics.fillStyle(
        index % 4 === 0 ? ROCK_ASH_LIGHT : ROCK_BASALT_MID,
        index % 4 === 0 ? rng.realInRange(0.14, 0.25) : rng.realInRange(0.18, 0.32),
      )
      graphics.fillCircle(
        rng.realInRange(8, width - 8),
        rng.realInRange(6, height - 6),
        rng.realInRange(0.45, 1.4),
      )
    }

    for (let index = 0; index < 8; index += 1) {
      graphics.lineStyle(1, ROCK_OBSIDIAN, rng.realInRange(0.25, 0.48))
      graphics.beginPath()
      graphics.moveTo(rng.realInRange(12, width - 12), rng.realInRange(4, 14))
      graphics.lineTo(rng.realInRange(14, width - 14), rng.realInRange(16, height - 4))
      graphics.strokePath()
    }

    graphics.lineStyle(1.1, ROCK_BASALT_LIGHT, 0.42)
    graphics.beginPath()
    graphics.moveTo(10, 7)
    graphics.lineTo(width - 10, 7)
    graphics.strokePath()

    if (type === 'moving') {
      graphics.lineStyle(2.2, ROCK_ASH_LIGHT, 0.5)
      graphics.beginPath()
      graphics.moveTo(width * 0.18, height * 0.78)
      graphics.lineTo(width * 0.42, height * 0.78)
      graphics.lineTo(width * 0.42, height * 0.64)
      graphics.lineTo(width * 0.56, height * 0.86)
      graphics.lineTo(width * 0.7, height * 0.64)
      graphics.lineTo(width * 0.7, height * 0.78)
      graphics.lineTo(width * 0.82, height * 0.78)
      graphics.strokePath()
    }

    if (type === 'vanishing') {
      // 消失平台保留玄武岩底色，但用粉白裂纹强调“即将碎裂”的反馈。
      graphics.fillStyle(ROCK_OBSIDIAN, 0.28)
      graphics.fillRoundedRect(3, 3, width - 6, height - 6, 6)

      graphics.lineStyle(1.4, ROCK_BASALT_LIGHT, 0.42)
      graphics.strokeRoundedRect(4, 4, width - 8, height - 8, 6)

      const crackStartX = width * 0.48
      const crackStartY = height * 0.12
      graphics.lineStyle(2.8, ROCK_CHALK_WHITE, 0.94)
      graphics.beginPath()
      graphics.moveTo(crackStartX, crackStartY)
      graphics.lineTo(width * 0.44, height * 0.28)
      graphics.lineTo(width * 0.5, height * 0.52)
      graphics.lineTo(width * 0.4, height * 0.9)
      graphics.strokePath()

      graphics.lineStyle(2.4, ROCK_CHALK_WHITE, 0.88)
      graphics.beginPath()
      graphics.moveTo(width * 0.62, height * 0.12)
      graphics.lineTo(width * 0.58, height * 0.34)
      graphics.lineTo(width * 0.66, height * 0.56)
      graphics.lineTo(width * 0.6, height * 0.88)
      graphics.strokePath()

      graphics.lineStyle(2.1, ROCK_CHALK_WHITE, 0.84)
      graphics.beginPath()
      graphics.moveTo(width * 0.44, height * 0.28)
      graphics.lineTo(width * 0.3, height * 0.4)
      graphics.lineTo(width * 0.2, height * 0.58)
      graphics.lineTo(width * 0.1, height * 0.82)
      graphics.strokePath()
      graphics.beginPath()
      graphics.moveTo(width * 0.5, height * 0.52)
      graphics.lineTo(width * 0.68, height * 0.6)
      graphics.lineTo(width * 0.84, height * 0.8)
      graphics.strokePath()
      graphics.beginPath()
      graphics.moveTo(width * 0.58, height * 0.34)
      graphics.lineTo(width * 0.72, height * 0.42)
      graphics.lineTo(width * 0.86, height * 0.58)
      graphics.strokePath()
      graphics.beginPath()
      graphics.moveTo(width * 0.38, height * 0.62)
      graphics.lineTo(width * 0.28, height * 0.76)
      graphics.lineTo(width * 0.18, height * 0.9)
      graphics.strokePath()
      graphics.beginPath()
      graphics.moveTo(width * 0.62, height * 0.56)
      graphics.lineTo(width * 0.74, height * 0.7)
      graphics.lineTo(width * 0.9, height * 0.9)
      graphics.strokePath()

      for (let index = 0; index < 16; index += 1) {
        const x0 = width * (0.08 + index * 0.055) + rng.realInRange(-3, 3)
        const y0 = height * (0.16 + (index % 4) * 0.18) + rng.realInRange(-2, 2)
        const x1 = x0 + rng.realInRange(-18, 18)
        const y1 = y0 + rng.realInRange(8, 16)
        graphics.lineStyle(1.2, ROCK_CHALK_WHITE, rng.realInRange(0.42, 0.68))
        graphics.beginPath()
        graphics.moveTo(x0, y0)
        graphics.lineTo(x1, y1)
        graphics.strokePath()
      }

      graphics.lineStyle(1.2, ROCK_CHALK_WHITE, 0.62)
      graphics.beginPath()
      graphics.moveTo(width * 0.06, height * 0.18)
      graphics.lineTo(width * 0.94, height * 0.18)
      graphics.moveTo(width * 0.08, height * 0.84)
      graphics.lineTo(width * 0.92, height * 0.84)
      graphics.strokePath()
    }

    graphics.generateTexture(key, width, height)
    graphics.destroy()
  }

  // 纸张底纹和墨迹 wash 都是低频大纹理，用来给滚屏增加层次感。
  private createPaperTexture(): void {
    const size = 256
    const rng = new Phaser.Math.RandomDataGenerator(['paper-texture'])
    const graphics = this.add.graphics({ x: 0, y: 0 })

    for (let i = 0; i < 1600; i += 1) {
      graphics.fillStyle(INK_DARK, rng.realInRange(0.015, 0.06))
      graphics.fillCircle(
        rng.realInRange(0, size),
        rng.realInRange(0, size),
        rng.realInRange(0.2, 0.9),
      )
    }

    for (let i = 0; i < 120; i += 1) {
      graphics.lineStyle(1, INK_DARK, rng.realInRange(0.02, 0.05))
      graphics.beginPath()
      graphics.moveTo(rng.realInRange(0, size), rng.realInRange(0, size))
      graphics.lineTo(rng.realInRange(0, size), rng.realInRange(0, size))
      graphics.strokePath()
    }

    graphics.generateTexture(PAPER_TEXTURE_KEY, size, size)
    graphics.destroy()
  }

  private createInkWashTexture(): void {
    const size = 512
    const rng = new Phaser.Math.RandomDataGenerator(['ink-wash-texture'])
    const graphics = this.add.graphics({ x: 0, y: 0 })

    // wash 使用大块椭圆低透明叠色，目标是铺氛围，不是生成可辨识图案。
    for (let i = 0; i < 9; i += 1) {
      graphics.fillStyle(INK_MID, rng.realInRange(0.02, 0.07))
      graphics.fillEllipse(
        rng.realInRange(48, size - 48),
        rng.realInRange(48, size - 48),
        rng.realInRange(140, 320),
        rng.realInRange(80, 220),
      )
    }

    graphics.generateTexture(INK_WASH_TEXTURE_KEY, size, size)
    graphics.destroy()
  }

  private createInkSplashTexture(): void {
    const size = 96
    const rng = new Phaser.Math.RandomDataGenerator(['ink-splash-texture'])
    const graphics = this.add.graphics({ x: 0, y: 0 })
    const center = size / 2

    // splash 体量很小，主要服务 GameScene 的落地冲击与死亡墨迹反馈。
    graphics.fillStyle(INK_DARK, 0.3)
    graphics.fillCircle(center, center, 12)
    graphics.fillStyle(INK_DARK, 0.2)
    graphics.fillCircle(center + 2, center - 1, 18)

    for (let i = 0; i < 16; i += 1) {
      graphics.fillStyle(INK_DARK, rng.realInRange(0.15, 0.28))
      graphics.fillCircle(
        center + rng.realInRange(-28, 28),
        center + rng.realInRange(-26, 26),
        rng.realInRange(1.2, 4.4),
      )
    }

    graphics.generateTexture(INK_SPLASH_TEXTURE_KEY, size, size)
    graphics.destroy()
  }

  // 斗笠、披风这些配件会随着姿态轻微偏移，增强武侠人物的动态感。
  private drawWuxiaHat(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    brimY: number,
    rng: Phaser.Math.RandomDataGenerator,
  ): void {
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
      const brimX = Phaser.Math.Linear(
        centerX - brimWidth * 0.44,
        centerX + brimWidth * 0.44,
        ratio,
      )
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

  // 背披风负责大轮廓和拖尾，前披风再补胸口和内折层次。
  private drawCloakBack(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    shoulderY: number,
    legEndY: number,
    state: StickmanRenderState,
    rng: Phaser.Math.RandomDataGenerator,
  ): void {
    const liftUpPx = state.cloakLift > 0 ? state.cloakLift * 15 : 0
    const settlePx = state.cloakLift < 0 ? -state.cloakLift * 4.8 : 0
    const cloakTopY = shoulderY - 3 - liftUpPx * 0.24
    const hemY = legEndY - (state.isRun ? 1 : 4) - liftUpPx + settlePx
    const sway = state.gait * 4.2 + state.lean * 9 + (state.isFall ? state.gait * 1.4 : 0)
    const backTrail = state.isFall
      ? 34 + Math.abs(state.gait) * 12
      : state.isRun
        ? 26 + Math.abs(state.gait) * 8
        : 17
    const frontReach = state.isFall ? 9.8 : state.isRun ? 11.8 : 16
    const leftShoulderX = centerX - 8.8
    const rightShoulderX = centerX + 8.8
    const hemBackX = centerX - backTrail + sway * 0.22 - (state.isFall ? 4.8 : 0)
    const hemMidX = centerX - (state.isRun ? 10.4 : 2.4) + sway * 0.34
    const hemFrontX = centerX + frontReach + sway * 0.08 + (state.isLand ? 1.2 : 0)

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
      const layerLift = layer * 3.2
      graphics.lineStyle(1.25 - layer * 0.2, INK_DARK, 0.6 - layer * 0.1)
      graphics.beginPath()
      graphics.moveTo(hemBackX + layer * 3, hemY - layerLift - liftUpPx * 0.2)
      graphics.lineTo(hemMidX + layer * 2.2, hemY + 1.8 - layerLift - liftUpPx * 0.12)
      graphics.lineTo(hemFrontX - layer * 2.6, hemY - 3.1 - layerLift - liftUpPx * 0.06)
      graphics.strokePath()
    }

    for (let index = 0; index < 7; index += 1) {
      const blend = index / 6
      const fromX = Phaser.Math.Linear(leftShoulderX + 1.2, rightShoulderX - 1.2, blend)
      const toX = Phaser.Math.Linear(hemBackX + 4.8, hemFrontX - 3.2, blend)
      this.drawDecorativeStroke(
        graphics,
        { x: fromX + rng.realInRange(-1.3, 1.3), y: cloakTopY + 1.8 + rng.realInRange(-0.8, 0.8) },
        {
          x: toX + rng.realInRange(-1.8, 1.8),
          y:
            hemY -
            0.5 -
            liftUpPx * 0.32 +
            settlePx * 0.2 +
            rng.realInRange(-2.2, 2.2),
        },
        0.95,
        rng,
      )
    }
  }

  private drawCloakFront(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    shoulderY: number,
    legEndY: number,
    state: StickmanRenderState,
    rng: Phaser.Math.RandomDataGenerator,
  ): void {
    const chestY = shoulderY + 2
    const liftUpPx = state.cloakLift > 0 ? state.cloakLift * 12 : 0
    const settlePx = state.cloakLift < 0 ? -state.cloakLift * 5.6 : 0
    const hemY = legEndY - 7 - liftUpPx + settlePx

    // 下落时前披风会被气流掀起，直接改成更明显的翻卷轮廓。
    if (state.isFall) {
      const rearEdgeX = centerX - 13.8
      const frontEdgeX = centerX + 8.2
      const foldTopY = chestY - 4.2
      const foldMidY = chestY + 1.4
      const liftedHemY = hemY - 7.2

      graphics.fillStyle(INK_DARK, 0.66)
      graphics.beginPath()
      graphics.moveTo(rearEdgeX, chestY + 0.2)
      graphics.lineTo(frontEdgeX, foldTopY)
      graphics.lineTo(centerX + 5.8, foldMidY)
      graphics.lineTo(centerX - 4.6, liftedHemY)
      graphics.lineTo(centerX - 12.4, chestY + 5.4)
      graphics.closePath()
      graphics.fillPath()

      graphics.fillStyle(INK_MID, 0.42)
      graphics.beginPath()
      graphics.moveTo(centerX - 2.2, chestY - 0.6)
      graphics.lineTo(centerX + 9.6, foldTopY + 1.4)
      graphics.lineTo(centerX + 3.4, foldMidY + 0.8)
      graphics.lineTo(centerX - 3.2, liftedHemY - 0.6)
      graphics.closePath()
      graphics.fillPath()

      graphics.lineStyle(1.6, INK_DARK, 0.92)
      graphics.beginPath()
      graphics.moveTo(centerX - 2.2, chestY - 0.6)
      graphics.lineTo(centerX + 9.6, foldTopY + 1.4)
      graphics.lineTo(centerX + 3.4, foldMidY + 0.8)
      graphics.lineTo(centerX - 3.2, liftedHemY - 0.6)
      graphics.strokePath()
      return
    }

    // 跑动时前披风偏向前摆，突出冲刺方向和速度感。
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

    // 非跑动/下落状态回到相对对称的正面披风结构。
    const sway = state.lean * 2.8
    const landCompress = state.isLand ? 2.4 : 0
    graphics.fillStyle(INK_DARK, 0.62)
    graphics.beginPath()
    graphics.moveTo(centerX - 8.6, chestY + 0.2)
    graphics.lineTo(centerX + 8.6, chestY + 0.2)
    graphics.lineTo(centerX + 5.8 + sway * 0.15, hemY - 5.2 + landCompress)
    graphics.lineTo(centerX - 5.8 + sway * 0.15, hemY - 5.2 + landCompress)
    graphics.closePath()
    graphics.fillPath()

    graphics.fillStyle(INK_MID, 0.36)
    graphics.beginPath()
    graphics.moveTo(centerX - 2.2, chestY)
    graphics.lineTo(centerX - 12.1 + sway * 0.3, chestY + 8.3)
    graphics.lineTo(centerX - 8.5 + sway * 0.2, hemY + landCompress)
    graphics.lineTo(centerX - 1, hemY - 7 + landCompress)
    graphics.closePath()
    graphics.fillPath()

    graphics.beginPath()
    graphics.moveTo(centerX + 2.2, chestY)
    graphics.lineTo(centerX + 12.1 + sway * 0.3, chestY + 8.3)
    graphics.lineTo(centerX + 8.5 + sway * 0.2, hemY + landCompress)
    graphics.lineTo(centerX + 1, hemY - 7 + landCompress)
    graphics.closePath()
    graphics.fillPath()

    graphics.lineStyle(1.48, INK_DARK, 0.9)
    graphics.beginPath()
    graphics.moveTo(centerX - 2.2, chestY)
    graphics.lineTo(centerX - 12.1 + sway * 0.3, chestY + 8.3)
    graphics.lineTo(centerX - 8.5 + sway * 0.2, hemY + landCompress)
    graphics.strokePath()
    graphics.beginPath()
    graphics.moveTo(centerX + 2.2, chestY)
    graphics.lineTo(centerX + 12.1 + sway * 0.3, chestY + 8.3)
    graphics.lineTo(centerX + 8.5 + sway * 0.2, hemY + landCompress)
    graphics.strokePath()
  }

  // 笔触分为主笔、辅笔和装饰笔，用不同粗细/透明度模拟毛笔质感。
  private drawMainStroke(
    graphics: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    width: number,
    rng: Phaser.Math.RandomDataGenerator,
  ): void {
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

  private drawSecondaryStroke(
    graphics: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    width: number,
    rng: Phaser.Math.RandomDataGenerator,
  ): void {
    const segments = 5
    // 辅笔透明度更低，用来补结构而不是承担主体外轮廓。
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

  private drawDecorativeStroke(
    graphics: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    width: number,
    rng: Phaser.Math.RandomDataGenerator,
  ): void {
    const segments = 6
    // 装饰笔刻意允许“断笔”，模拟干笔刷留下的残缺感。
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

  private drawDryCircle(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    centerY: number,
    radius: number,
    width: number,
    rng: Phaser.Math.RandomDataGenerator,
  ): void {
    // 头部用多次轻微抖动的圆环叠画，避免看起来像机械几何圆。
    for (let index = 0; index < 3; index += 1) {
      graphics.lineStyle(
        Math.max(1, width - index * 0.6),
        INK_DARK,
        rng.realInRange(0.8, 0.97),
      )
      graphics.strokeCircle(
        centerX + rng.realInRange(-0.5, 0.5),
        centerY + rng.realInRange(-0.5, 0.5),
        radius + rng.realInRange(-0.45, 0.45),
      )
    }
  }

  // 动画注册只做一次，GameScene 后续按 key 直接播放。
  private createStickmanAnimations(): void {
    if (!this.anims.exists(STICKMAN_ANIM.idle)) {
      this.anims.create({
        key: STICKMAN_ANIM.idle,
        frames: STICKMAN_IDLE_FRAMES.map((key) => ({ key })),
        frameRate: 4,
        repeat: -1,
      })
    }

    if (!this.anims.exists(STICKMAN_ANIM.run)) {
      this.anims.create({
        key: STICKMAN_ANIM.run,
        frames: STICKMAN_RUN_FRAMES.map((key) => ({ key })),
        frameRate: 12,
        repeat: -1,
      })
    }

    if (!this.anims.exists(STICKMAN_ANIM.fall)) {
      this.anims.create({
        key: STICKMAN_ANIM.fall,
        frames: STICKMAN_FALL_FRAMES.map((key) => ({ key })),
        frameRate: 10,
        repeat: -1,
      })
    }

    if (!this.anims.exists(STICKMAN_ANIM.land)) {
      this.anims.create({
        key: STICKMAN_ANIM.land,
        frames: STICKMAN_LAND_FRAMES.map((key) => ({ key })),
        frameRate: 14,
        repeat: 0,
      })
    }

    if (!this.anims.exists(STICKMAN_ANIM.hit)) {
      this.anims.create({
        key: STICKMAN_ANIM.hit,
        frames: STICKMAN_HIT_FRAMES.map((key) => ({ key })),
        frameRate: 10,
        repeat: -1,
      })
    }

    if (!this.anims.exists(STICKMAN_ANIM.death)) {
      this.anims.create({
        key: STICKMAN_ANIM.death,
        frames: STICKMAN_DEATH_FRAMES.map((key) => ({ key })),
        frameRate: 7,
        repeat: -1,
        yoyo: true,
      })
    }
  }
}
