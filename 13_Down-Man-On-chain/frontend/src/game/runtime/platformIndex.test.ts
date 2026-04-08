import type Phaser from 'phaser'
import { describe, expect, it } from 'vitest'
import {
  buildActivePlatformIndex,
  createEmptyActivePlatformIndex,
} from './platformIndex'

/**
 * 构造最小可用平台桩对象。
 * 只保留索引构建所需字段，避免引入 Phaser 真实依赖。
 */
const createMockPlatform = (input: {
  platformId: number
  platformType?: unknown
  active?: boolean
  enabled?: boolean
}) => {
  const data = new Map<string, unknown>([
    ['platformId', input.platformId],
    ['platformType', input.platformType ?? 'stable'],
  ])

  return {
    active: input.active ?? true,
    body: {
      enable: input.enabled ?? true,
    },
    getData: (key: string) => data.get(key),
  } as unknown as Phaser.Physics.Arcade.Sprite
}

/**
 * 构造平台组桩对象，模拟 group.getChildren 行为。
 */
const createMockGroup = (
  children: Phaser.Physics.Arcade.Sprite[],
): Phaser.Physics.Arcade.Group =>
  ({
    getChildren: () => children as unknown as Phaser.GameObjects.GameObject[],
  }) as unknown as Phaser.Physics.Arcade.Group

describe('platformIndex', () => {
  it('creates an empty index baseline', () => {
    // 场景：空索引工厂应返回无条目、无映射的基线结构。
    const index = createEmptyActivePlatformIndex()
    expect(index.entries).toEqual([])
    expect(index.byId.size).toBe(0)
  })

  it('builds index from active and enabled platforms only', () => {
    // 场景：仅 active 且 body.enable=true 的平台应进入索引。
    const validMoving = createMockPlatform({
      platformId: 101,
      platformType: 'moving',
    })
    const invalidId = createMockPlatform({
      platformId: Number.NaN,
      platformType: 'stable',
    })
    const disabled = createMockPlatform({
      platformId: 102,
      platformType: 'vanishing',
      enabled: false,
    })
    const unknownType = createMockPlatform({
      platformId: 103,
      platformType: 'legacy',
    })

    const index = buildActivePlatformIndex(
      createMockGroup([validMoving, invalidId, disabled, unknownType]),
    )

    // 断言：非法 id/禁用平台被过滤，未知类型回退为 stable。
    expect(index.entries.map((entry) => entry.platformId)).toEqual([101, 103])
    expect(index.byId.has(101)).toBe(true)
    expect(index.byId.has(103)).toBe(true)
    expect(index.byId.has(102)).toBe(false)
    expect(index.byId.get(101)?.type).toBe('moving')
    expect(index.byId.get(103)?.type).toBe('stable')
  })

  it('keeps entry references consistent between entries and byId lookup', () => {
    // 场景：entries 与 byId 必须共享同一对象引用，避免状态双写不一致。
    const platform = createMockPlatform({
      platformId: 404,
      platformType: 'vanishing',
    })
    const index = buildActivePlatformIndex(createMockGroup([platform]))

    expect(index.entries).toHaveLength(1)
    expect(index.byId.get(404)).toBe(index.entries[0])
  })
})
