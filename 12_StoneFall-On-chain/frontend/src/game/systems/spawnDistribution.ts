/**
 * 模块职责：实现障碍物落点分配算法，平衡公平性与压力曲线。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import { clamp } from '../../shared/utils/math'

type RandomFn = () => number

const RECENT_LANES_WINDOW = 6
const HALF_HISTORY_WINDOW = 12
const SAME_LANE_COOLDOWN_MS = 900
const LANE_JITTER_RATIO = 0.18
const PLAYER_CORE_STARVATION_MS = 2400
const PLAYER_RING_STARVATION_MS = 3000
const PLAYER_CORE_WEIGHT_FLOOR = 1.15
const PLAYER_RING_WEIGHT_FLOOR = 0.82

// 统一随机区间工具：所有“随机抖动”都通过该函数生成。
const randomRange = (min: number, max: number, random: RandomFn): number => {
  return min + (max - min) * random()
}

const getLaneCount = (laneCount?: number): number => {
  return Math.max(3, laneCount ?? 9)
}

const getLaneCenter = ({
  laneIndex,
  laneCount,
  minX,
  maxX,
}: {
  laneIndex: number
  laneCount: number
  minX: number
  maxX: number
}): number => {
  const count = getLaneCount(laneCount)
  const laneWidth = (maxX - minX) / count
  return minX + laneWidth * (laneIndex + 0.5)
}

const getLaneSide = (laneIndex: number, laneCount: number): -1 | 0 | 1 => {
  const middle = Math.floor(laneCount / 2)
  if (laneIndex < middle) {
    return -1
  }
  if (laneIndex > middle) {
    return 1
  }
  return 0
}

const weightedPick = (
  values: number[],
  random: RandomFn,
): number => {
  // 经典加权轮盘算法：阈值落入哪一段就选中对应 lane。
  const sum = values.reduce((total, value) => total + value, 0)
  if (sum <= 0) {
    return Math.floor(random() * values.length)
  }

  let threshold = random() * sum
  for (let index = 0; index < values.length; index += 1) {
    threshold -= values[index]
    if (threshold <= 0) {
      return index
    }
  }

  return values.length - 1
}

/**
 * 类型定义：SpawnDistributionState。
 */
export type SpawnDistributionState = {
  laneLastSpawnAtMs: number[]
  recentLanes: number[]
  halfHistory: Array<-1 | 1>
}

/**
 * createSpawnDistributionState：创建并返回新的实例或状态。
 */
export const createSpawnDistributionState = (laneCount = 9): SpawnDistributionState => {
  const count = getLaneCount(laneCount)
  return {
    laneLastSpawnAtMs: Array.from({ length: count }, () => -Number.MAX_SAFE_INTEGER),
    recentLanes: [],
    halfHistory: [],
  }
}

/**
 * 重置分布状态缓存（最近轨道、左右半区历史、轨道时间戳）。
 */
export const resetSpawnDistributionState = (
  state: SpawnDistributionState,
): void => {
  for (let index = 0; index < state.laneLastSpawnAtMs.length; index += 1) {
    state.laneLastSpawnAtMs[index] = -Number.MAX_SAFE_INTEGER
  }
  state.recentLanes = []
  state.halfHistory = []
}

