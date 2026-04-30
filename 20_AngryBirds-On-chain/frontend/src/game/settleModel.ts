export type GroundSettleState = {
  lowEnergyMs: number
  isGrounded: boolean
  shouldBoost: boolean
  shouldFreeze: boolean
  isActivelyRolling: boolean
}

export type ComputeGroundSettleInput = {
  previousLowEnergyMs: number
  deltaMs: number
  bottomY: number
  groundSurfaceY: number
  linearSpeed: number
  angularSpeed: number
}

const GROUND_CONTACT_TOLERANCE_PX = 18
const LOW_ENERGY_LINEAR_SPEED = 1.8
const LOW_ENERGY_ANGULAR_SPEED = 1.9
const BOOST_AFTER_MS = 160
const FREEZE_AFTER_MS = 350
const ACTIVE_ROLL_LINEAR_SPEED = 0.55
const ACTIVE_ROLL_ANGULAR_SPEED = 0.8

export const computeGroundedSettleState = ({
  previousLowEnergyMs,
  deltaMs,
  bottomY,
  groundSurfaceY,
  linearSpeed,
  angularSpeed,
}: ComputeGroundSettleInput): GroundSettleState => {
  const isGrounded = bottomY >= groundSurfaceY - GROUND_CONTACT_TOLERANCE_PX
  const isLowEnergy =
    isGrounded && linearSpeed <= LOW_ENERGY_LINEAR_SPEED && angularSpeed <= LOW_ENERGY_ANGULAR_SPEED
  const lowEnergyMs = isLowEnergy ? previousLowEnergyMs + deltaMs : 0
  const shouldBoost = lowEnergyMs >= BOOST_AFTER_MS
  const shouldFreeze = lowEnergyMs >= FREEZE_AFTER_MS
  const isActivelyRolling =
    isGrounded &&
    !shouldFreeze &&
    (linearSpeed > ACTIVE_ROLL_LINEAR_SPEED || angularSpeed > ACTIVE_ROLL_ANGULAR_SPEED)

  return {
    lowEnergyMs,
    isGrounded,
    shouldBoost,
    shouldFreeze,
    isActivelyRolling,
  }
}
