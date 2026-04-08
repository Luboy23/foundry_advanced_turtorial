/**
 * 本地存储键与设置模型。
 * 统一描述设置结构、旧榜单键名和当前规则版本。
 */
import type { InputSource } from '../../game/types'

export const SETTINGS_KEY = 'downman.settings.v1'
export const LEADERBOARD_KEY = 'downman.leaderboard.v3'
export const LEGACY_LEADERBOARD_KEY = 'downman.leaderboard.v2'
export const LEGACY_LEADERBOARD_KEY_V1 = 'downman.leaderboard.v1'
export const RULE_MIGRATION_KEY = 'downman.rule-version'
export const RULE_VERSION = 3
export const SETTINGS_SCHEMA_VERSION = 2

// follow 对应目标点跟随，buttons 对应左右按键，两者都只在移动端 UI 中出现。
export type TouchControlMode = 'follow' | 'buttons'

// 设置模型只保留当前前端真正消费的字段，语言已固定为简中。
export type SettingsModel = {
  schemaVersion: typeof SETTINGS_SCHEMA_VERSION
  musicEnabled: boolean
  sfxEnabled: boolean
  language: 'zh-CN'
  touchControlMode: TouchControlMode
  dismissPortraitHint: boolean
}

// 本地排行榜已退化为兼容数据结构，主要用于旧数据清理和少量回退逻辑。
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

// 默认设置尽量对应“首次打开即可游玩”的安全值。
export const defaultSettings: SettingsModel = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  musicEnabled: true,
  sfxEnabled: true,
  language: 'zh-CN',
  touchControlMode: 'follow',
  dismissPortraitHint: false,
}
