/**
 * 平台分桶索引。
 * 用较粗粒度的 y 桶快速筛出“可能相关的平台”，降低热路径扫描成本。
 */
import type { PlatformRuntimeEntry } from './platformRuntime'

export const DEFAULT_PLATFORM_BUCKET_HEIGHT = 192

export type PlatformBucketIndex = {
  bucketHeight: number
  buckets: Map<number, PlatformRuntimeEntry[]>
}

// y 方向使用粗粒度桶即可满足筛选需求，不追求像素级精确索引。
const resolveBucketId = (bucketHeight: number, y: number): number =>
  Math.floor(y / bucketHeight)

export const createPlatformBucketIndex = (
  bucketHeight = DEFAULT_PLATFORM_BUCKET_HEIGHT,
): PlatformBucketIndex => ({
  bucketHeight,
  buckets: new Map<number, PlatformRuntimeEntry[]>(),
})

// 平台注册时顺手记录 bucketId / bucketSlot，后续删除可 O(1) 交换尾元素。
export const registerPlatformBucketEntry = (
  index: PlatformBucketIndex,
  entry: PlatformRuntimeEntry,
  y: number,
): void => {
  const bucketId = resolveBucketId(index.bucketHeight, y)
  const bucket = index.buckets.get(bucketId) ?? []

  if (bucket.length === 0) {
    index.buckets.set(bucketId, bucket)
  }

  entry.bucketId = bucketId
  entry.bucketSlot = bucket.length
  bucket.push(entry)
}

// 删除时采用 swap-remove，避免数组中间删除带来的移动成本。
export const unregisterPlatformBucketEntry = (
  index: PlatformBucketIndex,
  entry: PlatformRuntimeEntry,
): void => {
  const bucket = index.buckets.get(entry.bucketId)
  if (!bucket) {
    return
  }

  const lastEntry = bucket[bucket.length - 1]
  bucket.pop()

  if (lastEntry && lastEntry !== entry) {
    lastEntry.bucketSlot = entry.bucketSlot
    bucket[entry.bucketSlot] = lastEntry
  }

  if (bucket.length === 0) {
    index.buckets.delete(entry.bucketId)
  }
}

// 查询阶段把命中的桶直接写入 scratch，减少热路径临时数组分配。
export const collectPlatformBucketEntriesInRange = (
  index: PlatformBucketIndex,
  minY: number,
  maxY: number,
  scratch: PlatformRuntimeEntry[],
): PlatformRuntimeEntry[] => {
  scratch.length = 0

  const fromBucket = resolveBucketId(index.bucketHeight, minY)
  const toBucket = resolveBucketId(index.bucketHeight, maxY)

  for (let bucketId = fromBucket; bucketId <= toBucket; bucketId += 1) {
    const bucket = index.buckets.get(bucketId)
    if (!bucket) {
      continue
    }

    scratch.push(...bucket)
  }

  return scratch
}