const buildLaneWeights = ({
  state,
  nowMs,
  minX,
  maxX,
  playerX,
  safeRadius,
  threatLevel,
  laneCount,
  excludeLane,
  minLaneDistance,
  preferOppositeOfLane,
}: {
  state: SpawnDistributionState
  nowMs: number
  minX: number
  maxX: number
  playerX: number
  safeRadius: number
  threatLevel: number
  laneCount: number
  excludeLane?: number
  minLaneDistance?: number
  preferOppositeOfLane?: number
}): number[] => {
  // 每条轨道默认基础权重 1，再叠加“防重复、避玩家、左右平衡”等修正因子。
  const weights: number[] = Array.from({ length: laneCount }, () => 1)
  const recentUsageCount = new Map<number, number>()

  for (const lane of state.recentLanes) {
    recentUsageCount.set(lane, (recentUsageCount.get(lane) ?? 0) + 1)
  }

  const leftCount = state.halfHistory.filter((value) => value === -1).length
  const rightCount = state.halfHistory.filter((value) => value === 1).length
  const imbalance = leftCount - rightCount
  const threatNormalized = clamp((threatLevel - 1) / 9, 0, 1)
  const corePenalty = 0.18 + threatNormalized * 0.34
  const ringPenalty = 0.42 + threatNormalized * 0.28

  for (let laneIndex = 0; laneIndex < laneCount; laneIndex += 1) {
    let weight = 1
    const laneCenterX = getLaneCenter({
      laneIndex,
      laneCount,
      minX,
      maxX,
    })
    const distanceToPlayer = Math.abs(laneCenterX - playerX)
    const side = getLaneSide(laneIndex, laneCount)

    const elapsed = nowMs - (state.laneLastSpawnAtMs[laneIndex] ?? -Number.MAX_SAFE_INTEGER)
    if (elapsed < SAME_LANE_COOLDOWN_MS) {
      // 近期刚刷过的轨道显著降权，减少“连发同列”。
      weight *= 0.12
    }

    const repeated = recentUsageCount.get(laneIndex) ?? 0
    if (repeated > 0) {
      weight *= 1 / (1 + repeated * 0.72)
    }

    if (safeRadius > 0) {
      if (distanceToPlayer < safeRadius * 0.55) {
        // 玩家核心区域更强降权，但长时间不刷会触发 starvation floor 回补。
        weight *= corePenalty
        if (elapsed > PLAYER_CORE_STARVATION_MS) {
          const starvationProgress = clamp(
            (elapsed - PLAYER_CORE_STARVATION_MS) / 1800,
            0,
            1,
          )
          weight = Math.max(
            weight,
            PLAYER_CORE_WEIGHT_FLOOR + starvationProgress * 0.55,
          )
        }
      } else if (distanceToPlayer < safeRadius) {
        // 环形安全区降权较轻，同样有 starvation floor 防“永不刷到”。
        weight *= ringPenalty
        if (elapsed > PLAYER_RING_STARVATION_MS) {
          weight = Math.max(weight, PLAYER_RING_WEIGHT_FLOOR)
        }
      }
    }

    if (imbalance >= 2) {
      if (side === -1) {
        weight *= 0.42
      } else if (side === 1) {
        weight *= 1.42
      }
    } else if (imbalance <= -2) {
      if (side === 1) {
        weight *= 0.42
      } else if (side === -1) {
        weight *= 1.42
      }
    }

    if (typeof excludeLane === 'number' && typeof minLaneDistance === 'number') {
      if (Math.abs(laneIndex - excludeLane) < minLaneDistance) {
        // 双发时第二个障碍与第一个保持最小轨道距离。
        weight *= 0.05
      }
    }

    if (typeof preferOppositeOfLane === 'number') {
      const firstSide = getLaneSide(preferOppositeOfLane, laneCount)
      if (firstSide !== 0 && side !== 0) {
        if (side === firstSide) {
          weight *= 0.5
        } else {
          weight *= 1.25
        }
      }
    }

    weights[laneIndex] = weight
  }

  return weights
}

const registerLaneUsage = (
  state: SpawnDistributionState,
  laneIndex: number,
  nowMs: number,
  laneCount: number,
): void => {
  // 记录轨道最近一次刷新时间与短期历史窗口，供下一次权重计算使用。
  state.laneLastSpawnAtMs[laneIndex] = nowMs
  state.recentLanes.push(laneIndex)
  if (state.recentLanes.length > RECENT_LANES_WINDOW) {
    state.recentLanes.shift()
  }

  const side = getLaneSide(laneIndex, laneCount)
  if (side !== 0) {
    state.halfHistory.push(side)
    if (state.halfHistory.length > HALF_HISTORY_WINDOW) {
      state.halfHistory.shift()
    }
  }
}

/**
 * 手动登记某条轨道已被使用（用于外部复用权重模型时的状态同步）。
 */
export const registerSpawnLane = ({
  state,
  laneIndex,
  nowMs,
  laneCount = 9,
}: {
  state: SpawnDistributionState
  laneIndex: number
  nowMs: number
  laneCount?: number
}): void => {
  const count = getLaneCount(laneCount)
  const clampedLane = clamp(laneIndex, 0, count - 1)
  registerLaneUsage(state, clampedLane, nowMs, count)
}

/**
 * 根据权重模型选取本次生成轨道，并写回状态窗口。
 */
export const chooseLane = ({
  state,
  nowMs,
  minX,
  maxX,
  playerX,
  safeRadius,
  threatLevel,
  laneCount = 9,
  excludeLane,
  minLaneDistance,
  preferOppositeOfLane,
  random = Math.random,
}: {
  state: SpawnDistributionState
  nowMs: number
  minX: number
  maxX: number
  playerX: number
  safeRadius: number
  threatLevel: number
  laneCount?: number
  excludeLane?: number
  minLaneDistance?: number
  preferOppositeOfLane?: number
  random?: RandomFn
}): number => {
  const count = getLaneCount(laneCount)
  const weights = buildLaneWeights({
    state,
    nowMs,
    minX,
    maxX,
    playerX,
    safeRadius,
    threatLevel,
    laneCount: count,
    excludeLane,
    minLaneDistance,
    preferOppositeOfLane,
  })
  const laneIndex = weightedPick(weights, random)
  registerLaneUsage(state, laneIndex, nowMs, count)
  return laneIndex
}

/**
 * 将轨道索引映射为最终生成 X 坐标，并叠加 lane 内随机抖动。
 */
export const laneToSpawnX = ({
  laneIndex,
  minX,
  maxX,
  laneCount = 9,
  random = Math.random,
}: {
  laneIndex: number
  minX: number
  maxX: number
  laneCount?: number
  random?: RandomFn
}): number => {
  const count = getLaneCount(laneCount)
  const clampedLaneIndex = clamp(laneIndex, 0, count - 1)
  const laneWidth = (maxX - minX) / count
  const centerX = getLaneCenter({
    laneIndex: clampedLaneIndex,
    laneCount: count,
    minX,
    maxX,
  })
  const jitter = laneWidth * LANE_JITTER_RATIO
  const value = centerX + randomRange(-jitter, jitter, random)
  return Math.round(clamp(value, minX, maxX))
}
