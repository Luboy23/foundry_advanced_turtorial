/**
 * 模块职责：提供 shared/storage/types.ts 对应的业务能力与对外导出。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import type { InputSource } from '../../game/types'

/**
 * SETTINGS_KEY：导出可复用能力。
 */
export const SETTINGS_KEY = 'stonefall.settings.v1'
/**
 * LEADERBOARD_KEY：导出可复用能力。
 */
export const LEADERBOARD_KEY = 'stonefall.leaderboard.v3'
/**
 * LEGACY_LEADERBOARD_KEY：导出可复用能力。
 */
export const LEGACY_LEADERBOARD_KEY = 'stonefall.leaderboard.v2'
/**
 * LEGACY_LEADERBOARD_KEY_V1：导出可复用能力。
 */
export const LEGACY_LEADERBOARD_KEY_V1 = 'stonefall.leaderboard.v1'
/**
 * RULE_MIGRATION_KEY：导出可复用能力。
 */
export const RULE_MIGRATION_KEY = 'stonefall.rule-version'
/**
 * RULE_VERSION：导出可复用能力。
 */
export const RULE_VERSION = 3
/**
 * SETTINGS_SCHEMA_VERSION：导出可复用能力。
 */
export const SETTINGS_SCHEMA_VERSION = 2

/**
 * 类型定义：TouchControlMode。
 */
export type TouchControlMode = 'follow' | 'buttons'

/**
 * 类型定义：SettingsModel。
 */
export type SettingsModel = {
  schemaVersion: typeof SETTINGS_SCHEMA_VERSION
  musicEnabled: boolean
  sfxEnabled: boolean
  language: 'zh-CN'
  touchControlMode: TouchControlMode
  dismissPortraitHint: boolean
}

/**
 * 类型定义：LeaderboardEntry。
 */
export type LeaderboardEntry = {
  id: string
  score: number
  survivalMs: number
  maxDifficulty: number
  peakThreatLevel: number
  createdAt: number
  inputType: InputSource
  ruleVersion: 3
}

/**
 * defaultSettings：导出可复用能力。
 */
export const defaultSettings: SettingsModel = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  musicEnabled: true,
  sfxEnabled: true,
  language: 'zh-CN',
  touchControlMode: 'follow',
  dismissPortraitHint: false,
}
