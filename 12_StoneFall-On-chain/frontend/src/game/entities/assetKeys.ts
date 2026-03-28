/**
 * 模块职责：提供 game/entities/assetKeys.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

export const STICKMAN_IDLE_FRAMES = ['stickman-idle-0', 'stickman-idle-1'] as const
/**
 * STICKMAN_RUN_FRAMES：导出可复用能力。
 */
export const STICKMAN_RUN_FRAMES = [
  'stickman-run-0',
  'stickman-run-1',
  'stickman-run-2',
  'stickman-run-3',
  'stickman-run-4',
  'stickman-run-5',
] as const
/**
 * STICKMAN_HIT_FRAMES：导出可复用能力。
 */
export const STICKMAN_HIT_FRAMES = ['stickman-hit-0', 'stickman-hit-1'] as const
/**
 * STICKMAN_DEATH_FRAMES：导出可复用能力。
 */
export const STICKMAN_DEATH_FRAMES = [
  'stickman-death-0',
  'stickman-death-1',
  'stickman-death-2',
  'stickman-death-3',
  'stickman-death-4',
] as const

/**
 * STICKMAN_ANIM：导出可复用能力。
 */
export const STICKMAN_ANIM = {
  idle: 'stickman-idle',
  run: 'stickman-run',
  hit: 'stickman-hit',
  death: 'stickman-death',
} as const

/**
 * SPIKE_TEXTURE_KEY：导出可复用能力。
 */
export const SPIKE_TEXTURE_KEY = 'hazard-spike'
/**
 * BOULDER_TEXTURE_PREFIX：导出可复用能力。
 */
export const BOULDER_TEXTURE_PREFIX = 'hazard-boulder'
/**
 * BOULDER_TEXTURE_COUNT：导出可复用能力。
 */
export const BOULDER_TEXTURE_COUNT = 24
/**
 * PAPER_TEXTURE_KEY：导出可复用能力。
 */
export const PAPER_TEXTURE_KEY = 'paper-grain'
/**
 * INK_WASH_TEXTURE_KEY：导出可复用能力。
 */
export const INK_WASH_TEXTURE_KEY = 'ink-wash'
/**
 * INK_SPLASH_TEXTURE_KEY：导出可复用能力。
 */
export const INK_SPLASH_TEXTURE_KEY = 'ink-splash'

/**
 * getBoulderTextureKeys：读取并返回对应数据。
 */
export const getBoulderTextureKeys = (): string[] => {
  return Array.from({ length: BOULDER_TEXTURE_COUNT }, (_, index) =>
    `${BOULDER_TEXTURE_PREFIX}-${index}`,
  )
}
