/**
 * 本地设置与旧排行榜存储。
 * 链上成绩是主数据源，本地主要负责设置持久化和历史兼容清理。
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

// 所有 localStorage 访问都包一层容错，避免 Safari 私密模式直接抛异常。
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

// 写入失败默认静默，因为设置持久化不应该阻断主游戏流程。
const writeRaw = (key: string, value: string): void => {
  if (!hasLocalStorage()) {
    return
  }

  try {
    window.localStorage.setItem(key, value)
  } catch {
    // 忽略 Safari 私密模式或 quota 限制等不可恢复的写入失败。
  }
}

// JSON 解析只在这里兜底，外层逻辑统一处理“已经得到有效对象”的情况。
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

// 老版本设置里可能缺字段或残留已废弃字段，这里统一做 schema 收口。
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

// 本地榜单是历史兼容产物，因此读取时要格外严格过滤脏数据。
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

// 规则版本升级时统一清空旧榜单，避免不同计分规则的数据混在一起。
const runRuleMigration = (): void => {
  const marker = readRaw(RULE_MIGRATION_KEY)
  if (marker === String(RULE_VERSION)) {
    return
  }

  writeRaw(LEGACY_LEADERBOARD_KEY_V1, '[]')
  writeRaw(LEGACY_LEADERBOARD_KEY, '[]')
  writeRaw(LEADERBOARD_KEY, '[]')
  writeRaw(RULE_MIGRATION_KEY, String(RULE_VERSION))
}

// 整个应用生命周期只需要做一次规则迁移，避免重复读写 localStorage。
const ensureRuleMigration = (): void => {
  if (hasEnsuredRuleMigration) {
    return
  }

  runRuleMigration()
  hasEnsuredRuleMigration = true
}

// 排序规则与链上榜单保持一致，便于前后端展示结果对齐。
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

// 每次加载后都会回写一次标准化结果，顺手完成旧设置纠偏。
export const loadSettings = (): SettingsModel => {
  ensureRuleMigration()

  const parsed = parseJsonWithFallback(readRaw(SETTINGS_KEY), defaultSettings)
  const normalized = normalizeSettings(parsed)

  writeRaw(SETTINGS_KEY, JSON.stringify(normalized))
  return normalized
}

// 保存前先做一次 normalize，避免调用方传入半旧版结构。
export const saveSettings = (settings: SettingsModel): void => {
  const normalized = normalizeSettings(settings)
  writeRaw(SETTINGS_KEY, JSON.stringify(normalized))
}

// 本地榜单读取后会裁剪到最近 50 条，避免历史垃圾数据无限膨胀。
export const loadLeaderboard = (): LeaderboardEntry[] => {
  ensureRuleMigration()

  const parsed = parseJsonWithFallback<unknown[]>(readRaw(LEADERBOARD_KEY), [])

  const normalized = Array.isArray(parsed)
    ? parsed.map(normalizeEntry).filter((entry): entry is LeaderboardEntry => Boolean(entry))
    : []

  const limited = normalized.slice(-50)
  writeRaw(LEADERBOARD_KEY, JSON.stringify(limited))

  return limited
}

// 写入接口同样带截断，保证任意调用路径都不会突破上限。
export const saveLeaderboard = (entries: LeaderboardEntry[]): void => {
  writeRaw(LEADERBOARD_KEY, JSON.stringify(entries.slice(-50)))
}

// add 接口返回新数组，方便调用方在状态层直接复用结果。
export const addLeaderboardEntry = (
  currentEntries: LeaderboardEntry[],
  nextEntry: LeaderboardEntry,
): LeaderboardEntry[] => {
  const next = [...currentEntries, nextEntry].slice(-50)
  saveLeaderboard(next)
  return next
}

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

export const createLeaderboardEntry = (
  stats: SessionStats,
  inputType: InputSource,
): LeaderboardEntry => {
  return {
    // 优先用原生 UUID，测试或旧环境再退回时间戳 + 随机串。
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

// 排行榜只展示前十，保持与模态框的固定容量一致。
export const selectTopEntries = (entries: LeaderboardEntry[]): LeaderboardEntry[] => {
  return sortLeaderboardEntries(entries).slice(0, 10)
}

// 最近成绩按创建时间倒序返回，方便在首页或历史摘要中直接使用。
export const selectRecentEntries = (entries: LeaderboardEntry[]): LeaderboardEntry[] => {
  return [...entries].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)
}

export const __resetRuleMigrationForTests = (): void => {
  hasEnsuredRuleMigration = false
}
