import { describe, expect, it } from 'vitest'
import { getHazardDodgeScore } from './scoring'

describe('getHazardDodgeScore', () => {
  it('returns 1 for spike and 2 for boulder', () => {
    // 断言：计分规则保持“尖刺=1，巨石=2”的固定权重。
    expect(getHazardDodgeScore('spike')).toBe(1)
    expect(getHazardDodgeScore('boulder')).toBe(2)
  })
})
