import { describe, expect, it } from 'vitest'
import { resolveHazardExitReason } from './hazardBounds'

describe('resolveHazardExitReason', () => {
  it('returns bottom when hazard crosses bottom limit', () => {
    // 场景：障碍物越过底部死亡线，退出原因应标记为 bottom。
    expect(resolveHazardExitReason(400, 796, 40, 35)).toBe('bottom')
  })

  it('returns side when hazard exits left or right limits', () => {
    // 场景：障碍物从左右侧越界，退出原因统一为 side。
    expect(resolveHazardExitReason(-200, 120, 40, 35)).toBe('side')
    expect(resolveHazardExitReason(1500, 120, 40, 35)).toBe('side')
  })

  it('returns none when hazard remains within limits', () => {
    // 场景：仍在有效边界内时，不应触发退出判定。
    expect(resolveHazardExitReason(640, 300, 40, 35)).toBe('none')
  })
})
