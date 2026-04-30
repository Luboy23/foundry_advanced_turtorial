import { FRAME_ASSET_IDS, type FrameAssetId } from './assets'
import type { AudioMaterial } from './types'

export const PREFAB_KEYS = {
  crateLarge: 'crate-large',
  beamLong: 'beam-long',
  beamXl: 'beam-xl',
  crateSmall: 'crate-small',
  roofPyramid: 'roof-pyramid',
  pigBasic: 'pig-basic',
  birdRed: 'bird-red',
} as const

export type PrefabKey = (typeof PREFAB_KEYS)[keyof typeof PREFAB_KEYS]

export type PrefabDefinition = {
  frameId: FrameAssetId
  width: number
  height: number
  shape: 'box' | 'circle' | 'triangle'
  radius?: number
  hp: number
  density: number
  friction: number
  restitution: number
  linearDamping?: number
  angularDamping?: number
}

export const LEVEL_PREFABS: Record<string, PrefabDefinition> = {
  [PREFAB_KEYS.crateLarge]: {
    frameId: FRAME_ASSET_IDS.crateLarge,
    width: 84,
    height: 84,
    shape: 'box',
    hp: 22,
    density: 1.2,
    friction: 0.8,
    restitution: 0.08,
  },
  [PREFAB_KEYS.beamLong]: {
    frameId: FRAME_ASSET_IDS.beamLong,
    width: 169,
    height: 21,
    shape: 'box',
    hp: 14,
    density: 0.9,
    friction: 0.9,
    restitution: 0.06,
  },
  [PREFAB_KEYS.beamXl]: {
    frameId: FRAME_ASSET_IDS.beamXl,
    width: 205,
    height: 22,
    shape: 'box',
    hp: 17,
    density: 1,
    friction: 0.9,
    restitution: 0.06,
  },
  [PREFAB_KEYS.crateSmall]: {
    frameId: FRAME_ASSET_IDS.crateSmall,
    width: 41,
    height: 40,
    shape: 'box',
    hp: 9,
    density: 1.1,
    friction: 0.8,
    restitution: 0.05,
  },
  [PREFAB_KEYS.roofPyramid]: {
    frameId: FRAME_ASSET_IDS.roofPyramid,
    width: 84,
    height: 83,
    shape: 'triangle',
    hp: 12,
    density: 1,
    friction: 0.8,
    restitution: 0.04,
  },
  [PREFAB_KEYS.pigBasic]: {
    frameId: FRAME_ASSET_IDS.pigIdle1,
    width: 48,
    height: 46,
    shape: 'circle',
    radius: 23,
    hp: 10,
    density: 0.6,
    friction: 0.82,
    restitution: 0.06,
    linearDamping: 0.34,
    angularDamping: 0.64,
  },
  [PREFAB_KEYS.birdRed]: {
    frameId: FRAME_ASSET_IDS.birdRedIdle1,
    width: 46,
    height: 45,
    shape: 'circle',
    radius: 22,
    hp: 1,
    density: 1.25,
    friction: 0.55,
    restitution: 0.18,
    linearDamping: 0.08,
    angularDamping: 0.08,
  },
}

export const isSupportedPrefabKey = (prefabKey: string): prefabKey is PrefabKey => prefabKey in LEVEL_PREFABS

export const isAudioMaterial = (value: unknown): value is AudioMaterial =>
  value === 'generic' || value === 'wood' || value === 'stone' || value === 'glass' || value === 'pig'
