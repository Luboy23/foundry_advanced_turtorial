export type SlingshotPoint = {
  x: number
  y: number
}

export type SlingshotRigLayout = {
  birdRest: SlingshotPoint
  rearBandAnchor: SlingshotPoint
  frontBandAnchor: SlingshotPoint
  idleBandTarget: SlingshotPoint
  rearStickTopLeft: SlingshotPoint
  frontStickTopLeft: SlingshotPoint
  dragHitRadius: number
}

export const buildSlingshotRigLayout = (anchorX: number, anchorY: number): SlingshotRigLayout => ({
  birdRest: { x: anchorX, y: anchorY },
  rearBandAnchor: { x: anchorX - 30, y: anchorY + 15 },
  frontBandAnchor: { x: anchorX + 15, y: anchorY + 10 },
  idleBandTarget: { x: anchorX - 8, y: anchorY + 10 },
  rearStickTopLeft: { x: anchorX - 10, y: anchorY - 20 },
  frontStickTopLeft: { x: anchorX - 35, y: anchorY - 28 },
  dragHitRadius: 58,
})
