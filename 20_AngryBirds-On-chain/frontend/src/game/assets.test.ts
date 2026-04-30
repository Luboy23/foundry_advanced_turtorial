import { describe, expect, it } from 'vitest'
import {
  FRAME_ASSET_IDS,
  RUNTIME_FRAME_IDS,
  getFrameTextureKey,
  getFrameTexturePath,
} from './assets'

describe('game assets', () => {
  it('registers only the frame assets that the runtime actually consumes', () => {
    expect(RUNTIME_FRAME_IDS).toHaveLength(18)
    expect(RUNTIME_FRAME_IDS).toContain(FRAME_ASSET_IDS.crateLarge)
    expect(RUNTIME_FRAME_IDS).toContain(FRAME_ASSET_IDS.pigDefeat3)
    expect(RUNTIME_FRAME_IDS).toContain(FRAME_ASSET_IDS.birdRedLaunch1)
  })

  it('maps representative frame ids to the expected file paths', () => {
    expect(getFrameTexturePath(FRAME_ASSET_IDS.birdRedAim1)).toBe(
      '/game-images/characters/birds/bird-red-aim-1.png',
    )
    expect(getFrameTexturePath(FRAME_ASSET_IDS.pigIdle2)).toBe(
      '/game-images/characters/pigs/pig-idle-2.png',
    )
    expect(getFrameTexturePath(FRAME_ASSET_IDS.slingshotBack)).toBe(
      '/game-images/props/slingshot/slingshot-back.png',
    )
    expect(getFrameTexturePath(FRAME_ASSET_IDS.beamLong)).toBe('/game-images/props/blocks/beam-long.png')
    expect(getFrameTexturePath(FRAME_ASSET_IDS.crateSmall)).toBe('/game-images/props/blocks/crate-small.png')
  })

  it('generates stable texture keys from semantic frame ids', () => {
    expect(getFrameTextureKey(FRAME_ASSET_IDS.pigIdle1)).toBe('frame:pig-idle-1')
    expect(getFrameTextureKey(FRAME_ASSET_IDS.crateLarge)).toBe('frame:crate-large')
  })
})
