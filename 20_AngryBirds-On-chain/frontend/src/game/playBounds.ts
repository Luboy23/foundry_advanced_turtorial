import { LEVEL_PREFABS } from './prefabs'
import type { LevelGameplayDefinition, LevelPiece } from './types'

export const PLAYFIELD_RIGHT_SCREEN_INSET_PX = 0
export const PLAYFIELD_STRUCTURE_RIGHT_PADDING_PX = 96
export const PLAYFIELD_BOUNDARY_WALL_HALF_WIDTH_PX = 36

type PlayRightBoundaryLayoutOptions = {
  viewportWidth: number
  worldWidth: number
  defaultZoom: number
  cameraMinX: number
  cameraMaxX: number
  structureRightX: number
  rightScreenInsetPx?: number
  structurePaddingPx?: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const getPieceHorizontalExtent = (piece: LevelPiece) => {
  const prefab = LEVEL_PREFABS[piece.prefabKey]
  return prefab.radius ?? prefab.width / 2
}

export const computeStructureBounds = (level: Pick<LevelGameplayDefinition, 'pieces'>) => {
  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY

  level.pieces.forEach((piece) => {
    const extent = getPieceHorizontalExtent(piece)
    left = Math.min(left, piece.x - extent)
    right = Math.max(right, piece.x + extent)
  })

  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return { left: 0, right: 0 }
  }

  return { left, right }
}

const computeCameraScrollX = (cameraMinX: number, worldWidth: number, visibleWorldWidth: number) =>
  clamp(cameraMinX, 0, Math.max(worldWidth - visibleWorldWidth, 0))

const computeVisibleRightBoundaryX = (
  viewportWidth: number,
  zoom: number,
  cameraScrollX: number,
  rightScreenInsetPx: number,
) => cameraScrollX + Math.max(viewportWidth - rightScreenInsetPx, 0) / zoom

export const computePlayRightBoundaryLayout = ({
  viewportWidth,
  worldWidth,
  defaultZoom,
  cameraMinX,
  cameraMaxX,
  structureRightX,
  rightScreenInsetPx = PLAYFIELD_RIGHT_SCREEN_INSET_PX,
  structurePaddingPx = PLAYFIELD_STRUCTURE_RIGHT_PADDING_PX,
}: PlayRightBoundaryLayoutOptions) => {
  const requiredRightBoundaryX = Math.min(cameraMaxX, structureRightX + structurePaddingPx)

  const fitsAtZoom = (zoom: number) => {
    const visibleWorldWidth = viewportWidth / zoom
    const cameraScrollX = computeCameraScrollX(cameraMinX, worldWidth, visibleWorldWidth)
    const effectiveRightBoundaryX = Math.min(
      cameraMaxX,
      computeVisibleRightBoundaryX(viewportWidth, zoom, cameraScrollX, rightScreenInsetPx),
    )
    return effectiveRightBoundaryX >= requiredRightBoundaryX
  }

  let targetZoom = defaultZoom

  if (!fitsAtZoom(targetZoom)) {
    let low = Math.min(defaultZoom, 0.1)
    while (!fitsAtZoom(low) && low > 0.0001) {
      low /= 2
    }

    let high = defaultZoom
    for (let index = 0; index < 28; index += 1) {
      const mid = (low + high) / 2
      if (fitsAtZoom(mid)) {
        low = mid
      } else {
        high = mid
      }
    }
    targetZoom = low
  }

  let visibleWorldWidth = viewportWidth / targetZoom
  let cameraScrollX = computeCameraScrollX(cameraMinX, worldWidth, visibleWorldWidth)
  let effectiveRightBoundaryX = Math.min(
    cameraMaxX,
    computeVisibleRightBoundaryX(viewportWidth, targetZoom, cameraScrollX, rightScreenInsetPx),
  )

  if (effectiveRightBoundaryX < requiredRightBoundaryX) {
    targetZoom *= 0.999
    visibleWorldWidth = viewportWidth / targetZoom
    cameraScrollX = computeCameraScrollX(cameraMinX, worldWidth, visibleWorldWidth)
    effectiveRightBoundaryX = Math.min(
      cameraMaxX,
      computeVisibleRightBoundaryX(viewportWidth, targetZoom, cameraScrollX, rightScreenInsetPx),
    )
  }

  const effectiveRightBoundaryScreenX = (effectiveRightBoundaryX - cameraScrollX) * targetZoom

  return {
    targetZoom,
    cameraScrollX,
    requiredRightBoundaryX,
    effectiveRightBoundaryX,
    effectiveRightBoundaryScreenX,
  }
}
