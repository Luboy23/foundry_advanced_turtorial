import { describe, expect, it } from 'vitest'
import {
  MAX_DRY_ROWS,
  RESCUE_DOUBLE_PLATFORM_COOLDOWN_ROWS,
  RESCUE_PLATFORM_EDGE_GAP_TARGET_MAX_PX,
  RESCUE_PLATFORM_EDGE_GAP_TARGET_MIN_PX,
  createReachabilityState,
  planSpawnRow,
  resolveReachableWindow,
} from './platformPathPlanner'

// 测试统一世界参数：与 GameScene 常量保持一致，避免伪参数导致误判。
const WORLD_MIN_X = 92
const WORLD_MAX_X = 1280 - 92
const PLAYER_SPEED = 480
const PLAYER_GRAVITY_Y = 1900
const STABLE_WIDTH = 220

// 基于给定中心点创建可达状态基线。
const createState = (x: number, y: number) =>
  createReachabilityState({
    y,
    minCenterX: x,
    maxCenterX: x,
  })

// 构造标准候选平台输入，降低用例样板代码噪音。
const createCandidate = (x: number, y: number) => ({
  x,
  width: STABLE_WIDTH,
  type: 'stable' as const,
  minX: WORLD_MIN_X,
  maxX: WORLD_MAX_X,
  y,
})

/**
 * 封装计划函数，统一测试默认参数。
 * 默认每行最多 2 平台，并支持注入 recentSpawnXs 历史。
 */
const planRow = (input: {
  state: ReturnType<typeof createState>
  x: number
  y: number
  maxPlatformsForRow?: number
  recentSpawnXs?: number[]
}) =>
  planSpawnRow({
    y: input.y,
    currentState: input.state,
    normalCandidate: createCandidate(input.x, input.y),
    stableWidth: STABLE_WIDTH,
    stableMinX: WORLD_MIN_X,
    stableMaxX: WORLD_MAX_X,
    maxPlatformsForRow: input.maxPlatformsForRow ?? 2,
    playerSpeed: PLAYER_SPEED,
    gravityY: PLAYER_GRAVITY_Y,
    worldMinX: WORLD_MIN_X,
    worldMaxX: WORLD_MAX_X,
    recentSpawnXs: input.recentSpawnXs ?? [],
  })

// 计算两平台边缘间隙（不是中心距），用于断言 rescue 双平台合法区间。
const resolveEdgeGap = (
  leftPlatform: { x: number; width: number },
  rightPlatform: { x: number; width: number },
): number =>
  Math.abs(rightPlatform.x - leftPlatform.x) -
  (leftPlatform.width + rightPlatform.width) * 0.5

