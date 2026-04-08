import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetRuleMigrationForTests,
  addLeaderboardEntry,
  loadLeaderboard,
  loadSettings,
  sortLeaderboardEntries,
} from './localStore'
import {
  LEADERBOARD_KEY,
  LEGACY_LEADERBOARD_KEY,
  LEGACY_LEADERBOARD_KEY_V1,
  RULE_MIGRATION_KEY,
  RULE_VERSION,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_KEY,
  defaultSettings,
  type LeaderboardEntry,
} from './types'

/**
 * 测试专用成绩构造器。
 * 通过固定默认字段减少样例噪音，让断言聚焦在排序、迁移与容错行为。
 */
const makeEntry = (
  id: string,
  score: number,
  survivalMs: number,
  createdAt: number,
): LeaderboardEntry => ({
  id,
  score,
  survivalMs,
  maxDifficulty: 6,
  peakThreatLevel: 8.4,
  createdAt,
  inputType: 'keyboard',
  ruleVersion: 3,
})

describe('localStore', () => {
  beforeEach(() => {
    // 每个用例前清空持久化状态，避免跨用例污染。
    window.localStorage.clear()
    // 重置一次性迁移标记，确保可重复验证迁移逻辑。
    __resetRuleMigrationForTests()
  })

  it('sorts leaderboard by score, then survival, then createdAt ascending', () => {
    // 断言排序优先级：score DESC -> survivalMs DESC -> createdAt ASC。
    const sorted = sortLeaderboardEntries([
      makeEntry('c', 100, 1200, 3),
      makeEntry('a', 100, 1500, 5),
      makeEntry('b', 100, 1500, 4),
      makeEntry('d', 120, 1100, 2),
    ])

    expect(sorted.map((entry) => entry.id)).toEqual(['d', 'b', 'a', 'c'])
  })

  it('keeps only 50 records when adding new entries', () => {
    // 场景：历史已达上限时新增记录，应按规则淘汰最旧低优先记录。
    const initial = Array.from({ length: 50 }, (_, index) =>
      makeEntry(String(index), index, index * 100, index),
    )

    const result = addLeaderboardEntry(initial, makeEntry('new', 999, 9999, 999))

    expect(result).toHaveLength(50)
    expect(result[0].id).toBe('1')
    expect(result.at(-1)?.id).toBe('new')
  })

  it('restores default settings when local json is corrupted', () => {
    // 场景：settings JSON 损坏，loadSettings 应回退默认值并覆写存储。
    window.localStorage.setItem(SETTINGS_KEY, '{invalid-json')

    const settings = loadSettings()

    expect(settings).toEqual(defaultSettings)
    expect(window.localStorage.getItem(SETTINGS_KEY)).toBe(
      JSON.stringify(defaultSettings),
    )
  })

  it('migrates legacy settings to schema v2', () => {
    // 场景：旧 schema 缺字段，读取时应自动补齐并升级版本号。
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        musicEnabled: false,
        sfxEnabled: true,
        language: 'zh-CN',
        bestScore: 88,
        touchControlMode: 'buttons',
      }),
    )

    const settings = loadSettings()

    expect(settings.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION)
    expect(settings.musicEnabled).toBe(false)
    expect(settings.touchControlMode).toBe('buttons')
    expect(settings.dismissPortraitHint).toBe(false)
  })

  it('restores empty leaderboard when local json is corrupted', () => {
    // 场景：排行榜 JSON 破损，读取后应返回空数组并修复本地存储。
    window.localStorage.setItem(LEADERBOARD_KEY, '{invalid-json')

    const entries = loadLeaderboard()

    expect(entries).toEqual([])
    expect(window.localStorage.getItem(LEADERBOARD_KEY)).toBe('[]')
  })

  it('runs one-time migration and clears legacy leaderboard', () => {
    // 场景：存在 v1/v2 历史键与旧设置，触发一次性规则迁移。
    window.localStorage.setItem(
      LEGACY_LEADERBOARD_KEY,
      JSON.stringify([makeEntry('x', 1, 1, 1)]),
    )
    window.localStorage.setItem(
      LEGACY_LEADERBOARD_KEY_V1,
      JSON.stringify([makeEntry('y', 2, 2, 2)]),
    )
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        ...defaultSettings,
        bestScore: 999,
      }),
    )

    const entries = loadLeaderboard()

    expect(entries).toEqual([])
    expect(window.localStorage.getItem(LEGACY_LEADERBOARD_KEY_V1)).toBe('[]')
    expect(window.localStorage.getItem(LEGACY_LEADERBOARD_KEY)).toBe('[]')
    expect(window.localStorage.getItem(LEADERBOARD_KEY)).toBe('[]')
    expect(window.localStorage.getItem(RULE_MIGRATION_KEY)).toBe(String(RULE_VERSION))
    const settings = loadSettings()
    expect(settings.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION)
    expect(settings.dismissPortraitHint).toBe(false)
  })

  it('keeps mouse input records during leaderboard normalization', () => {
    // 场景：标准化过程不应抹掉合法的 mouse 输入类型字段。
    window.localStorage.setItem(
      RULE_MIGRATION_KEY,
      String(RULE_VERSION),
    )
    window.localStorage.setItem(
      LEADERBOARD_KEY,
      JSON.stringify([
        {
          ...makeEntry('mouse-entry', 88, 2400, 7),
          inputType: 'mouse',
        },
      ]),
    )

    const entries = loadLeaderboard()

    expect(entries).toHaveLength(1)
    expect(entries[0].inputType).toBe('mouse')
  })
})
