import Phaser from 'phaser'
import { FRAME_ASSET_IDS, getFrameTextureKey, type FrameAssetId } from './assets'

export type BirdVisualState = 'idle' | 'aim' | 'launch'
export type PigVisualState = 'idle' | 'hit' | 'defeat'

export const CHARACTER_ANIMATION_KEYS = {
  birdIdle: 'bird-idle',
  birdAim: 'bird-aim',
  birdLaunch: 'bird-launch',
  pigIdle: 'pig-idle',
  pigHit: 'pig-hit',
  pigDefeat: 'pig-defeat',
} as const

const BIRD_VISUAL_FRAMES: Record<BirdVisualState, readonly FrameAssetId[]> = {
  idle: [
    FRAME_ASSET_IDS.birdRedIdle1,
    FRAME_ASSET_IDS.birdRedIdle2,
    FRAME_ASSET_IDS.birdRedIdle1,
    FRAME_ASSET_IDS.birdRedLaunch1,
  ],
  aim: [
    FRAME_ASSET_IDS.birdRedIdle2,
    FRAME_ASSET_IDS.birdRedAim1,
    FRAME_ASSET_IDS.birdRedLaunch1,
  ],
  launch: [
    FRAME_ASSET_IDS.birdRedLaunch1,
    FRAME_ASSET_IDS.birdRedAim1,
    FRAME_ASSET_IDS.birdRedIdle2,
  ],
}

const PIG_VISUAL_FRAMES: Record<PigVisualState, readonly FrameAssetId[]> = {
  idle: [
    FRAME_ASSET_IDS.pigIdle1,
    FRAME_ASSET_IDS.pigIdle2,
    FRAME_ASSET_IDS.pigIdle1,
    FRAME_ASSET_IDS.pigIdle3,
  ],
  hit: [FRAME_ASSET_IDS.pigHit1, FRAME_ASSET_IDS.pigIdle2, FRAME_ASSET_IDS.pigIdle1],
  defeat: [FRAME_ASSET_IDS.pigDefeat1, FRAME_ASSET_IDS.pigDefeat2, FRAME_ASSET_IDS.pigDefeat3],
}

const PIG_DEFEAT_FRAME_RATE = 10

const buildAtlasFrames = (frames: readonly FrameAssetId[]): Phaser.Types.Animations.AnimationFrame[] =>
  frames.map((frame) => ({
    key: getFrameTextureKey(frame),
  }))

const registerAnimation = (
  scene: Phaser.Scene,
  key: string,
  frames: readonly FrameAssetId[],
  frameRate: number,
  repeat: number,
  repeatDelay = 0,
) => {
  if (scene.anims.exists(key)) {
    return
  }

  scene.anims.create({
    key,
    frames: buildAtlasFrames(frames),
    frameRate,
    repeat,
    repeatDelay,
  })
}

export const registerCharacterAnimations = (scene: Phaser.Scene) => {
  registerAnimation(scene, CHARACTER_ANIMATION_KEYS.birdIdle, BIRD_VISUAL_FRAMES.idle, 4, -1, 900)
  registerAnimation(scene, CHARACTER_ANIMATION_KEYS.birdAim, BIRD_VISUAL_FRAMES.aim, 9, -1)
  registerAnimation(scene, CHARACTER_ANIMATION_KEYS.birdLaunch, BIRD_VISUAL_FRAMES.launch, 18, 0)
  registerAnimation(scene, CHARACTER_ANIMATION_KEYS.pigIdle, PIG_VISUAL_FRAMES.idle, 6, -1, 320)
  registerAnimation(scene, CHARACTER_ANIMATION_KEYS.pigHit, PIG_VISUAL_FRAMES.hit, 16, 0)
  registerAnimation(scene, CHARACTER_ANIMATION_KEYS.pigDefeat, PIG_VISUAL_FRAMES.defeat, PIG_DEFEAT_FRAME_RATE, 0)
}

export const getBirdAnimationKey = (state: BirdVisualState) => {
  switch (state) {
    case 'aim':
      return CHARACTER_ANIMATION_KEYS.birdAim
    case 'launch':
      return CHARACTER_ANIMATION_KEYS.birdLaunch
    case 'idle':
    default:
      return CHARACTER_ANIMATION_KEYS.birdIdle
  }
}

export const getPigAnimationKey = (state: PigVisualState) => {
  switch (state) {
    case 'defeat':
      return CHARACTER_ANIMATION_KEYS.pigDefeat
    case 'hit':
      return CHARACTER_ANIMATION_KEYS.pigHit
    case 'idle':
    default:
      return CHARACTER_ANIMATION_KEYS.pigIdle
  }
}

export const resolveBirdVisualState = ({
  isDragging,
  launched,
}: {
  isDragging: boolean
  launched: boolean
}): BirdVisualState => {
  if (launched) {
    return 'launch'
  }

  if (isDragging) {
    return 'aim'
  }

  return 'idle'
}

export const resolvePigVisualState = ({
  hitUntilMs,
  nowMs,
}: {
  hitUntilMs: number
  nowMs: number
}): PigVisualState => (hitUntilMs > nowMs ? 'hit' : 'idle')
