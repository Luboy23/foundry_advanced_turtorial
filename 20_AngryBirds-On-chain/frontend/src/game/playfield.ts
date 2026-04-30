export const PLAYFIELD_GRASS_CENTER_OFFSET_Y = -18
export const PLAYFIELD_GRASS_DISPLAY_HEIGHT = 120
export const PLAYFIELD_GROUND_HALF_HEIGHT = 62
export const PLAYFIELD_VISUAL_SURFACE_OFFSET_Y = -36

export const getPlayfieldGroundSurfaceY = (groundY: number) =>
  groundY + PLAYFIELD_VISUAL_SURFACE_OFFSET_Y

export const getPlayfieldGroundBodyCenterY = (groundY: number) =>
  getPlayfieldGroundSurfaceY(groundY) + PLAYFIELD_GROUND_HALF_HEIGHT
