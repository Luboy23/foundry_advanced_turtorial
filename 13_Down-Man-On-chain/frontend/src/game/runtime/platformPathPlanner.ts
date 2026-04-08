/**
 * 平台路径规划器。
 * 输入一行的普通候选平台和上一条可达窗口，输出 normal / dry / rescue 的生成计划。
 */
import { clamp } from '../../shared/utils/math'
import type { PlatformRuntimeType } from './platformRuntime'

export type ReachableWindow = {
  y: number
  minCenterX: number
  maxCenterX: number
}

// 规划器跨行保存的状态很少，只保留“上一次保底窗口”和救援节奏控制。
export type ReachabilityState = {
  guaranteedWindow: ReachableWindow | null
  dryRowCount: number
  rescueCooldownRows: number
}

// guaranteed 表示该平台承担“至少给玩家一条解”的职责。
export type PlannedPlatformSpawn = {
  x: number
  width: number
  type: PlatformRuntimeType
  guaranteed: boolean
}

// mode 用来区分正常行、允许空档行和触发保底的救援行。
export type SpawnRowPlan = {
  mode: 'normal' | 'dry' | 'rescue'
  platforms: PlannedPlatformSpawn[]
  reachableWindow: ReachableWindow | null
  nextState: ReachabilityState
}

type PlatformCandidate = {
  x: number
  width: number
  type: PlatformRuntimeType
  minX: number
  maxX: number
}

type PlatformWindow = {
  minCenterX: number
  maxCenterX: number
}

type Side = 'left' | 'right'

const REACHABILITY_HORIZONTAL_SAFETY = 0.78

// 允许最多连续一行没有保底落点；双平台救援还要满足视觉间距与冷却约束。
export const MAX_DRY_ROWS = 1
export const RESCUE_PLATFORM_EDGE_GAP_TARGET_MIN_PX = 96
export const RESCUE_PLATFORM_EDGE_GAP_TARGET_MAX_PX = 180
export const RESCUE_DOUBLE_PLATFORM_COOLDOWN_ROWS = 3

export const createReachabilityState = (
  guaranteedWindow: ReachableWindow | null,
): ReachabilityState => ({
  guaranteedWindow,
  dryRowCount: 0,
  rescueCooldownRows: 0,
})

// 这里用自由落体近似估算“到下一行前最多能横移多远”。
const resolveFallTimeSec = (verticalDistancePx: number, gravityY: number): number => {
  if (verticalDistancePx <= 0 || gravityY <= 0) {
    return 0
  }

  return Math.sqrt((2 * verticalDistancePx) / gravityY)
}

// 统一把平台转成中心点窗口，便于与 reachable window 做区间求交。
const resolvePlatformWindow = (platform: {
  x: number
  width: number
}): PlatformWindow => ({
  minCenterX: platform.x - platform.width * 0.5,
  maxCenterX: platform.x + platform.width * 0.5,
})

// 只要两个水平窗口存在交集，就认为该平台链路理论上可接上。
const intersectsWindow = (
  left: PlatformWindow,
  right: PlatformWindow | ReachableWindow,
): boolean =>
  left.minCenterX <= right.maxCenterX && left.maxCenterX >= right.minCenterX

// 多个平台都可达时，把窗口合并成更宽的下一行保底范围。
const mergeWindows = (
  current: ReachableWindow | null,
  next: ReachableWindow,
): ReachableWindow => {
  if (!current) {
    return next
  }

  return {
    y: next.y,
    minCenterX: Math.min(current.minCenterX, next.minCenterX),
    maxCenterX: Math.max(current.maxCenterX, next.maxCenterX),
  }
}

// 这里只做保守近似：宁可多触发救援，也不把实际无解误判成可达。
export const resolveReachableWindow = (params: {
  state: ReachabilityState
  targetY: number
  playerSpeed: number
  gravityY: number
  worldMinX: number
  worldMaxX: number
}): ReachableWindow | null => {
  const sourceWindow = params.state.guaranteedWindow
  if (!sourceWindow) {
    return null
  }

  const verticalDistancePx = Math.max(0, params.targetY - sourceWindow.y)
  const horizontalReachPx =
    params.playerSpeed *
    resolveFallTimeSec(verticalDistancePx, params.gravityY) *
    REACHABILITY_HORIZONTAL_SAFETY

  return {
    y: params.targetY,
    minCenterX: clamp(
      sourceWindow.minCenterX - horizontalReachPx,
      params.worldMinX,
      params.worldMaxX,
    ),
    maxCenterX: clamp(
      sourceWindow.maxCenterX + horizontalReachPx,
      params.worldMinX,
      params.worldMaxX,
    ),
  }
}

