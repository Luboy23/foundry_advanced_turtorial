import { isAudioMaterial, isSupportedPrefabKey } from './prefabs'
import type {
  AudioMaterial,
  LevelCatalogEntry,
  LevelGameplayDefinition,
  LevelManifestEntry,
  LevelMapMeta,
  LevelPiece,
} from './types'

const LEVEL_MANIFEST_URL = '/levels/level-manifest.json'
const MAP_META_URL = '/levels/map-meta.json'

type LevelManifestFile = {
  generatedAt: string
  levelCount: number
  levels: LevelManifestEntry[]
}

export const validateGameplayDefinition = (gameplay: LevelGameplayDefinition) => {
  if (!gameplay.levelId) {
    throw new Error('levelId is required')
  }
  if (!Number.isInteger(gameplay.version) || gameplay.version <= 0) {
    throw new Error(`invalid version for ${gameplay.levelId}`)
  }
  if (!Array.isArray(gameplay.birdQueue) || gameplay.birdQueue.length === 0) {
    throw new Error(`birdQueue cannot be empty for ${gameplay.levelId}`)
  }
  validateAudioMaterials(gameplay.audioMaterials, gameplay.levelId)
  if (!Array.isArray(gameplay.pieces) || gameplay.pieces.length === 0) {
    throw new Error(`pieces cannot be empty for ${gameplay.levelId}`)
  }
  const seenIds = new Set<string>()
  for (const piece of gameplay.pieces) {
    validateLevelPiece(piece, gameplay.levelId, gameplay.audioMaterials)
    if (seenIds.has(piece.id)) {
      throw new Error(`duplicate piece id ${piece.id} in ${gameplay.levelId}`)
    }
    seenIds.add(piece.id)
  }
  return gameplay
}

const validateAudioMaterials = (audioMaterials: Record<string, AudioMaterial>, levelId: string) => {
  if (!audioMaterials || typeof audioMaterials !== 'object' || Array.isArray(audioMaterials)) {
    throw new Error(`audioMaterials is required in ${levelId}`)
  }

  for (const [prefabKey, audioMaterial] of Object.entries(audioMaterials)) {
    if (!isSupportedPrefabKey(prefabKey)) {
      throw new Error(`unsupported audioMaterials prefab ${prefabKey} in ${levelId}`)
    }
    if (!isAudioMaterial(audioMaterial)) {
      throw new Error(`unsupported audioMaterial ${String(audioMaterial)} for ${prefabKey} in ${levelId}`)
    }
  }
}

const validateLevelPiece = (
  piece: LevelPiece,
  levelId: string,
  audioMaterials: Record<string, AudioMaterial>,
) => {
  if (!piece.id) {
    throw new Error(`piece id is required in ${levelId}`)
  }
  if (!isSupportedPrefabKey(piece.prefabKey)) {
    throw new Error(`unsupported prefab ${piece.prefabKey} in ${levelId}`)
  }
  if (!(piece.prefabKey in audioMaterials)) {
    throw new Error(`missing audioMaterial mapping for ${piece.prefabKey} in ${levelId}`)
  }
}

const validateMapMeta = (mapMeta: LevelMapMeta) => {
  if (!mapMeta.title || !Array.isArray(mapMeta.levels) || mapMeta.levels.length === 0) {
    throw new Error('map-meta is missing levels[]')
  }

  const seenIds = new Set<string>()
  const seenOrders = new Set<number>()
  for (const level of mapMeta.levels) {
    if (!level.levelId) {
      throw new Error('map-meta levelId is required')
    }
    if (!Number.isInteger(level.order) || level.order <= 0) {
      throw new Error(`map-meta order is invalid for ${level.levelId}`)
    }
    if (seenIds.has(level.levelId)) {
      throw new Error(`duplicate map-meta levelId ${level.levelId}`)
    }
    if (seenOrders.has(level.order)) {
      throw new Error(`duplicate map-meta order ${level.order}`)
    }
    seenIds.add(level.levelId)
    seenOrders.add(level.order)
  }

  return mapMeta
}

const validateManifestEntry = (entry: LevelManifestEntry) => {
  if (!entry.levelId) {
    throw new Error('manifest levelId is required')
  }
  if (!entry.file.startsWith('/levels/')) {
    throw new Error(`manifest file path is invalid for ${entry.levelId}`)
  }
  if (!Number.isInteger(entry.order) || entry.order <= 0) {
    throw new Error(`manifest order is invalid for ${entry.levelId}`)
  }
  return entry
}

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`failed to load ${url}`)
  }
  return (await response.json()) as T
}

export const loadLevelCatalog = async (): Promise<{
  mapMeta: LevelMapMeta
  levels: LevelCatalogEntry[]
}> => {
  const [manifestFile, mapMetaRaw] = await Promise.all([
    fetchJson<LevelManifestFile>(LEVEL_MANIFEST_URL),
    fetchJson<LevelMapMeta>(MAP_META_URL),
  ])

  const manifestEntries = manifestFile.levels.map(validateManifestEntry)
  const mapMeta = validateMapMeta(mapMetaRaw)
  const mapNodes = new Map(mapMeta.levels.map((level) => [level.levelId, level]))

  const levels = await Promise.all(
    manifestEntries.map(async (entry) => {
      const gameplayRaw = await fetchJson<LevelGameplayDefinition>(entry.file)
      const gameplay = validateGameplayDefinition(gameplayRaw)
      const map = mapNodes.get(entry.levelId)
      if (!map) {
        throw new Error(`missing map node for ${entry.levelId}`)
      }
      if (gameplay.levelId !== entry.levelId || gameplay.version !== entry.version) {
        throw new Error(`manifest mismatch for ${entry.levelId}`)
      }
      return {
        ...gameplay,
        manifest: entry,
        map,
      }
    }),
  )

  levels.sort((left, right) => left.manifest.order - right.manifest.order)
  return { mapMeta, levels }
}
