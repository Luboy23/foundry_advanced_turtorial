import { describe, expect, it } from 'vitest'
import { computeImpactDamage } from './damageModel'

describe('computeImpactDamage', () => {
  it('ignores all contact damage before the bird is launched', () => {
    expect(
      computeImpactDamage({
        hasLaunchedBird: false,
        sourceKind: 'bird',
        targetEntityType: 'pig',
        maxImpulse: 18,
        relativeSpeed: 12,
      }),
    ).toBe(0)
  })

  it('drops low-energy glancing contacts and ground touches', () => {
    expect(
      computeImpactDamage({
        hasLaunchedBird: true,
        sourceKind: 'ground',
        targetEntityType: 'block',
        maxImpulse: 20,
        relativeSpeed: 8,
      }),
    ).toBe(0)

    expect(
      computeImpactDamage({
        hasLaunchedBird: true,
        sourceKind: 'bird',
        targetEntityType: 'block',
        maxImpulse: 1.4,
        relativeSpeed: 1.9,
      }),
    ).toBe(0)
  })

  it('steps damage up across the 1.5 / 5 / 9 impulse bands', () => {
    const tierOne = computeImpactDamage({
      hasLaunchedBird: true,
      sourceKind: 'bird',
      targetEntityType: 'block',
      maxImpulse: 1.6,
      relativeSpeed: 2.6,
    })
    const tierTwo = computeImpactDamage({
      hasLaunchedBird: true,
      sourceKind: 'bird',
      targetEntityType: 'block',
      maxImpulse: 5.2,
      relativeSpeed: 4.6,
    })
    const tierThree = computeImpactDamage({
      hasLaunchedBird: true,
      sourceKind: 'bird',
      targetEntityType: 'block',
      maxImpulse: 9.3,
      relativeSpeed: 8.4,
    })

    expect(tierOne).toBeGreaterThan(0)
    expect(tierTwo).toBeGreaterThan(tierOne)
    expect(tierThree).toBeGreaterThan(tierTwo)
  })

  it('makes strong direct bird hits matter more for pigs than for blocks', () => {
    const pigDamage = computeImpactDamage({
      hasLaunchedBird: true,
      sourceKind: 'bird',
      targetEntityType: 'pig',
      maxImpulse: 9.2,
      relativeSpeed: 10,
    })
    const blockDamage = computeImpactDamage({
      hasLaunchedBird: true,
      sourceKind: 'bird',
      targetEntityType: 'block',
      maxImpulse: 9.2,
      relativeSpeed: 10,
    })

    expect(pigDamage).toBeGreaterThan(blockDamage)
    expect(pigDamage).toBeGreaterThanOrEqual(10)
    expect(blockDamage).toBeLessThanOrEqual(9)
  })

  it('keeps structure-to-structure transfer damage limited', () => {
    const blockTransferDamage = computeImpactDamage({
      hasLaunchedBird: true,
      sourceKind: 'piece',
      targetEntityType: 'block',
      maxImpulse: 9.1,
      relativeSpeed: 5,
    })

    expect(blockTransferDamage).toBeGreaterThan(0)
    expect(blockTransferDamage).toBeLessThan(5.4)
  })
})
