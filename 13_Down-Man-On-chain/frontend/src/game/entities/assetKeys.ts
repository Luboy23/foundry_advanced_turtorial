/**
 * 运行时生成纹理与动画的 key 常量。
 * BootScene 负责生成对应 texture，GameScene 只通过这些 key 引用资源。
 */
export const STICKMAN_IDLE_FRAMES = ['stickman-idle-0', 'stickman-idle-1'] as const
export const STICKMAN_RUN_FRAMES = [
  'stickman-run-0',
  'stickman-run-1',
  'stickman-run-2',
  'stickman-run-3',
  'stickman-run-4',
  'stickman-run-5',
] as const
export const STICKMAN_FALL_FRAMES = [
  'stickman-fall-0',
  'stickman-fall-1',
  'stickman-fall-2',
] as const
export const STICKMAN_LAND_FRAMES = [
  'stickman-land-0',
  'stickman-land-1',
  'stickman-land-2',
] as const
export const STICKMAN_HIT_FRAMES = ['stickman-hit-0', 'stickman-hit-1'] as const
export const STICKMAN_DEATH_FRAMES = [
  'stickman-death-0',
  'stickman-death-1',
  'stickman-death-2',
  'stickman-death-3',
  'stickman-death-4',
] as const

// 动画 key 由 BootScene 注册，GameScene 只根据姿态切换，不关心帧列表细节。
export const STICKMAN_ANIM = {
  idle: 'stickman-idle',
  run: 'stickman-run',
  fall: 'stickman-fall',
  land: 'stickman-land',
  hit: 'stickman-hit',
  death: 'stickman-death',
} as const

// 平台与背景纹理全部通过这些常量共享，避免字符串散落在场景代码中。
export const PLATFORM_STABLE_TEXTURE_KEY = 'platform-stable'
export const PLATFORM_MOVING_TEXTURE_KEY = 'platform-moving'
export const PLATFORM_VANISHING_TEXTURE_KEY = 'platform-vanishing'
export const PAPER_TEXTURE_KEY = 'paper-grain'
export const INK_WASH_TEXTURE_KEY = 'ink-wash'
export const INK_SPLASH_TEXTURE_KEY = 'ink-splash'
