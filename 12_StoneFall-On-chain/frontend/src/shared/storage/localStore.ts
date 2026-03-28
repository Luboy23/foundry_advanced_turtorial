/**
 * 模块职责：管理本地设置与历史缓存，提供迁移、校验、读写及选择器。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import type { InputSource, SessionStats } from '../../game/types'
import {
  defaultSettings,
  LEADERBOARD_KEY,
  LEGACY_LEADERBOARD_KEY,
  LEGACY_LEADERBOARD_KEY_V1,
  RULE_MIGRATION_KEY,
  RULE_VERSION,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_KEY,
  type LeaderboardEntry,
  type SettingsModel,
} from './types'

const hasLocalStorage = (): boolean => typeof window !== 'undefined'
let hasEnsuredRuleMigration = false

// 读取原始字符串；任何异常（隐私模式、权限受限）都降级为 null。
const readRaw = (key: string): string | null => {
  if (!hasLocalStorage()) {
    return null
  }

  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

// 写入原始字符串；失败时静默降级，避免影响游戏主流程。
const writeRaw = (key: string, value: string): void => {
  if (!hasLocalStorage()) {
    return
  }

  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore quota and private mode failures
  }
}

/**
 * parseJsonWithFallback：解析输入并回退到安全结果。
 */
export const parseJsonWithFallback = <T>(
  raw: string | null,
  fallback: T,
): T => {
  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * 迁移历史设置结构到当前 schema。
 * 任何非法字段都会回退到 defaultSettings。
 */
export const migrateSettings = (data: unknown): SettingsModel => {
  if (!data || typeof data !== 'object') {
    return defaultSettings
  }

  const source = data as Partial<SettingsModel> & {
    bestScore?: number
    schemaVersion?: number
    dismissPortraitHint?: boolean
  }

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    musicEnabled:
      typeof source.musicEnabled === 'boolean'
        ? source.musicEnabled
        : defaultSettings.musicEnabled,
    sfxEnabled:
      typeof source.sfxEnabled === 'boolean'
        ? source.sfxEnabled
        : defaultSettings.sfxEnabled,
    language: 'zh-CN',
    touchControlMode:
      source.touchControlMode === 'follow' || source.touchControlMode === 'buttons'
        ? source.touchControlMode
        : defaultSettings.touchControlMode,
    dismissPortraitHint:
      typeof source.dismissPortraitHint === 'boolean'
        ? source.dismissPortraitHint
        : defaultSettings.dismissPortraitHint,
  }
}

const normalizeSettings = (data: unknown): SettingsModel => migrateSettings(data)

// 对本地榜单单条记录做结构校验 + 数值归一化。
const normalizeEntry = (item: unknown): LeaderboardEntry | null => {
  if (!item || typeof item !== 'object') {
    return null
  }

  const entry = item as Partial<LeaderboardEntry>

  if (
    typeof entry.id !== 'string' ||
    typeof entry.score !== 'number' ||
    typeof entry.survivalMs !== 'number' ||
    typeof entry.maxDifficulty !== 'number' ||
    typeof entry.peakThreatLevel !== 'number' ||
    typeof entry.createdAt !== 'number' ||
    (entry.inputType !== 'keyboard' &&
      entry.inputType !== 'touch' &&
      entry.inputType !== 'mouse')
  ) {
    return null
  }

  return {
    id: entry.id,
    score: Math.max(0, Math.floor(entry.score)),
    survivalMs: Math.max(0, Math.floor(entry.survivalMs)),
    maxDifficulty: Math.max(0, Math.floor(entry.maxDifficulty)),
    peakThreatLevel: Math.max(1, Number(entry.peakThreatLevel.toFixed(2))),
    createdAt: entry.createdAt,
    inputType: entry.inputType,
    ruleVersion: RULE_VERSION,
  }
}

const runRuleMigration = (): void => {
  const marker = readRaw(RULE_MIGRATION_KEY)
  if (marker === String(RULE_VERSION)) {
    return
  }

  // 规则版本变化后清空旧缓存，避免新旧计分规则混杂。
  writeRaw(LEGACY_LEADERBOARD_KEY_V1, '[]')
  writeRaw(LEGACY_LEADERBOARD_KEY, '[]')
  writeRaw(LEADERBOARD_KEY, '[]')
  writeRaw(RULE_MIGRATION_KEY, String(RULE_VERSION))
}