// 主救援平台必须尽量落在可达区间内，保证这一行重新接回“可解链路”。
const resolveRescuePrimaryX = (params: {
  reachableWindow: ReachableWindow
  stableWidth: number
  stableMinX: number
  stableMaxX: number
  preferredX: number
}): number => {
  const primaryMinX = Math.max(params.stableMinX, params.reachableWindow.minCenterX)
  const primaryMaxX = Math.min(params.stableMaxX, params.reachableWindow.maxCenterX)

  if (primaryMinX <= primaryMaxX) {
    return clamp(params.preferredX, primaryMinX, primaryMaxX)
  }

  return clamp(params.preferredX, params.stableMinX, params.stableMaxX)
}

// 次平台优先放在与主平台相反的一侧，维持视觉上的横向展开。
const resolvePreferredSecondarySide = (params: {
  normalCandidateX: number
  primaryX: number
  recentSpawnXs: number[]
  stableMinX: number
  stableMaxX: number
}): Side => {
  if (params.normalCandidateX < params.primaryX) {
    return 'left'
  }
  if (params.normalCandidateX > params.primaryX) {
    return 'right'
  }

  const latestX = params.recentSpawnXs[params.recentSpawnXs.length - 1]
  if (typeof latestX === 'number') {
    return latestX <= params.primaryX ? 'right' : 'left'
  }

  const leftRoom = params.primaryX - params.stableMinX
  const rightRoom = params.stableMaxX - params.primaryX
  return rightRoom >= leftRoom ? 'right' : 'left'
}

// 次平台不是只要不重叠就行，而是必须落进目标边缘间距带。
const resolveSecondaryValidCenterRange = (params: {
  side: Side
  primaryX: number
  stableWidth: number
  stableMinX: number
  stableMaxX: number
}): { minX: number; maxX: number } | null => {
  const centerMinGapPx =
    params.stableWidth + RESCUE_PLATFORM_EDGE_GAP_TARGET_MIN_PX
  const centerMaxGapPx =
    params.stableWidth + RESCUE_PLATFORM_EDGE_GAP_TARGET_MAX_PX

  if (params.side === 'right') {
    const minX = Math.max(params.stableMinX, params.primaryX + centerMinGapPx)
    const maxX = Math.min(params.stableMaxX, params.primaryX + centerMaxGapPx)
    return minX <= maxX ? { minX, maxX } : null
  }

  const minX = Math.max(params.stableMinX, params.primaryX - centerMaxGapPx)
  const maxX = Math.min(params.stableMaxX, params.primaryX - centerMinGapPx)
  return minX <= maxX ? { minX, maxX } : null
}

// 若首选侧落不进目标间距带，会交给上层尝试另一侧或退化为单平台。
const resolveSecondaryXOnSide = (params: {
  side: Side
  primaryX: number
  normalCandidateX: number
  stableWidth: number
  stableMinX: number
  stableMaxX: number
}): number | null => {
  const validRange = resolveSecondaryValidCenterRange({
    side: params.side,
    primaryX: params.primaryX,
    stableWidth: params.stableWidth,
    stableMinX: params.stableMinX,
    stableMaxX: params.stableMaxX,
  })
  if (!validRange) {
    return null
  }

  return clamp(params.normalCandidateX, validRange.minX, validRange.maxX)
}

// 救援双平台只在满足间距和边界约束时存在，否则直接回落到单平台保底。
const resolveSecondaryRescueX = (params: {
  primaryX: number
  normalCandidateX: number
  stableWidth: number
  stableMinX: number
  stableMaxX: number
  recentSpawnXs: number[]
}): number | null => {
  const preferredSide = resolvePreferredSecondarySide({
    normalCandidateX: params.normalCandidateX,
    primaryX: params.primaryX,
    recentSpawnXs: params.recentSpawnXs,
    stableMinX: params.stableMinX,
    stableMaxX: params.stableMaxX,
  })

  const preferredX = resolveSecondaryXOnSide({
    side: preferredSide,
    primaryX: params.primaryX,
    normalCandidateX: params.normalCandidateX,
    stableWidth: params.stableWidth,
    stableMinX: params.stableMinX,
    stableMaxX: params.stableMaxX,
  })
  if (preferredX !== null) {
    return preferredX
  }

  const fallbackSide: Side = preferredSide === 'left' ? 'right' : 'left'
  return resolveSecondaryXOnSide({
    side: fallbackSide,
    primaryX: params.primaryX,
    normalCandidateX: params.normalCandidateX,
    stableWidth: params.stableWidth,
    stableMinX: params.stableMinX,
    stableMaxX: params.stableMaxX,
  })
}

const decrementRescueCooldown = (currentCooldownRows: number): number =>
  Math.max(0, currentCooldownRows - 1)

