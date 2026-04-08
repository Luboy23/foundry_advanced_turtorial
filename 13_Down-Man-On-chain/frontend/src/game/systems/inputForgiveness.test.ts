import { describe, expect, it } from 'vitest'
import {
  bufferAxisInput,
  bufferTouchTarget,
  createEmptyBufferedAxisState,
  createEmptyBufferedTouchTargetState,
  resolveBufferedAxis,
  resolveBufferedTouchTarget,
} from './inputForgiveness'

describe('inputForgiveness', () => {
  it('keeps the latest axis alive for a short grace window', () => {
    // 场景：实时轴值归零后，短暂缓冲期内仍应保留最近一次输入方向。
    const buffered = bufferAxisInput({
      axis: -1,
      source: 'keyboard',
      nowMs: 100,
      bufferMs: 72,
    })

    expect(
      resolveBufferedAxis({
        liveAxis: 0,
        bufferedAxis: buffered,
        nowMs: 160,
      }),
    ).toBe(-1)

    expect(
      resolveBufferedAxis({
        liveAxis: 0,
        bufferedAxis: buffered,
        nowMs: 173,
      }),
    ).toBe(0)
  })

  it('prefers live axis input over buffered fallback', () => {
    // 场景：当实时输入存在时，缓冲输入必须让位，避免“粘键”。
    const buffered = bufferAxisInput({
      axis: -1,
      source: 'keyboard',
      nowMs: 100,
      bufferMs: 72,
    })

    expect(
      resolveBufferedAxis({
        liveAxis: 1,
        bufferedAxis: buffered,
        nowMs: 120,
      }),
    ).toBe(1)

    expect(
      resolveBufferedAxis({
        liveAxis: 0,
        bufferedAxis: createEmptyBufferedAxisState(),
        nowMs: 120,
      }),
    ).toBe(0)
  })

  it('buffers touch follow targets until the grace window expires', () => {
    // 场景：触控目标点短时断流时应平滑延续，超时后再失效。
    const buffered = bufferTouchTarget({
      targetX: 512,
      nowMs: 300,
      bufferMs: 96,
    })

    expect(
      resolveBufferedTouchTarget({
        liveTargetX: null,
        bufferedTouchTarget: buffered,
        nowMs: 360,
      }),
    ).toBe(512)

    expect(
      resolveBufferedTouchTarget({
        liveTargetX: null,
        bufferedTouchTarget: buffered,
        nowMs: 397,
      }),
    ).toBeNull()

    expect(
      resolveBufferedTouchTarget({
        liveTargetX: 640,
        bufferedTouchTarget: createEmptyBufferedTouchTargetState(),
        nowMs: 320,
      }),
    ).toBe(640)
  })
})
