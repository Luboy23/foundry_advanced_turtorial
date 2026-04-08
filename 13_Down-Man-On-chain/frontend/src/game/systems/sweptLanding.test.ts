import { describe, expect, it } from 'vitest'
import {
  resolveSweptLanding,
  type SweptLandingPlatformSnapshot,
  type SweptLandingPlayerSnapshot,
} from './sweptLanding'

/**
 * swept landing 默认参数：
 * 覆盖“速度阈值 + 顶部容差 + 边缘宽限 + late rescue 穿透窗口”等关键判定轴。
 */
const DEFAULT_CONFIG = {
  minVelocityY: 160,
  topTolerancePx: 18,
  crossEpsilonPx: 2,
  edgeForgivenessPx: 8,
  dynamicEdgePerFallPx: 0.045,
  maxDynamicEdgeBonusPx: 24,
  lateRescueMaxPenetrationPx: 64,
  forceLateRescueBonusPx: 42,
}

// 构造玩家快照基线，覆盖“高速下落 + 大位移”主路径。
const createPlayerSnapshot = (
  overrides: Partial<SweptLandingPlayerSnapshot> = {},
): SweptLandingPlayerSnapshot => ({
  velocityY: 980,
  blockedDown: false,
  touchingDown: false,
  prevBottom: 132,
  bottom: 704,
  prevLeft: 420,
  prevRight: 442,
  left: 430,
  right: 452,
  ...overrides,
})

// 构造平台快照基线，默认可用且静止，便于逐场景覆盖单一变量。
const createPlatformSnapshot = (
  overrides: Partial<SweptLandingPlatformSnapshot> = {},
): SweptLandingPlatformSnapshot => ({
  platformId: 9,
  active: true,
  enabled: true,
  top: 672,
  prevLeft: 360,
  prevRight: 560,
  left: 360,
  right: 560,
  ...overrides,
})