const ensureRuleMigration = (): void => {
  if (hasEnsuredRuleMigration) {
    return
  }

  runRuleMigration()
  hasEnsuredRuleMigration = true
}

/**
 * 按业务规则排序：
 * 1) 分数降序
 * 2) 生存时长降序
 * 3) 创建时间升序（先达成者优先）
 */
export const sortLeaderboardEntries = (
  entries: LeaderboardEntry[],
): LeaderboardEntry[] => {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }

    if (b.survivalMs !== a.survivalMs) {
      return b.survivalMs - a.survivalMs
    }

    return a.createdAt - b.createdAt
  })
}

/**
 * loadSettings：从外部来源读取数据。
 */
export const loadSettings = (): SettingsModel => {
  ensureRuleMigration()

  // 读后写回标准化结果，确保下次读取无需再次兼容分支。
  const parsed = parseJsonWithFallback(readRaw(SETTINGS_KEY), defaultSettings)
  const normalized = normalizeSettings(parsed)

  writeRaw(SETTINGS_KEY, JSON.stringify(normalized))
  return normalized
}

/**
 * saveSettings：将数据写入持久化介质。
 */
export const saveSettings = (settings: SettingsModel): void => {
  const normalized = normalizeSettings(settings)
  writeRaw(SETTINGS_KEY, JSON.stringify(normalized))
}

/**
 * loadLeaderboard：从外部来源读取数据。
 */
export const loadLeaderboard = (): LeaderboardEntry[] => {
  ensureRuleMigration()

  const parsed = parseJsonWithFallback<unknown[]>(readRaw(LEADERBOARD_KEY), [])

  const normalized = Array.isArray(parsed)
    ? parsed.map(normalizeEntry).filter((entry): entry is LeaderboardEntry => Boolean(entry))
    : []

  // 始终限制最大 50 条，避免 localStorage 无限膨胀。
  const limited = normalized.slice(-50)
  writeRaw(LEADERBOARD_KEY, JSON.stringify(limited))

  return limited
}

/**
 * saveLeaderboard：将数据写入持久化介质。
 */
export const saveLeaderboard = (entries: LeaderboardEntry[]): void => {
  writeRaw(LEADERBOARD_KEY, JSON.stringify(entries.slice(-50)))
}

/**
 * 向本地榜单追加一条记录，并维持最大容量 50。
 */
export const addLeaderboardEntry = (
  currentEntries: LeaderboardEntry[],
  nextEntry: LeaderboardEntry,
): LeaderboardEntry[] => {
  const next = [...currentEntries, nextEntry].slice(-50)
  saveLeaderboard(next)
  return next
}

/**
 * 清空本地榜单缓存。
 */
export const clearLeaderboard = (): void => {
  saveLeaderboard([])
}

// 链上化后，启动时清理旧版本地排行榜，避免用户看到过期数据。
export const purgeLegacyLeaderboardData = (): void => {
  writeRaw(LEGACY_LEADERBOARD_KEY_V1, '[]')
  writeRaw(LEGACY_LEADERBOARD_KEY, '[]')
  writeRaw(LEADERBOARD_KEY, '[]')
  writeRaw(RULE_MIGRATION_KEY, String(RULE_VERSION))
}

/**
 * 由会话统计构造本地榜单记录。
 * 若运行环境不支持 crypto.randomUUID，则回退到时间戳 + 随机串。
 */
export const createLeaderboardEntry = (
  stats: SessionStats,
  inputType: InputSource,
): LeaderboardEntry => {
  return {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    score: stats.score,
    survivalMs: stats.survivalMs,
    maxDifficulty: stats.maxDifficulty,
    peakThreatLevel: stats.peakThreatLevel,
    createdAt: Date.now(),
    inputType,
    ruleVersion: RULE_VERSION,
  }
}

/**
 * 选取榜单 Top10。
 */
export const selectTopEntries = (entries: LeaderboardEntry[]): LeaderboardEntry[] => {
  return sortLeaderboardEntries(entries).slice(0, 10)
}

/**
 * 选取最近 5 条记录。
 */
export const selectRecentEntries = (entries: LeaderboardEntry[]): LeaderboardEntry[] => {
  return [...entries].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)
}

/**
 * __resetRuleMigrationForTests：导出可复用能力。
 */
export const __resetRuleMigrationForTests = (): void => {
  hasEnsuredRuleMigration = false
}
