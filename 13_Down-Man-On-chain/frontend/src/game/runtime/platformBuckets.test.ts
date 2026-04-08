import { describe, expect, it } from 'vitest'
import type { PlatformRuntimeData, PlatformRuntimeEntry } from './platformRuntime'
import {
  collectPlatformBucketEntriesInRange,
  createPlatformBucketIndex,
  registerPlatformBucketEntry,
  unregisterPlatformBucketEntry,
} from './platformBuckets'

// 生成默认 runtime data，确保测试聚焦桶索引行为而非平台属性。
const createRuntimeData = (): PlatformRuntimeData => ({
  type: 'stable',
  moveMinX: 0,
  moveMaxX: 0,
  moveSpeed: 0,
  moveDirection: 0,
  vanishingHoldMs: 0,
  broken: false,
  prevLeft: 0,
  prevRight: 0,
})

// 构造最小可写平台条目，便于验证 bucketId / bucketSlot 维护逻辑。
const createEntry = (platformId: number): PlatformRuntimeEntry =>
  ({
    index: platformId,
    bucketId: -1,
    bucketSlot: -1,
    platformId,
    platform: {} as PlatformRuntimeEntry['platform'],
    body: {} as PlatformRuntimeEntry['body'],
    data: createRuntimeData(),
  }) as PlatformRuntimeEntry

describe('platformBuckets', () => {
  it('registers entries into vertical buckets and collects candidate ranges', () => {
    // 场景：按 y 坐标注册后，范围查询应返回相交桶内的候选平台。
    const index = createPlatformBucketIndex(100)
    const scratch: PlatformRuntimeEntry[] = []
    const low = createEntry(1)
    const edge = createEntry(2)
    const high = createEntry(3)

    registerPlatformBucketEntry(index, low, 20)
    registerPlatformBucketEntry(index, edge, 95)
    registerPlatformBucketEntry(index, high, 220)

    const nearby = collectPlatformBucketEntriesInRange(index, 0, 130, scratch)

    // 断言：桶编号正确，查询结果仅包含命中范围的平台。
    expect(low.bucketId).toBe(0)
    expect(edge.bucketId).toBe(0)
    expect(high.bucketId).toBe(2)
    expect(nearby.map((entry) => entry.platformId)).toEqual([1, 2])
  })

  it('compacts bucket slots when unregistering an entry', () => {
    // 场景：移除桶中元素后应执行紧凑化，保持 slot 连续性。
    const index = createPlatformBucketIndex(100)
    const first = createEntry(10)
    const second = createEntry(11)

    registerPlatformBucketEntry(index, first, 30)
    registerPlatformBucketEntry(index, second, 60)
    unregisterPlatformBucketEntry(index, first)

    const bucket = index.buckets.get(0) ?? []

    expect(bucket).toHaveLength(1)
    expect(bucket[0]).toBe(second)
    expect(second.bucketSlot).toBe(0)

    // 最后一个元素移除后，空桶应被删除，避免索引残留。
    unregisterPlatformBucketEntry(index, second)
    expect(index.buckets.has(0)).toBe(false)
  })
})