describe('platformPathPlanner', () => {
  // 场景：极端左右摇摆候选下，禁止连续两行 dry，确保基本可玩性。
  it('never produces two consecutive dry rows under extreme candidate swings', () => {
    const rows = [256, 486, 716, 946, 1176, 1406]
    const xs = [1080, 180, 1080, 180, 1080, 180]
    let state = createState(640, 176)
    let previousMode: 'normal' | 'dry' | 'rescue' | null = null

    for (let index = 0; index < rows.length; index += 1) {
      const plan = planRow({
        state,
        x: xs[index]!,
        y: rows[index]!,
        recentSpawnXs: index > 0 ? [xs[index - 1]!] : [],
      })

      expect(!(previousMode === 'dry' && plan.mode === 'dry')).toBe(true)
      state = plan.nextState
      previousMode = plan.mode
    }
  })

  // 场景：只有 dryRowCount 达到预算上限后才允许触发 rescue。
  it('triggers a rescue row only after the dry-row budget is exhausted', () => {
    const dryPlan = planRow({
      state: createState(640, 176),
      x: 1080,
      y: 256,
    })

    expect(dryPlan.mode).toBe('dry')
    expect(dryPlan.nextState.dryRowCount).toBe(MAX_DRY_ROWS)

    const rescuePlan = planRow({
      state: dryPlan.nextState,
      x: 180,
      y: 486,
      recentSpawnXs: [1080],
    })

    expect(rescuePlan.mode).toBe('rescue')
    expect(rescuePlan.nextState.dryRowCount).toBe(0)
    expect(rescuePlan.nextState.rescueCooldownRows).toBe(
      RESCUE_DOUBLE_PLATFORM_COOLDOWN_ROWS,
    )
  })

  // 场景：rescue 行至少保留一个 guaranteed 平台，且必须位于可达窗口内。
  it('keeps at least one rescue platform inside the reachable window and forces stable type', () => {
    const state = createState(640, 176)
    const dryPlan = planRow({
      state,
      x: 1080,
      y: 256,
    })
    const rescuePlan = planRow({
      state: dryPlan.nextState,
      x: 180,
      y: 486,
      recentSpawnXs: [1080],
    })

    expect(rescuePlan.mode).toBe('rescue')
    expect(rescuePlan.platforms.length).toBeGreaterThanOrEqual(1)
    expect(rescuePlan.platforms.every((platform) => platform.type === 'stable')).toBe(true)

    const reachableWindow = rescuePlan.reachableWindow
    expect(reachableWindow).not.toBeNull()
    const guaranteedPlatform = rescuePlan.platforms.find((platform) => platform.guaranteed)
    expect(guaranteedPlatform).toBeDefined()
    expect(guaranteedPlatform!.x).toBeGreaterThanOrEqual(reachableWindow!.minCenterX)
    expect(guaranteedPlatform!.x).toBeLessThanOrEqual(reachableWindow!.maxCenterX)

    if (rescuePlan.platforms.length === 2) {
      const edgeGap = resolveEdgeGap(
        rescuePlan.platforms[0]!,
        rescuePlan.platforms[1]!,
      )
      expect(edgeGap).toBeGreaterThanOrEqual(
        RESCUE_PLATFORM_EDGE_GAP_TARGET_MIN_PX,
      )
      expect(edgeGap).toBeLessThanOrEqual(
        RESCUE_PLATFORM_EDGE_GAP_TARGET_MAX_PX,
      )
    }
  })

  // 场景：靠近世界边界时仍应产生合法 rescue 结果，不得越界或重叠。
  it('produces legal rescue placements near world boundaries without overlap', () => {
    const leftEdgeState = createState(WORLD_MIN_X + 10, 176)
    const dryPlan = planRow({
      state: leftEdgeState,
      x: WORLD_MAX_X,
      y: 256,
    })
    const rescuePlan = planRow({
      state: dryPlan.nextState,
      x: WORLD_MAX_X,
      y: 486,
      recentSpawnXs: [WORLD_MAX_X],
    })

    expect(rescuePlan.mode).toBe('rescue')
    expect(rescuePlan.platforms[0]!.x).toBeGreaterThanOrEqual(WORLD_MIN_X)
    expect(rescuePlan.platforms[0]!.x).toBeLessThanOrEqual(WORLD_MAX_X)

    if (rescuePlan.platforms.length === 2) {
      const [first, second] = rescuePlan.platforms
      const edgeGap = resolveEdgeGap(first, second)

      expect(second.x).toBeGreaterThanOrEqual(WORLD_MIN_X)
      expect(second.x).toBeLessThanOrEqual(WORLD_MAX_X)
      expect(edgeGap).toBeGreaterThanOrEqual(
        RESCUE_PLATFORM_EDGE_GAP_TARGET_MIN_PX,
      )
      expect(edgeGap).toBeLessThanOrEqual(
        RESCUE_PLATFORM_EDGE_GAP_TARGET_MAX_PX,
      )
    }
  })

  // 场景：当行预算为 1，rescue 退化为单 guaranteed 平台。
  it('falls back to a single guaranteed rescue platform when row budget is one', () => {
    const dryPlan = planRow({
      state: createState(640, 176),
      x: 1080,
      y: 256,
    })
    const rescuePlan = planRow({
      state: dryPlan.nextState,
      x: 180,
      y: 486,
      maxPlatformsForRow: 1,
      recentSpawnXs: [1080],
    })

    expect(rescuePlan.mode).toBe('rescue')
    expect(rescuePlan.platforms).toHaveLength(1)
    expect(rescuePlan.platforms[0]).toMatchObject({
      type: 'stable',
      guaranteed: true,
    })
  })

  // 场景：目标间隙带无法容纳双平台时，应自动回退到单平台 rescue。
  it('falls back to a single rescue platform when the target gap band cannot fit', () => {
    const constrainedPlan = planSpawnRow({
      y: 486,
      currentState: {
        ...createState(240, 176),
        dryRowCount: MAX_DRY_ROWS,
      },
      normalCandidate: {
        x: 760,
        width: STABLE_WIDTH,
        type: 'stable',
        minX: 200,
        maxX: 760,
      },
      stableWidth: STABLE_WIDTH,
      stableMinX: 200,
      stableMaxX: 760,
      maxPlatformsForRow: 2,
      playerSpeed: PLAYER_SPEED,
      gravityY: PLAYER_GRAVITY_Y,
      worldMinX: 200,
      worldMaxX: 760,
      recentSpawnXs: [720],
    })

    expect(constrainedPlan.mode).toBe('rescue')
    expect(constrainedPlan.platforms).toHaveLength(1)
  })

  // 场景：rescue 冷却未结束时，后续 rescue 行必须限制为单平台。
  it('keeps rescue rows to a single platform while cooldown is active', () => {
    const firstDryPlan = planRow({
      state: createState(640, 176),
      x: 1080,
      y: 256,
    })
    const dualRescuePlan = planRow({
      state: firstDryPlan.nextState,
      x: 180,
      y: 486,
      recentSpawnXs: [1080],
    })
    const cooldownDryPlan = planRow({
      state: dualRescuePlan.nextState,
      x: 1080,
      y: 716,
      recentSpawnXs: [180],
    })
    const singleRescuePlan = planRow({
      state: cooldownDryPlan.nextState,
      x: 1080,
      y: 946,
      recentSpawnXs: [1080],
    })

    expect(dualRescuePlan.platforms).toHaveLength(2)
    expect(singleRescuePlan.mode).toBe('rescue')
    expect(singleRescuePlan.platforms).toHaveLength(1)
    expect(singleRescuePlan.nextState.rescueCooldownRows).toBeGreaterThan(0)
  })

  // 场景：冷却行数消耗完后，允许恢复双平台 rescue 能力。
  it('allows dual-platform rescue again after cooldown rows are consumed', () => {
    const firstDryPlan = planRow({
      state: createState(640, 176),
      x: 1080,
      y: 256,
    })
    const dualRescuePlan = planRow({
      state: firstDryPlan.nextState,
      x: 180,
      y: 486,
      recentSpawnXs: [1080],
    })

    let state = dualRescuePlan.nextState
    const normalRowYs = [716, 946, 1176]
    for (const y of normalRowYs) {
      const guaranteedWindow = state.guaranteedWindow
      expect(guaranteedWindow).not.toBeNull()
      const guaranteedCenterX =
        (guaranteedWindow!.minCenterX + guaranteedWindow!.maxCenterX) * 0.5
      const nextPlan = planRow({
        state,
        x: guaranteedCenterX,
        y,
        recentSpawnXs: [guaranteedCenterX],
      })
      expect(nextPlan.mode).toBe('normal')
      state = nextPlan.nextState
    }

    expect(state.rescueCooldownRows).toBe(0)

    const dryPlan = planRow({
      state,
      x: 1080,
      y: 1406,
      recentSpawnXs: [1080],
    })
    const renewedDualRescuePlan = planRow({
      state: dryPlan.nextState,
      x: 1080,
      y: 1636,
      recentSpawnXs: [1080],
    })

    expect(renewedDualRescuePlan.mode).toBe('rescue')
    expect(renewedDualRescuePlan.platforms).toHaveLength(2)
  })

  // 场景：随落距增加，可达窗口横向范围应相应扩张。
  it('expands the reachable window based on fall distance from the last guaranteed row', () => {
    const window = resolveReachableWindow({
      state: createState(640, 176),
      targetY: 486,
      playerSpeed: PLAYER_SPEED,
      gravityY: PLAYER_GRAVITY_Y,
      worldMinX: WORLD_MIN_X,
      worldMaxX: WORLD_MAX_X,
    })

    expect(window).not.toBeNull()
    expect(window!.minCenterX).toBeLessThan(640)
    expect(window!.maxCenterX).toBeGreaterThan(640)
  })
})
