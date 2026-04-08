import { describe, expect, it } from 'vitest'
import { isTopLandingContact } from './platformLanding'

describe('isTopLandingContact', () => {
  it('accepts regular top-down contact', () => {
    // 场景：常规从上向下接触平台，应判定为有效落地。
    expect(
      isTopLandingContact({
        playerBottom: 208,
        playerPrevBottom: 194,
        platformTop: 200,
        velocityY: 420,
      }),
    ).toBe(true)
  })

  it('accepts high-speed contact when previous frame was above platform', () => {
    // 场景：高速穿透边缘情况下，上一帧在平台上方时仍应救回为有效落地。
    expect(
      isTopLandingContact({
        playerBottom: 236,
        playerPrevBottom: 199,
        platformTop: 200,
        velocityY: 0,
      }),
    ).toBe(true)
  })

  it('rejects side or below contact', () => {
    // 场景：侧面或下方接触不应被误判为“踩到平台顶部”。
    expect(
      isTopLandingContact({
        playerBottom: 234,
        playerPrevBottom: 228,
        platformTop: 200,
        velocityY: 0,
      }),
    ).toBe(false)
  })

  it('rejects upward motion contact', () => {
    // 场景：玩家向上运动时接触平台，应直接判定无效落地。
    expect(
      isTopLandingContact({
        playerBottom: 206,
        playerPrevBottom: 198,
        platformTop: 200,
        velocityY: -80,
      }),
    ).toBe(false)
  })
})
