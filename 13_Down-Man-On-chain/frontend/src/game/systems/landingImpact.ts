/**
 * 落地冲击等级。
 * 只关心反馈强弱，不直接参与物理计算。
 */
export type LandingImpactTier = 'light' | 'heavy'

export const HEAVY_LANDING_VELOCITY_Y = 980

// 冲击等级只决定镜头/粒子/音效反馈，不会回写到物理世界。
export const resolveLandingImpactTier = (
  maxFallVelocityY: number,
  heavyThreshold: number = HEAVY_LANDING_VELOCITY_Y,
): LandingImpactTier => {
  if (!Number.isFinite(maxFallVelocityY)) {
    return 'light'
  }
  return maxFallVelocityY >= heavyThreshold ? 'heavy' : 'light'
}
