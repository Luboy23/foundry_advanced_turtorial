/**
 * swept landing 判定。
 * 用上一帧和当前帧的边界快照补足离散碰撞的漏判，解决高速下落和边缘落台问题。
 */
export type SweptLandingPlayerSnapshot = {
  velocityY: number
  blockedDown: boolean
  touchingDown: boolean
  prevBottom: number
  bottom: number
  prevLeft: number
  prevRight: number
  left: number
  right: number
}

// 平台快照同时记录前后帧左右边界，补偿移动平台造成的碰撞漏判。
export type SweptLandingPlatformSnapshot = {
  platformId: number
  active: boolean
  enabled: boolean
  top: number
  prevLeft: number
  prevRight: number
  left: number
  right: number
}

// 这些容错参数决定了 sweep 判定的保守程度，核心目标是“宁救错，不漏判”。
export type SweptLandingConfig = {
  minVelocityY: number
  topTolerancePx: number
  crossEpsilonPx: number
  edgeForgivenessPx: number
  dynamicEdgePerFallPx: number
  maxDynamicEdgeBonusPx: number
  lateRescueMaxPenetrationPx: number
  forceLateRescueBonusPx: number
}

// force 用于极端恢复场景，允许在较宽松的 late rescue 条件下再尝试一次。
export type SweptLandingInput = {
  force: boolean
  player: SweptLandingPlayerSnapshot
  platforms: SweptLandingPlatformSnapshot[]
  config: SweptLandingConfig
}

// mode 用来告诉上层本次落台来自正常穿越判定还是迟到补救。
export type SweptLandingResult = {
  platformId: number
  landingTop: number
  mode: 'cross' | 'late'
}

const CONTACT_TIME_EPSILON = 1e-6

const interpolate = (from: number, to: number, t: number): number => from + (to - from) * t

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

type SweptLandingCandidate = {
  platformId: number
  landingTop: number
  mode: 'cross' | 'late'
  contactT: number
  penetrationPx: number
  rawOverlapPx: number
}

// cross 优先更早接触；同一时刻则优先更高的平台，减少“穿过上层直接踩下层”。
const isBetterCrossCandidate = (
  nextCandidate: SweptLandingCandidate,
  currentCandidate: SweptLandingCandidate | null,
): boolean => {
  if (!currentCandidate) {
    return true
  }

  if (nextCandidate.contactT < currentCandidate.contactT - CONTACT_TIME_EPSILON) {
    return true
  }

  return (
    Math.abs(nextCandidate.contactT - currentCandidate.contactT) <= CONTACT_TIME_EPSILON &&
    nextCandidate.landingTop < currentCandidate.landingTop
  )
}

// late rescue 优先穿透更浅的候选，其次选择水平覆盖更大的平台。
const isBetterLateCandidate = (
  nextCandidate: SweptLandingCandidate,
  currentCandidate: SweptLandingCandidate | null,
): boolean => {
  if (!currentCandidate) {
    return true
  }

  if (nextCandidate.penetrationPx < currentCandidate.penetrationPx - CONTACT_TIME_EPSILON) {
    return true
  }

  if (nextCandidate.penetrationPx > currentCandidate.penetrationPx + CONTACT_TIME_EPSILON) {
    return false
  }

  if (nextCandidate.rawOverlapPx > currentCandidate.rawOverlapPx + CONTACT_TIME_EPSILON) {
    return true
  }

  if (nextCandidate.rawOverlapPx < currentCandidate.rawOverlapPx - CONTACT_TIME_EPSILON) {
    return false
  }

  return nextCandidate.landingTop > currentCandidate.landingTop + CONTACT_TIME_EPSILON
}

// 先尝试严格 cross，再回退到 late rescue，尽量兼顾公平性与手感。
export const resolveSweptLanding = (
  input: SweptLandingInput,
): SweptLandingResult | null => {
  const { force, player, platforms, config } = input
  if (!force && player.velocityY < config.minVelocityY) {
    return null
  }

  const fallDistancePx = player.bottom - player.prevBottom
  if (fallDistancePx <= 0) {
    return null
  }

  const dynamicEdgeBonusPx = Math.min(
    config.maxDynamicEdgeBonusPx,
    Math.max(0, fallDistancePx * config.dynamicEdgePerFallPx),
  )
  const edgeForgivenessPx = config.edgeForgivenessPx + dynamicEdgeBonusPx
  const lateRescuePenetrationPx =
    config.lateRescueMaxPenetrationPx + (force ? config.forceLateRescueBonusPx : 0)

  let bestCrossCandidate: SweptLandingCandidate | null = null
  let bestLateCandidate: SweptLandingCandidate | null = null

  for (const platform of platforms) {
    if (!platform.active || !platform.enabled) {
      continue
    }

    const crossedTop = player.bottom >= platform.top - config.crossEpsilonPx
    if (!crossedTop) {
      continue
    }

    const enteredFromAbove = player.prevBottom <= platform.top + config.topTolerancePx
    if (enteredFromAbove) {
      const contactT = clamp01((platform.top - player.prevBottom) / fallDistancePx)
      const playerLeftAtContact = interpolate(player.prevLeft, player.left, contactT)
      const playerRightAtContact = interpolate(player.prevRight, player.right, contactT)
      const platformLeftAtContact = interpolate(platform.prevLeft, platform.left, contactT)
      const platformRightAtContact = interpolate(platform.prevRight, platform.right, contactT)
      const overlapsHorizontally =
        playerRightAtContact >= platformLeftAtContact - edgeForgivenessPx &&
        playerLeftAtContact <= platformRightAtContact + edgeForgivenessPx

      if (overlapsHorizontally) {
        const rawOverlapPx =
          Math.min(playerRightAtContact, platformRightAtContact) -
          Math.max(playerLeftAtContact, platformLeftAtContact)
        const crossCandidate: SweptLandingCandidate = {
          platformId: platform.platformId,
          landingTop: platform.top,
          mode: 'cross',
          contactT,
          penetrationPx: 0,
          rawOverlapPx,
        }
        if (isBetterCrossCandidate(crossCandidate, bestCrossCandidate)) {
          bestCrossCandidate = crossCandidate
        }
      }
    }

    const wasNearTopBand =
      enteredFromAbove || player.prevBottom >= platform.top - config.crossEpsilonPx
    const withinLateVerticalBand = player.bottom <= platform.top + lateRescuePenetrationPx
    const overlapsNow =
      player.right >= platform.left - edgeForgivenessPx &&
      player.left <= platform.right + edgeForgivenessPx
    if (wasNearTopBand && withinLateVerticalBand && overlapsNow) {
      const rawOverlapPx =
        Math.min(player.right, platform.right) - Math.max(player.left, platform.left)
      const penetrationPx = Math.max(0, player.bottom - platform.top)
      const lateCandidate: SweptLandingCandidate = {
        platformId: platform.platformId,
        landingTop: platform.top,
        mode: 'late',
        contactT: 1,
        penetrationPx,
        rawOverlapPx,
      }
      if (isBetterLateCandidate(lateCandidate, bestLateCandidate)) {
        bestLateCandidate = lateCandidate
      }
    }
  }

  if (bestCrossCandidate) {
    return {
      platformId: bestCrossCandidate.platformId,
      landingTop: bestCrossCandidate.landingTop,
      mode: bestCrossCandidate.mode,
    }
  }

  if (!bestLateCandidate) {
    return null
  }

  return {
    platformId: bestLateCandidate.platformId,
    landingTop: bestLateCandidate.landingTop,
    mode: bestLateCandidate.mode,
  }
}
