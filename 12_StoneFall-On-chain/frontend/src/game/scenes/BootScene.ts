/**
 * 模块职责：负责 Phaser 纹理与动画资源的程序化构建与预热。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import Phaser from 'phaser'
import {
  BOULDER_TEXTURE_COUNT,
  BOULDER_TEXTURE_PREFIX,
  INK_SPLASH_TEXTURE_KEY,
  INK_WASH_TEXTURE_KEY,
  PAPER_TEXTURE_KEY,
  SPIKE_TEXTURE_KEY,
  STICKMAN_ANIM,
  STICKMAN_DEATH_FRAMES,
  STICKMAN_HIT_FRAMES,
  STICKMAN_IDLE_FRAMES,
  STICKMAN_RUN_FRAMES,
} from '../entities/assetKeys'

type StickmanPose = {
  armSwing: number
  legSwing: number
  bodyTilt: number
  headYOffset: number
}

type StickmanRenderState = {
  isRun: boolean
  gait: number
  lean: number
}

const STICKMAN_WIDTH = 84
const STICKMAN_HEIGHT = 146
const INK_DARK = 0x101010
const INK_MID = 0x3d3d3d
const ROCK_OBSIDIAN = 0x080808
const ROCK_BASALT_DARK = 0x141414
const ROCK_BASALT_MID = 0x242424
const ROCK_BASALT_LIGHT = 0x464646
const ROCK_ASH_LIGHT = 0x6a6a6a
const SWORD_RED_DARK = 0x4d1010
const SWORD_RED_MID = 0x7c1717
const SWORD_RED_LIGHT = 0xb82a2a
const SWORD_RED_HIGHLIGHT = 0xe07373

/**
 * 类实现：BootScene。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'boot-scene' })
  }

  /**
   * create：初始化场景资源与运行时对象。
   */
  create(): void {
    this.createBackgroundTextures()
    this.createStickmanTextures()
    this.createHazardTextures()
    this.createInkSplashTexture()
    this.createStickmanAnimations()

    this.scene.start('game-scene')
    this.scene.launch('overlay-bridge-scene')
  }

  /**
   * createBackgroundTextures：初始化场景资源与运行时对象。
   */
  private createBackgroundTextures(): void {
    this.createPaperTexture()
    this.createInkWashTexture()
  }

  /**
   * createStickmanTextures：初始化场景资源与运行时对象。
   */
  private createStickmanTextures(): void {
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

    STICKMAN_HIT_FRAMES.forEach((key, index) => {
      this.drawStickmanFrame(key, hitPoses[index])
    })

    STICKMAN_DEATH_FRAMES.forEach((key, index) => {
      this.drawStickmanFrame(key, deathPoses[index])
    })
  }

  /**
   * drawStickmanFrame：绘制纹理或图形细节。
   */
  private drawStickmanFrame(textureKey: string, pose: StickmanPose): void {
    const rng = new Phaser.Math.RandomDataGenerator([`stickman-${textureKey}`])
    const centerX = STICKMAN_WIDTH / 2
    const headY = 24 + pose.headYOffset * 0.8
    const headRadius = 7.4

    const shoulderY = 43
    const torsoBottomY = 80
    const legEndY = 129

    const renderState: StickmanRenderState = {
      isRun: textureKey.startsWith('stickman-run'),
      gait: Phaser.Math.Clamp(pose.armSwing, -1, 1),
      lean: pose.bodyTilt,
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

  /**
   * drawFrontalBody：绘制纹理或图形细节。
   */
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

  /**
   * drawRunSideBody：绘制纹理或图形细节。
   */
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

  /**
   * drawBackSword：绘制纹理或图形细节。
   */
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

  /**
   * createHazardTextures：初始化场景资源与运行时对象。
   */
  private createHazardTextures(): void {
    this.createSpikeTexture()
    this.createBoulderTextures()
  }

  /**
   * createSpikeTexture：初始化场景资源与运行时对象。
   */
  private createSpikeTexture(): void {
    const width = 60
    const height = 70
    const rng = new Phaser.Math.RandomDataGenerator(['hazard-spike-ink'])
    const graphics = this.add.graphics({ x: 0, y: 0 })

    const tipX = width * 0.5 + rng.realInRange(-0.9, 0.9)
    const tipY = height - 1
    const leftBaseX = width * 0.1
    const rightBaseX = width * 0.9
    const ridgeLeftX = width * 0.34 + rng.realInRange(-1.2, 1.2)
    const ridgeRightX = width * 0.66 + rng.realInRange(-1.2, 1.2)
    const topY = 10

    graphics.fillStyle(ROCK_BASALT_DARK, 0.98)
    graphics.lineStyle(2.5, ROCK_OBSIDIAN, 0.98)
    graphics.beginPath()
    graphics.moveTo(tipX, tipY)
    graphics.lineTo(leftBaseX, topY + 2)
    graphics.lineTo(ridgeLeftX, topY - 2)
    graphics.lineTo(width * 0.5 + rng.realInRange(-1.1, 1.1), topY + 2.2)
    graphics.lineTo(ridgeRightX, topY - 1.8)
    graphics.lineTo(rightBaseX, topY + 2)
    graphics.closePath()
    graphics.fillPath()
    graphics.strokePath()

    // Subtle side facet to avoid a flat triangle look.
    graphics.fillStyle(ROCK_OBSIDIAN, 0.34)
    graphics.beginPath()
    graphics.moveTo(ridgeRightX - 1.4, topY + 0.8)
    graphics.lineTo(tipX + width * 0.12, tipY - 14)
    graphics.lineTo(tipX + width * 0.03, tipY - 5)
    graphics.lineTo(width * 0.52, topY + 3)
    graphics.closePath()
    graphics.fillPath()

    // Ash-like and vesicle-like porous dots.
    for (let index = 0; index < 36; index += 1) {
      graphics.fillStyle(
        index % 3 === 0 ? ROCK_ASH_LIGHT : ROCK_BASALT_MID,
        index % 3 === 0 ? rng.realInRange(0.12, 0.22) : rng.realInRange(0.2, 0.34),
      )
      graphics.fillCircle(
        rng.realInRange(width * 0.22, width * 0.78),
        rng.realInRange(height * 0.17, height * 0.88),
        rng.realInRange(0.45, 1.4),
      )
    }

    for (let index = 0; index < 12; index += 1) {
      graphics.fillStyle(ROCK_OBSIDIAN, rng.realInRange(0.2, 0.4))
      graphics.fillCircle(
        rng.realInRange(width * 0.24, width * 0.76),
        rng.realInRange(height * 0.2, height * 0.9),
        rng.realInRange(0.7, 2),
      )
    }

    // Vein cracks.
    for (let index = 0; index < 4; index += 1) {
      const startX = rng.realInRange(width * 0.3, width * 0.7)
      const startY = rng.realInRange(height * 0.18, height * 0.34)
      const midX = startX + rng.realInRange(-4.5, 4.5)
      const midY = startY + rng.realInRange(8, 14)
      const endX = midX + rng.realInRange(-4, 4)
      const endY = midY + rng.realInRange(9, 16)
      graphics.lineStyle(1.1, ROCK_OBSIDIAN, rng.realInRange(0.36, 0.55))
      graphics.beginPath()
      graphics.moveTo(startX, startY)
      graphics.lineTo(midX, midY)
      graphics.lineTo(endX, endY)
      graphics.strokePath()
    }

    // Cold edge highlight.
    graphics.lineStyle(1.1, ROCK_BASALT_LIGHT, 0.5)
    graphics.beginPath()
    graphics.moveTo(ridgeLeftX + 2.2, topY + 1.2)
    graphics.lineTo(tipX - 2.8, tipY - 7.4)
    graphics.strokePath()

    graphics.generateTexture(SPIKE_TEXTURE_KEY, width, height)
    graphics.destroy()
  }

  /**
   * createBoulderTextures：初始化场景资源与运行时对象。
   */
  private createBoulderTextures(): void {
    for (let index = 0; index < BOULDER_TEXTURE_COUNT; index += 1) {
      this.createOneBoulderTexture(index)
    }
  }

  /**
   * createOneBoulderTexture：初始化场景资源与运行时对象。
   */
  private createOneBoulderTexture(index: number): void {
    const key = `${BOULDER_TEXTURE_PREFIX}-${index}`
    const size = 74
    const rng = new Phaser.Math.RandomDataGenerator([`boulder-${index}`])
    const points = rng.between(7, 10)

    const graphics = this.add.graphics({ x: 0, y: 0 })

    graphics.fillStyle(ROCK_BASALT_DARK, 0.99)
    graphics.lineStyle(2.8, ROCK_OBSIDIAN, 0.98)

    const center = size / 2
    const vertices: Array<{ x: number; y: number }> = []

    for (let i = 0; i < points; i += 1) {
      const angle = (Math.PI * 2 * i) / points + rng.realInRange(-0.2, 0.2)
      const radius = rng.realInRange(22, 33)
      vertices.push({
        x: center + Math.cos(angle) * radius,
        y: center + Math.sin(angle) * radius,
      })
    }

    graphics.beginPath()
    graphics.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i += 1) {
      graphics.lineTo(vertices[i].x, vertices[i].y)
    }
    graphics.closePath()
    graphics.fillPath()
    graphics.strokePath()

    // Main soot shading masses.
    for (let i = 0; i < 18; i += 1) {
      graphics.fillStyle(
        i % 4 === 0 ? ROCK_BASALT_LIGHT : ROCK_BASALT_MID,
        i % 4 === 0 ? rng.realInRange(0.1, 0.2) : rng.realInRange(0.14, 0.26),
      )
      graphics.fillEllipse(
        rng.realInRange(16, 58),
        rng.realInRange(15, 59),
        rng.realInRange(6, 16),
        rng.realInRange(4, 13),
      )
    }

    // Porous volcanic holes.
    for (let i = 0; i < 14; i += 1) {
      const craterX = rng.realInRange(16, 58)
      const craterY = rng.realInRange(16, 58)
      const craterR = rng.realInRange(1.6, 4.9)
      graphics.fillStyle(ROCK_OBSIDIAN, rng.realInRange(0.24, 0.45))
      graphics.fillCircle(craterX, craterY, craterR)
      graphics.fillStyle(ROCK_BASALT_LIGHT, rng.realInRange(0.09, 0.18))
      graphics.fillCircle(craterX - craterR * 0.24, craterY - craterR * 0.24, craterR * 0.44)
    }

    // Basalt mineral speckles.
    for (let i = 0; i < 44; i += 1) {
      graphics.fillStyle(
        i % 5 === 0 ? ROCK_ASH_LIGHT : ROCK_BASALT_MID,
        i % 5 === 0 ? rng.realInRange(0.24, 0.4) : rng.realInRange(0.18, 0.3),
      )
      graphics.fillCircle(
        rng.realInRange(13, 61),
        rng.realInRange(13, 61),
        rng.realInRange(0.35, 1.25),
      )
    }

    // Rock fracture lines.
    for (let i = 0; i < 6; i += 1) {
      const startX = rng.realInRange(15, 59)
      const startY = rng.realInRange(15, 59)
      const midX = startX + rng.realInRange(-8, 8)
      const midY = startY + rng.realInRange(-7, 7)
      const endX = midX + rng.realInRange(-8, 8)
      const endY = midY + rng.realInRange(-7, 7)
      graphics.lineStyle(1.05, ROCK_OBSIDIAN, rng.realInRange(0.3, 0.52))
      graphics.beginPath()
      graphics.moveTo(startX, startY)
      graphics.lineTo(midX, midY)
      graphics.lineTo(endX, endY)
      graphics.strokePath()
    }

    // Rim highlights to fake hard rocky facets.
    graphics.lineStyle(1, ROCK_BASALT_LIGHT, 0.42)
    for (let i = 0; i < 3; i += 1) {
      const edgeA = vertices[rng.between(0, vertices.length - 1)]
      const edgeB = vertices[rng.between(0, vertices.length - 1)]
      graphics.beginPath()
      graphics.moveTo(
        Phaser.Math.Linear(edgeA.x, center, 0.18),
        Phaser.Math.Linear(edgeA.y, center, 0.18),
      )
      graphics.lineTo(
        Phaser.Math.Linear(edgeB.x, center, 0.12),
        Phaser.Math.Linear(edgeB.y, center, 0.12),
      )
      graphics.strokePath()
    }

    graphics.generateTexture(key, size, size)
    graphics.destroy()
  }

  /**
   * createPaperTexture：初始化场景资源与运行时对象。
   */
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

  /**
   * createInkWashTexture：初始化场景资源与运行时对象。
   */
  private createInkWashTexture(): void {
    const size = 512
    const rng = new Phaser.Math.RandomDataGenerator(['ink-wash-texture'])
    const graphics = this.add.graphics({ x: 0, y: 0 })

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

  /**
   * createInkSplashTexture：初始化场景资源与运行时对象。
   */
  private createInkSplashTexture(): void {
    const size = 96
    const rng = new Phaser.Math.RandomDataGenerator(['ink-splash-texture'])
    const graphics = this.add.graphics({ x: 0, y: 0 })
    const center = size / 2

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

  /**
   * drawWuxiaHat：绘制纹理或图形细节。
   */
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

  /**
   * drawCloakBack：绘制纹理或图形细节。
   */
  private drawCloakBack(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    shoulderY: number,
    legEndY: number,
    state: StickmanRenderState,
    rng: Phaser.Math.RandomDataGenerator,
  ): void {
    const cloakTopY = shoulderY - 3
    const hemY = legEndY - (state.isRun ? 1 : 4)
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
      const layerLift = layer * 3.2
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

  /**
   * drawCloakFront：绘制纹理或图形细节。
   */
  private drawCloakFront(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    shoulderY: number,
    legEndY: number,
    state: StickmanRenderState,
    rng: Phaser.Math.RandomDataGenerator,
  ): void {
    const chestY = shoulderY + 2
    const hemY = legEndY - 7

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

  /**
   * drawMainStroke：绘制纹理或图形细节。
   */
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

  /**
   * drawSecondaryStroke：绘制纹理或图形细节。
   */
  private drawSecondaryStroke(
    graphics: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    width: number,
    rng: Phaser.Math.RandomDataGenerator,
  ): void {
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

  /**
   * drawDecorativeStroke：绘制纹理或图形细节。
   */
  private drawDecorativeStroke(
    graphics: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    width: number,
    rng: Phaser.Math.RandomDataGenerator,
  ): void {
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

  /**
   * drawDryCircle：绘制纹理或图形细节。
   */
  private drawDryCircle(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    centerY: number,
    radius: number,
    width: number,
    rng: Phaser.Math.RandomDataGenerator,
  ): void {
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

  /**
   * createStickmanAnimations：初始化场景资源与运行时对象。
   */
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