describe('resolveSweptLanding', () => {
  // 场景：标准大位移穿越平台顶部，命中 cross 模式落地。
  it('captures large-displacement downward sweep onto a low platform', () => {
    const result = resolveSweptLanding({
      force: false,
      config: DEFAULT_CONFIG,
      player: createPlayerSnapshot(),
      platforms: [createPlatformSnapshot()],
    })

    expect(result).toEqual({
      platformId: 9,
      landingTop: 672,
      mode: 'cross',
    })
  })

  // 场景：平台在本帧有横向位移，仍需按“接触时刻重叠”判定落地。
  it('captures landing when moving platform intersects player at the same contact time', () => {
    const result = resolveSweptLanding({
      force: false,
      config: DEFAULT_CONFIG,
      player: createPlayerSnapshot({
        prevBottom: 160,
        bottom: 720,
        prevLeft: 428,
        prevRight: 450,
        left: 436,
        right: 458,
      }),
      platforms: [
        createPlatformSnapshot({
          platformId: 3,
          top: 680,
          prevLeft: 140,
          prevRight: 280,
          left: 462,
          right: 602,
        }),
      ],
    })

    expect(result).toEqual({
      platformId: 3,
      landingTop: 680,
      mode: 'cross',
    })
  })

  // 场景：上一帧底边略低于平台顶，但仍在顶部容差带内，允许落地救回。
  it('accepts landing when previous bottom is already below platform top but still in top tolerance band', () => {
    const result = resolveSweptLanding({
      force: false,
      config: DEFAULT_CONFIG,
      player: createPlayerSnapshot({
        velocityY: 620,
        prevBottom: 526,
        bottom: 562,
        prevLeft: 420,
        prevRight: 442,
        left: 422,
        right: 444,
      }),
      platforms: [
        createPlatformSnapshot({
          platformId: 41,
          top: 520,
          prevLeft: 360,
          prevRight: 560,
          left: 360,
          right: 560,
        }),
      ],
    })

    expect(result).toEqual({
      platformId: 41,
      landingTop: 520,
      mode: 'cross',
    })
  })

  // 场景：只有 swept union 重叠、接触时刻并不重叠时，必须拒绝误判。
  it('rejects when overlap exists only in swept union but not at contact time', () => {
    const result = resolveSweptLanding({
      force: false,
      config: DEFAULT_CONFIG,
      player: createPlayerSnapshot({
        velocityY: 920,
        prevBottom: 100,
        bottom: 500,
        prevLeft: 430,
        prevRight: 452,
        left: 432,
        right: 454,
      }),
      platforms: [
        createPlatformSnapshot({
          platformId: 11,
          top: 420,
          prevLeft: 240,
          prevRight: 360,
          left: 620,
          right: 740,
        }),
      ],
    })

    expect(result).toBeNull()
  })

  // 场景：cross 失败但当前帧仍浅层穿透平台，触发 late rescue。
  it('allows late rescue when initial contact is missed but current frame still overlaps and is within penetration band', () => {
    const result = resolveSweptLanding({
      force: false,
      config: DEFAULT_CONFIG,
      player: createPlayerSnapshot({
        velocityY: 980,
        prevBottom: 500,
        bottom: 572,
        prevLeft: 220,
        prevRight: 242,
        left: 436,
        right: 458,
      }),
      platforms: [
        createPlatformSnapshot({
          platformId: 26,
          top: 520,
          prevLeft: 360,
          prevRight: 560,
          left: 360,
          right: 560,
        }),
      ],
    })

    expect(result).toEqual({
      platformId: 26,
      landingTop: 520,
      mode: 'late',
    })
  })

  // 场景：玩家与平台 sweep 全程无交集，返回 null。
  it('rejects when player and platform sweeps still do not overlap', () => {
    const result = resolveSweptLanding({
      force: false,
      config: DEFAULT_CONFIG,
      player: createPlayerSnapshot({
        velocityY: 860,
        prevBottom: 120,
        bottom: 640,
        prevLeft: 500,
        prevRight: 522,
        left: 512,
        right: 534,
      }),
      platforms: [
        createPlatformSnapshot({
          platformId: 11,
          top: 620,
          prevLeft: 40,
          prevRight: 140,
          left: 180,
          right: 280,
        }),
      ],
    })

    expect(result).toBeNull()
  })

  // 场景：同一帧跨越多个平台顶边时，应选“最早接触”平台。
  it('picks earliest-contact platform when one frame crosses multiple platform tops', () => {
    const result = resolveSweptLanding({
      force: false,
      config: DEFAULT_CONFIG,
      player: createPlayerSnapshot({
        velocityY: 1020,
        prevBottom: 140,
        bottom: 760,
        prevLeft: 450,
        prevRight: 472,
        left: 448,
        right: 470,
      }),
      platforms: [
        createPlatformSnapshot({
          platformId: 1,
          top: 700,
          prevLeft: 360,
          prevRight: 620,
          left: 360,
          right: 620,
        }),
        createPlatformSnapshot({
          platformId: 2,
          top: 540,
          prevLeft: 360,
          prevRight: 620,
          left: 360,
          right: 620,
        }),
      ],
    })

    expect(result).toEqual({
      platformId: 2,
      landingTop: 540,
      mode: 'cross',
    })
  })

  // 场景：高落差边缘着陆可触发动态边缘宽限，减少误判穿透。
  it('uses dynamic edge forgiveness for high-drop edge landings', () => {
    const result = resolveSweptLanding({
      force: false,
      config: DEFAULT_CONFIG,
      player: createPlayerSnapshot({
        velocityY: 1160,
        prevBottom: 120,
        bottom: 720,
        prevLeft: 416,
        prevRight: 438,
        left: 420,
        right: 442,
      }),
      platforms: [
        createPlatformSnapshot({
          platformId: 16,
          top: 680,
          prevLeft: 170,
          prevRight: 310,
          left: 468,
          right: 608,
        }),
      ],
    })

    expect(result).toEqual({
      platformId: 16,
      landingTop: 680,
      mode: 'cross',
    })
  })

  // 场景：force=true 时，即便速度未达阈值也允许进入救援判定链路。
  it('allows forced rescue even below min downward velocity threshold', () => {
    const baseInput = {
      config: DEFAULT_CONFIG,
      player: createPlayerSnapshot({
        velocityY: 40,
        prevBottom: 498,
        bottom: 530,
        prevLeft: 400,
        prevRight: 422,
        left: 400,
        right: 422,
      }),
      platforms: [
        createPlatformSnapshot({
          platformId: 6,
          top: 520,
          prevLeft: 360,
          prevRight: 520,
          left: 360,
          right: 520,
        }),
      ],
    }

    expect(
      resolveSweptLanding({
        ...baseInput,
        force: false,
      }),
    ).toBeNull()

    const result = resolveSweptLanding({
      ...baseInput,
      force: true,
    })

    expect(result).toEqual({
      platformId: 6,
      landingTop: 520,
      mode: 'cross',
    })
  })

  // 场景：force 模式放宽 late rescue 穿透窗口，覆盖高压补救路径。
  it('expands late rescue penetration window in force mode', () => {
    const baseInput = {
      config: DEFAULT_CONFIG,
      player: createPlayerSnapshot({
        velocityY: 40,
        prevBottom: 540,
        bottom: 612,
        prevLeft: 432,
        prevRight: 454,
        left: 434,
        right: 456,
      }),
      platforms: [
        createPlatformSnapshot({
          platformId: 72,
          top: 520,
          prevLeft: 360,
          prevRight: 560,
          left: 360,
          right: 560,
        }),
      ],
    }

    expect(
      resolveSweptLanding({
        ...baseInput,
        force: false,
      }),
    ).toBeNull()

    const forcedResult = resolveSweptLanding({
      ...baseInput,
      force: true,
    })

    expect(forcedResult).toEqual({
      platformId: 72,
      landingTop: 520,
      mode: 'late',
    })
  })

  // 场景：多个 late 候选并存时，优先选择穿透最小者，顶边回退次之。
  it('chooses late candidate with smallest penetration before top fallback', () => {
    const result = resolveSweptLanding({
      force: false,
      config: DEFAULT_CONFIG,
      player: createPlayerSnapshot({
        velocityY: 920,
        prevBottom: 540,
        bottom: 620,
        prevLeft: 200,
        prevRight: 222,
        left: 440,
        right: 462,
      }),
      platforms: [
        createPlatformSnapshot({
          platformId: 71,
          top: 560,
          prevLeft: 820,
          prevRight: 1020,
          left: 360,
          right: 560,
        }),
        createPlatformSnapshot({
          platformId: 72,
          top: 588,
          prevLeft: 820,
          prevRight: 1020,
          left: 360,
          right: 560,
        }),
      ],
    })

    expect(result).toEqual({
      platformId: 72,
      landingTop: 588,
      mode: 'late',
    })
  })

  // 场景：同帧同时存在 cross 与 late 候选时，cross 优先级更高。
  it('prioritizes cross candidate over late candidate in the same frame', () => {
    const result = resolveSweptLanding({
      force: false,
      config: DEFAULT_CONFIG,
      player: createPlayerSnapshot({
        velocityY: 820,
        prevBottom: 500,
        bottom: 580,
        prevLeft: 430,
        prevRight: 452,
        left: 430,
        right: 452,
      }),
      platforms: [
        createPlatformSnapshot({
          platformId: 31,
          top: 540,
          prevLeft: 360,
          prevRight: 560,
          left: 360,
          right: 560,
        }),
        createPlatformSnapshot({
          platformId: 32,
          top: 520,
          prevLeft: 1200,
          prevRight: 1400,
          left: 360,
          right: 560,
        }),
      ],
    })

    expect(result).toEqual({
      platformId: 31,
      landingTop: 540,
      mode: 'cross',
    })
  })

  // 场景：固定快照压力回放，验证算法在批量样本下结果稳定不抖动。
  it('remains stable across 100 fixed high-drop moving-platform snapshots', () => {
    for (let index = 0; index < 100; index += 1) {
      const top = 560 + (index % 5) * 6
      const result = resolveSweptLanding({
        force: false,
        config: DEFAULT_CONFIG,
        player: createPlayerSnapshot({
          velocityY: 1080,
          prevBottom: 98 + (index % 4),
          bottom: top + 42,
          prevLeft: 432,
          prevRight: 454,
          left: 434,
          right: 456,
        }),
        platforms: [
          createPlatformSnapshot({
            platformId: 88,
            top,
            prevLeft: 120 + (index % 4) * 8,
            prevRight: 260 + (index % 4) * 8,
            left: 456 - (index % 3) * 4,
            right: 596 - (index % 3) * 4,
          }),
        ],
      })

      expect(result).toEqual({
        platformId: 88,
        landingTop: top,
        mode: 'cross',
      })
    }
  })
})
