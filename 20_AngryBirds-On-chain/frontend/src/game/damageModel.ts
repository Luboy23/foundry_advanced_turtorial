import type { LevelPieceEntityType } from './types'

export type DamageSourceKind = 'bird' | 'piece' | 'ground' | 'wall' | 'unknown'

export type DamageProfile = {
  impulseThreshold: number
  speedThreshold: number
  tierOneDamage: number
  tierTwoDamage: number
  tierThreeDamage: number
  tierTwoImpulse: number
  tierThreeImpulse: number
  speedBonusScale: number
  maxDamage: number
}

type CollisionTargetKind = 'pig' | 'block'

export type ComputeImpactDamageInput = {
  hasLaunchedBird: boolean
  sourceKind: DamageSourceKind
  targetEntityType: LevelPieceEntityType
  maxImpulse: number
  relativeSpeed: number
}

const DAMAGE_PROFILES: Record<'bird' | 'piece', Record<CollisionTargetKind, DamageProfile>> = {
  bird: {
    pig: {
      impulseThreshold: 1.5,
      speedThreshold: 2,
      tierOneDamage: 3,
      tierTwoDamage: 7,
      tierThreeDamage: 10.5,
      tierTwoImpulse: 5,
      tierThreeImpulse: 9,
      speedBonusScale: 0.18,
      maxDamage: 12,
    },
    block: {
      impulseThreshold: 1.5,
      speedThreshold: 2.2,
      tierOneDamage: 1.8,
      tierTwoDamage: 4.8,
      tierThreeDamage: 8,
      tierTwoImpulse: 5,
      tierThreeImpulse: 9,
      speedBonusScale: 0.14,
      maxDamage: 9,
    },
  },
  piece: {
    pig: {
      impulseThreshold: 1.5,
      speedThreshold: 1.8,
      tierOneDamage: 1.2,
      tierTwoDamage: 3.8,
      tierThreeDamage: 6.8,
      tierTwoImpulse: 5,
      tierThreeImpulse: 9,
      speedBonusScale: 0.12,
      maxDamage: 7.5,
    },
    block: {
      impulseThreshold: 1.5,
      speedThreshold: 2,
      tierOneDamage: 0.9,
      tierTwoDamage: 2.6,
      tierThreeDamage: 4.8,
      tierTwoImpulse: 5,
      tierThreeImpulse: 9,
      speedBonusScale: 0.09,
      maxDamage: 5.3,
    },
  },
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export const computeImpactDamage = ({
  hasLaunchedBird,
  sourceKind,
  targetEntityType,
  maxImpulse,
  relativeSpeed,
}: ComputeImpactDamageInput) => {
  if (!hasLaunchedBird) {
    return 0
  }

  if (sourceKind !== 'bird' && sourceKind !== 'piece') {
    return 0
  }

  const targetKind: CollisionTargetKind = targetEntityType === 'pig' ? 'pig' : 'block'
  const profile = DAMAGE_PROFILES[sourceKind][targetKind]
  if (maxImpulse < profile.impulseThreshold && relativeSpeed < profile.speedThreshold) {
    return 0
  }

  let damage = profile.tierOneDamage
  if (maxImpulse >= profile.tierTwoImpulse) {
    damage = profile.tierTwoDamage
  }
  if (maxImpulse >= profile.tierThreeImpulse) {
    damage = profile.tierThreeDamage
  }

  damage += Math.max(0, relativeSpeed - profile.speedThreshold) * profile.speedBonusScale

  if (damage <= 0.01) {
    return 0
  }

  return clamp(damage, 0, profile.maxDamage)
}
