import { describe, expect, it } from 'vitest'
import { buildSlingshotRigLayout } from './slingshotLayout'

describe('buildSlingshotRigLayout', () => {
  it('places the band anchors around the resting bird position', () => {
    const layout = buildSlingshotRigLayout(236, 582)

    expect(layout.birdRest.x).toBe(236)
    expect(layout.birdRest.y).toBe(582)
    expect(layout.rearBandAnchor.x).toBeLessThan(layout.birdRest.x)
    expect(layout.frontBandAnchor.x).toBeGreaterThan(layout.birdRest.x)
    expect(layout.idleBandTarget.y).toBeGreaterThanOrEqual(layout.birdRest.y)
    expect(layout.rearStickTopLeft.x).toBeLessThan(layout.birdRest.x)
    expect(layout.rearStickTopLeft.y).toBeLessThan(layout.birdRest.y)
    expect(layout.dragHitRadius).toBeGreaterThanOrEqual(56)
  })

  it('keeps the front stick ahead of the rear stick for layered rendering', () => {
    const layout = buildSlingshotRigLayout(210, 498)

    expect(layout.frontStickTopLeft.x).toBeLessThan(layout.rearStickTopLeft.x)
    expect(layout.frontStickTopLeft.y).toBeLessThan(layout.rearStickTopLeft.y)
    expect(layout.frontBandAnchor.y).toBeLessThanOrEqual(layout.rearBandAnchor.y)
  })
})
