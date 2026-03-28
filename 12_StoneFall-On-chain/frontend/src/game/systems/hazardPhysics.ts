/**
 * 模块职责：提供 game/systems/hazardPhysics.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import type { DifficultySnapshot } from '../types'

type RandomFn = () => number

/**
 * 类型定义：SpikeMotionConfig。
 */
export type SpikeMotionConfig = {
  width: number
  height: number
  angle: number
  velocityX: 0
  velocityY: number
  gravityY: number
  terminalVelocityY: number
  angularVelocity: number
  bodyWidth: number
  bodyHeight: number
  bodyOffsetX: number
  bodyOffsetY: number
}

/**
 * 类型定义：BoulderMotionConfig。
 */
export type BoulderMotionConfig = {
  size: number
  angle: number
  velocityX: 0
  velocityY: number
  gravityY: number
  terminalVelocityY: number
  angularVelocity: number
  bodyWidth: number
  bodyHeight: number
  bodyOffsetX: number
  bodyOffsetY: number
}

const randomRange = (min: number, max: number, random: RandomFn): number => {
  return min + (max - min) * random()
}

const randomInt = (min: number, max: number, random: RandomFn): number => {
  return Math.round(randomRange(min, max, random))
}

/**
 * buildSpikeMotionConfig：构建并返回计算结果。
 */
export const buildSpikeMotionConfig = (
  snapshot: DifficultySnapshot,
  random: RandomFn = Math.random,
): SpikeMotionConfig => {
  const width = randomInt(40, 58, random)
  const height = Math.round(width * 1.24)
  const bodyWidth = width * 0.42
  const bodyHeight = height * 0.66
  const gravityY = 680 + snapshot.threatLevel * 34 + randomRange(-30, 30, random)
  const velocityY = snapshot.fallSpeed * 0.58 + randomRange(18, 76, random)
  const terminalVelocityY =
    snapshot.fallSpeed + 380 + snapshot.threatLevel * 18 + randomRange(0, 30, random)

  return {
    width,
    height,
    angle: 0,
    velocityX: 0,
    velocityY,
    gravityY,
    terminalVelocityY,
    angularVelocity: 0,
    bodyWidth,
    bodyHeight,
    bodyOffsetX: (width - bodyWidth) / 2,
    bodyOffsetY: height * 0.22,
  }
}

/**
 * buildBoulderMotionConfig：构建并返回计算结果。
 */
export const buildBoulderMotionConfig = (
  snapshot: DifficultySnapshot,
  random: RandomFn = Math.random,
): BoulderMotionConfig => {
  const size = randomInt(48, 84, random)
  const bodySize = size * 0.78
  const gravityY = 620 + snapshot.threatLevel * 30 + randomRange(-26, 26, random)
  const velocityY = snapshot.fallSpeed * 0.52 + randomRange(-8, 48, random)
  const terminalVelocityY =
    snapshot.fallSpeed + 340 + snapshot.threatLevel * 20 + randomRange(0, 24, random)

  return {
    size,
    angle: randomRange(0, 360, random),
    velocityX: 0,
    velocityY,
    gravityY,
    terminalVelocityY,
    angularVelocity: randomRange(-55, 55, random),
    bodyWidth: bodySize,
    bodyHeight: bodySize,
    bodyOffsetX: (size - bodySize) / 2,
    bodyOffsetY: (size - bodySize) / 2,
  }
}