// 规划结束后统一推进“可达窗口 / dry row / 救援冷却”三组状态。
const resolveNextReachabilityState = (params: {
  currentState: ReachabilityState
  rowY: number
  rowPlatforms: PlannedPlatformSpawn[]
  reachableWindow: ReachableWindow | null
  mode: 'normal' | 'dry' | 'rescue'
}): ReachabilityState => {
  const nextCooldownRows = decrementRescueCooldown(
    params.currentState.rescueCooldownRows,
  )

  if (params.mode === 'dry' || !params.reachableWindow) {
    return {
      guaranteedWindow: params.currentState.guaranteedWindow,
      dryRowCount: params.currentState.dryRowCount + 1,
      rescueCooldownRows: nextCooldownRows,
    }
  }

  let nextGuaranteedWindow: ReachableWindow | null = null
  for (const platform of params.rowPlatforms) {
    if (!platform.guaranteed) {
      continue
    }

    nextGuaranteedWindow = mergeWindows(nextGuaranteedWindow, {
      y: params.rowY,
      ...resolvePlatformWindow(platform),
    })
  }

  if (!nextGuaranteedWindow) {
    return {
      guaranteedWindow: params.currentState.guaranteedWindow,
      dryRowCount: params.currentState.dryRowCount,
      rescueCooldownRows: nextCooldownRows,
    }
  }

  const shouldStartRescueCooldown =
    params.mode === 'rescue' && params.rowPlatforms.length > 1

  return {
    guaranteedWindow: nextGuaranteedWindow,
    dryRowCount: 0,
    rescueCooldownRows: shouldStartRescueCooldown
      ? RESCUE_DOUBLE_PLATFORM_COOLDOWN_ROWS
      : nextCooldownRows,
  }
}

export const planSpawnRow = (params: {
  y: number
  currentState: ReachabilityState
  normalCandidate: PlatformCandidate
  stableWidth: number
  stableMinX: number
  stableMaxX: number
  maxPlatformsForRow: number
  playerSpeed: number
  gravityY: number
  worldMinX: number
  worldMaxX: number
  recentSpawnXs: number[]
}): SpawnRowPlan => {
  const reachableWindow = resolveReachableWindow({
    state: params.currentState,
    targetY: params.y,
    playerSpeed: params.playerSpeed,
    gravityY: params.gravityY,
    worldMinX: params.worldMinX,
    worldMaxX: params.worldMaxX,
  })

  const normalPlatformWindow = resolvePlatformWindow(params.normalCandidate)
  const normalReachable =
    reachableWindow !== null &&
    intersectsWindow(normalPlatformWindow, reachableWindow)

  if (normalReachable) {
    const platforms: PlannedPlatformSpawn[] = [
      {
        ...params.normalCandidate,
        guaranteed: true,
      },
    ]
    return {
      mode: 'normal',
      platforms,
      reachableWindow,
      nextState: resolveNextReachabilityState({
        currentState: params.currentState,
        rowY: params.y,
        rowPlatforms: platforms,
        reachableWindow,
        mode: 'normal',
      }),
    }
  }

  if (
    params.currentState.dryRowCount < MAX_DRY_ROWS ||
    !reachableWindow ||
    params.maxPlatformsForRow <= 0
  ) {
    const platforms: PlannedPlatformSpawn[] =
      params.maxPlatformsForRow > 0
        ? [
            {
              ...params.normalCandidate,
              guaranteed: false,
            },
          ]
        : []

    return {
      mode: 'dry',
      platforms,
      reachableWindow,
      nextState: resolveNextReachabilityState({
        currentState: params.currentState,
        rowY: params.y,
        rowPlatforms: platforms,
        reachableWindow,
        mode: 'dry',
      }),
    }
  }

  const primaryX = resolveRescuePrimaryX({
    reachableWindow,
    stableWidth: params.stableWidth,
    stableMinX: params.stableMinX,
    stableMaxX: params.stableMaxX,
    preferredX: params.normalCandidate.x,
  })
  const rescuePlatforms: PlannedPlatformSpawn[] = [
    {
      x: primaryX,
      width: params.stableWidth,
      type: 'stable',
      guaranteed: true,
    },
  ]

  if (
    params.maxPlatformsForRow > 1 &&
    params.currentState.rescueCooldownRows <= 0
  ) {
    const secondaryX = resolveSecondaryRescueX({
      primaryX,
      normalCandidateX: params.normalCandidate.x,
      stableWidth: params.stableWidth,
      stableMinX: params.stableMinX,
      stableMaxX: params.stableMaxX,
      recentSpawnXs: params.recentSpawnXs,
    })
    if (secondaryX !== null) {
      rescuePlatforms.push({
        x: secondaryX,
        width: params.stableWidth,
        type: 'stable',
        guaranteed: false,
      })
    }
  }

  return {
    mode: 'rescue',
    platforms: rescuePlatforms,
    reachableWindow,
    nextState: resolveNextReachabilityState({
      currentState: params.currentState,
      rowY: params.y,
      rowPlatforms: rescuePlatforms,
      reachableWindow,
      mode: 'rescue',
    }),
  }
}
