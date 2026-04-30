import Phaser from 'phaser'
import type { LevelMapMeta } from './types'

export const ASSET_KEYS = {
  mapMeta: 'map-meta',
  playBackdropMain: 'play-backdrop-main',
  playForegroundGrass: 'play-foreground-grass',
  titleBackground: 'title-backdrop',
  numbersFont: 'hud-score-font',
  trajectoryDot: 'trajectory-dot',
  slingshotBand: 'slingshot-band',
} as const

export const FRAME_ASSET_IDS = {
  crateLarge: 'crate-large',
  beamLong: 'beam-long',
  beamXl: 'beam-xl',
  crateSmall: 'crate-small',
  roofPyramid: 'roof-pyramid',
  pigIdle1: 'pig-idle-1',
  pigIdle2: 'pig-idle-2',
  pigIdle3: 'pig-idle-3',
  pigHit1: 'pig-hit-1',
  pigDefeat1: 'pig-defeat-1',
  pigDefeat2: 'pig-defeat-2',
  pigDefeat3: 'pig-defeat-3',
  birdRedIdle1: 'bird-red-idle-1',
  birdRedIdle2: 'bird-red-idle-2',
  birdRedAim1: 'bird-red-aim-1',
  birdRedLaunch1: 'bird-red-launch-1',
  slingshotBack: 'slingshot-back',
  slingshotFront: 'slingshot-front',
} as const

export type FrameAssetId = (typeof FRAME_ASSET_IDS)[keyof typeof FRAME_ASSET_IDS]

const FRAME_ASSET_PATHS: Record<FrameAssetId, string> = {
  [FRAME_ASSET_IDS.crateLarge]: '/game-images/props/blocks/crate-large.png',
  [FRAME_ASSET_IDS.beamLong]: '/game-images/props/blocks/beam-long.png',
  [FRAME_ASSET_IDS.beamXl]: '/game-images/props/blocks/beam-xl.png',
  [FRAME_ASSET_IDS.crateSmall]: '/game-images/props/blocks/crate-small.png',
  [FRAME_ASSET_IDS.roofPyramid]: '/game-images/props/blocks/roof-pyramid.png',
  [FRAME_ASSET_IDS.pigIdle1]: '/game-images/characters/pigs/pig-idle-1.png',
  [FRAME_ASSET_IDS.pigIdle2]: '/game-images/characters/pigs/pig-idle-2.png',
  [FRAME_ASSET_IDS.pigIdle3]: '/game-images/characters/pigs/pig-idle-3.png',
  [FRAME_ASSET_IDS.pigHit1]: '/game-images/characters/pigs/pig-hit-1.png',
  [FRAME_ASSET_IDS.pigDefeat1]: '/game-images/characters/pigs/pig-defeat-1.png',
  [FRAME_ASSET_IDS.pigDefeat2]: '/game-images/characters/pigs/pig-defeat-2.png',
  [FRAME_ASSET_IDS.pigDefeat3]: '/game-images/characters/pigs/pig-defeat-3.png',
  [FRAME_ASSET_IDS.birdRedIdle1]: '/game-images/characters/birds/bird-red-idle-1.png',
  [FRAME_ASSET_IDS.birdRedIdle2]: '/game-images/characters/birds/bird-red-idle-2.png',
  [FRAME_ASSET_IDS.birdRedAim1]: '/game-images/characters/birds/bird-red-aim-1.png',
  [FRAME_ASSET_IDS.birdRedLaunch1]: '/game-images/characters/birds/bird-red-launch-1.png',
  [FRAME_ASSET_IDS.slingshotBack]: '/game-images/props/slingshot/slingshot-back.png',
  [FRAME_ASSET_IDS.slingshotFront]: '/game-images/props/slingshot/slingshot-front.png',
}

export const RUNTIME_FRAME_IDS = [
  FRAME_ASSET_IDS.crateLarge,
  FRAME_ASSET_IDS.beamLong,
  FRAME_ASSET_IDS.beamXl,
  FRAME_ASSET_IDS.crateSmall,
  FRAME_ASSET_IDS.roofPyramid,
  FRAME_ASSET_IDS.pigIdle1,
  FRAME_ASSET_IDS.pigIdle2,
  FRAME_ASSET_IDS.pigIdle3,
  FRAME_ASSET_IDS.pigHit1,
  FRAME_ASSET_IDS.pigDefeat1,
  FRAME_ASSET_IDS.pigDefeat2,
  FRAME_ASSET_IDS.pigDefeat3,
  FRAME_ASSET_IDS.birdRedIdle1,
  FRAME_ASSET_IDS.birdRedIdle2,
  FRAME_ASSET_IDS.birdRedAim1,
  FRAME_ASSET_IDS.birdRedLaunch1,
  FRAME_ASSET_IDS.slingshotBack,
  FRAME_ASSET_IDS.slingshotFront,
] as const satisfies readonly FrameAssetId[]

const GENERATED_UI_TEXTURE_SIZE = 48

export const getFrameTextureKey = (frameId: FrameAssetId) => `frame:${frameId}`

export const getFrameTexturePath = (frameId: FrameAssetId) => FRAME_ASSET_PATHS[frameId]

export const preloadFrameTextures = (scene: Phaser.Scene) => {
  for (const frameId of RUNTIME_FRAME_IDS) {
    scene.load.image(getFrameTextureKey(frameId), getFrameTexturePath(frameId))
  }
}

export const ensureGeneratedUiTextures = (scene: Phaser.Scene) => {
  if (!scene.textures.exists(ASSET_KEYS.trajectoryDot)) {
    const graphics = scene.add.graphics().setVisible(false)
    graphics.clear()
    graphics.fillStyle(0x102535, 0.22)
    graphics.fillCircle(GENERATED_UI_TEXTURE_SIZE / 2, GENERATED_UI_TEXTURE_SIZE / 2, 18)
    graphics.fillStyle(0xff6b3d, 0.98)
    graphics.fillCircle(GENERATED_UI_TEXTURE_SIZE / 2, GENERATED_UI_TEXTURE_SIZE / 2, 11)
    graphics.lineStyle(3, 0xfff4dc, 0.95)
    graphics.strokeCircle(GENERATED_UI_TEXTURE_SIZE / 2, GENERATED_UI_TEXTURE_SIZE / 2, 9)
    graphics.generateTexture(
      ASSET_KEYS.trajectoryDot,
      GENERATED_UI_TEXTURE_SIZE,
      GENERATED_UI_TEXTURE_SIZE,
    )
    graphics.destroy()
  }

  if (!scene.textures.exists(ASSET_KEYS.slingshotBand)) {
    const graphics = scene.add.graphics().setVisible(false)
    graphics.clear()
    graphics.fillStyle(0x6e4321, 1)
    graphics.fillRoundedRect(0, 0, 32, 12, 6)
    graphics.fillStyle(0xd9b27a, 0.22)
    graphics.fillRoundedRect(2, 2, 28, 5, 3)
    graphics.generateTexture(ASSET_KEYS.slingshotBand, 32, 12)
    graphics.destroy()
  }
}

export const getMapMeta = (scene: Phaser.Scene): LevelMapMeta => {
  const mapMeta = scene.cache.json.get(ASSET_KEYS.mapMeta) as LevelMapMeta | undefined
  if (!mapMeta) {
    throw new Error('map metadata has not been loaded')
  }
  return mapMeta
}
