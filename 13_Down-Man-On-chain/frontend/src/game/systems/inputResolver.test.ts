import { describe, expect, it } from 'vitest'
import {
  resolveMovementAxisFromSources,
  resolvePointerAxisFromPosition,
} from './inputResolver'

describe('resolveMovementAxisFromSources', () => {
  it('respects fixed touch mode', () => {
    // 前置：输入模式锁定为 touch，最近输入源不应改变优先级。
    expect(
      resolveMovementAxisFromSources({
        inputMode: 'touch',
        recentInputSource: 'keyboard',
        keyboardAxis: 1,
        touchAxis: -1,
        mouseAxis: 1,
      }),
    ).toBe(-1)
  })

  it('respects fixed keyboard mode', () => {
    // 前置：输入模式锁定为 keyboard，应忽略 touch/mouse 轴值。
    expect(
      resolveMovementAxisFromSources({
        inputMode: 'keyboard',
        recentInputSource: 'touch',
        keyboardAxis: 1,
        touchAxis: -1,
        mouseAxis: -1,
      }),
    ).toBe(1)
  })

  it('uses recent source first in auto mode', () => {
    // 前置：auto 模式下最近来源为 mouse，应优先消费 mouseAxis。
    expect(
      resolveMovementAxisFromSources({
        inputMode: 'auto',
        recentInputSource: 'mouse',
        keyboardAxis: 1,
        touchAxis: -1,
        mouseAxis: -1,
      }),
    ).toBe(-1)
  })

  it('falls back when recent source axis is neutral', () => {
    // 前置：最近来源轴值为 0，应该回退到其他非中性输入源。
    expect(
      resolveMovementAxisFromSources({
        inputMode: 'auto',
        recentInputSource: 'mouse',
        keyboardAxis: 0,
        touchAxis: 1,
        mouseAxis: 0,
      }),
    ).toBe(1)
  })
})

describe('resolvePointerAxisFromPosition', () => {
  it('returns 0 inside dead zone', () => {
    // 场景：指针位于死区边界内，应输出中性轴避免误触移动。
    expect(resolvePointerAxisFromPosition(105, 100, 6)).toBe(0)
    expect(resolvePointerAxisFromPosition(95, 100, 6)).toBe(0)
  })

  it('returns -1 / 1 outside dead zone', () => {
    // 场景：指针超过死区，按左右方向映射为离散轴值。
    expect(resolvePointerAxisFromPosition(80, 100, 6)).toBe(-1)
    expect(resolvePointerAxisFromPosition(130, 100, 6)).toBe(1)
  })
})
