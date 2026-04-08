import { describe, expect, it } from 'vitest'
import {
  HEAVY_LANDING_VELOCITY_Y,
  resolveLandingImpactTier,
} from './landingImpact'

describe('resolveLandingImpactTier', () => {
  it('returns light for low fall speed', () => {
    // 场景：低速落地应触发轻量冲击表现。
    expect(resolveLandingImpactTier(420)).toBe('light')
  })

  it('returns heavy when reaching threshold', () => {
    // 边界：恰好命中阈值时，应归类为 heavy。
    expect(resolveLandingImpactTier(HEAVY_LANDING_VELOCITY_Y)).toBe('heavy')
  })

  it('returns heavy for speed above threshold', () => {
    // 场景：高于阈值的高速坠落保持 heavy 分类。
    expect(resolveLandingImpactTier(HEAVY_LANDING_VELOCITY_Y + 180)).toBe('heavy')
  })

  it('falls back to light for invalid input', () => {
    // 防御：非法数值（NaN）降级到 light，避免传播异常状态。
    expect(resolveLandingImpactTier(Number.NaN)).toBe('light')
  })
})
