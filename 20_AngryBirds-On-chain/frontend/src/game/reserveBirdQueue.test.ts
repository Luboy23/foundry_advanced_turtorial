import { describe, expect, it } from 'vitest'
import { buildReserveBirdSlots } from './reserveBirdQueue'

describe('buildReserveBirdSlots', () => {
  it('places reserve birds in a horizontal line to the left of the slingshot', () => {
    const slots = buildReserveBirdSlots({
      anchorX: 236,
      groundSurfaceY: 682,
      birdQueue: ['red', 'red', 'red', 'red'],
      nextBirdIndex: 1,
    })

    expect(slots).toHaveLength(3)
    expect(slots.every((slot) => slot.x < 236)).toBe(true)
    expect(slots[0]?.x).toBeGreaterThan(slots[1]?.x ?? 0)
    expect(slots[1]?.x).toBeGreaterThan(slots[2]?.x ?? 0)
    expect(new Set(slots.map((slot) => slot.y)).size).toBe(1)
  })

  it('does not duplicate the active bird inside the reserve queue', () => {
    const slots = buildReserveBirdSlots({
      anchorX: 236,
      groundSurfaceY: 682,
      birdQueue: ['red', 'red', 'red', 'red'],
      nextBirdIndex: 2,
    })

    expect(slots).toHaveLength(2)
    expect(slots[0]?.index).toBe(0)
    expect(slots[1]?.index).toBe(1)
  })
})
