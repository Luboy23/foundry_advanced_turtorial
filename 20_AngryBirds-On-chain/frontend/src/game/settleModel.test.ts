import { describe, expect, it } from 'vitest'
import { computeGroundedSettleState } from './settleModel'

describe('computeGroundedSettleState', () => {
  it('boosts damping before freezing a grounded low-energy piece', () => {
    const boosted = computeGroundedSettleState({
      previousLowEnergyMs: 150,
      deltaMs: 30,
      bottomY: 684,
      groundSurfaceY: 682,
      linearSpeed: 1.1,
      angularSpeed: 0.8,
    })
    const frozen = computeGroundedSettleState({
      previousLowEnergyMs: 340,
      deltaMs: 20,
      bottomY: 684,
      groundSurfaceY: 682,
      linearSpeed: 0.7,
      angularSpeed: 0.4,
    })

    expect(boosted.shouldBoost).toBe(true)
    expect(boosted.shouldFreeze).toBe(false)
    expect(frozen.shouldFreeze).toBe(true)
    expect(frozen.isActivelyRolling).toBe(false)
  })

  it('resets low-energy tracking for airborne or clearly fast pieces', () => {
    const airborne = computeGroundedSettleState({
      previousLowEnergyMs: 240,
      deltaMs: 16,
      bottomY: 620,
      groundSurfaceY: 682,
      linearSpeed: 0.4,
      angularSpeed: 0.2,
    })
    const fastRolling = computeGroundedSettleState({
      previousLowEnergyMs: 240,
      deltaMs: 16,
      bottomY: 684,
      groundSurfaceY: 682,
      linearSpeed: 3.6,
      angularSpeed: 2.1,
    })

    expect(airborne.lowEnergyMs).toBe(0)
    expect(airborne.shouldBoost).toBe(false)
    expect(fastRolling.lowEnergyMs).toBe(0)
    expect(fastRolling.isActivelyRolling).toBe(true)
  })
})
