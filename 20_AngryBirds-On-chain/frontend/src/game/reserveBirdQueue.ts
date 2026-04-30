import type { BirdType } from './types'

export type ReserveBirdSlot = {
  index: number
  birdType: BirdType
  x: number
  y: number
  scale: number
  alpha: number
}

type BuildReserveBirdSlotsInput = {
  anchorX: number
  groundSurfaceY: number
  birdQueue: BirdType[]
  nextBirdIndex: number
}

const FIRST_SLOT_OFFSET_X = 64
const SLOT_SPACING = 52
const SLOT_SCALE_STEP = 0.04
const SLOT_ALPHA_STEP = 0.12
const SLOT_BASE_Y_OFFSET = 24

export const buildReserveBirdSlots = ({
  anchorX,
  groundSurfaceY,
  birdQueue,
  nextBirdIndex,
}: BuildReserveBirdSlotsInput): ReserveBirdSlot[] =>
  birdQueue.slice(nextBirdIndex).map((birdType, index) => ({
    index,
    birdType,
    x: anchorX - FIRST_SLOT_OFFSET_X - SLOT_SPACING * index,
    y: groundSurfaceY - SLOT_BASE_Y_OFFSET,
    scale: Math.max(0.78, 1 - SLOT_SCALE_STEP * index),
    alpha: Math.max(0.55, 0.96 - SLOT_ALPHA_STEP * index),
  }))
