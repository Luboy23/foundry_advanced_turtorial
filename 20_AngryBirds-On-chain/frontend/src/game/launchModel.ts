export type LaunchPoint = {
  x: number
  y: number
}

export type LaunchExtents = {
  left: number
  right: number
  up: number
  down: number
}

export type LaunchState = {
  anchor: LaunchPoint
  pointer: LaunchPoint
  clampedPoint: LaunchPoint
  pullVectorPx: LaunchPoint
  distancePx: number
  velocityPxPerSecond: LaunchPoint
  velocityMetersPerSecond: LaunchPoint
  extents: LaunchExtents
}

export type BuildLaunchStateInput = {
  anchorX: number
  anchorY: number
  pointerX: number
  pointerY: number
  maxDrag: number
  launchVelocityScale: number
  pixelsPerMeter: number
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export const getLaunchExtents = (maxDrag: number): LaunchExtents => ({
  left: Math.max(maxDrag, 140),
  right: clamp(Math.round(maxDrag * 0.47), 76, 96),
  up: clamp(Math.round(maxDrag * 0.55), 96, 110),
  down: clamp(Math.round(maxDrag * 0.79), 140, 156),
})

export const clampLaunchPointer = ({
  anchorX,
  anchorY,
  pointerX,
  pointerY,
  maxDrag,
}: Omit<BuildLaunchStateInput, 'launchVelocityScale' | 'pixelsPerMeter'>) => {
  const extents = getLaunchExtents(maxDrag)
  const dx = clamp(pointerX - anchorX, -extents.left, extents.right)
  const dy = clamp(pointerY - anchorY, -extents.up, extents.down)

  return {
    point: {
      x: anchorX + dx,
      y: anchorY + dy,
    },
    extents,
  }
}

export const buildLaunchState = ({
  anchorX,
  anchorY,
  pointerX,
  pointerY,
  maxDrag,
  launchVelocityScale,
  pixelsPerMeter,
}: BuildLaunchStateInput): LaunchState => {
  const anchor = { x: anchorX, y: anchorY }
  const pointer = { x: pointerX, y: pointerY }
  const { point: clampedPoint, extents } = clampLaunchPointer({
    anchorX,
    anchorY,
    pointerX,
    pointerY,
    maxDrag,
  })

  const pullVectorPx = {
    x: anchorX - clampedPoint.x,
    y: anchorY - clampedPoint.y,
  }
  const distancePx = Math.hypot(pullVectorPx.x, pullVectorPx.y)
  const velocityPxPerSecond = {
    x: pullVectorPx.x * launchVelocityScale,
    y: pullVectorPx.y * launchVelocityScale,
  }

  return {
    anchor,
    pointer,
    clampedPoint,
    pullVectorPx,
    distancePx,
    velocityPxPerSecond,
    velocityMetersPerSecond: {
      x: velocityPxPerSecond.x / pixelsPerMeter,
      y: velocityPxPerSecond.y / pixelsPerMeter,
    },
    extents,
  }
}

export const estimateIdealLaunchRangePx = ({
  velocityMetersPerSecond,
  gravityY,
  pixelsPerMeter,
}: Pick<LaunchState, 'velocityMetersPerSecond'> & { gravityY: number; pixelsPerMeter: number }) => {
  const upwardVelocity = Math.max(-velocityMetersPerSecond.y, 0)
  const forwardVelocity = Math.max(velocityMetersPerSecond.x, 0)
  if (upwardVelocity <= 0 || forwardVelocity <= 0 || gravityY <= 0) {
    return 0
  }

  const flightTime = (2 * upwardVelocity) / gravityY
  return forwardVelocity * flightTime * pixelsPerMeter
}
