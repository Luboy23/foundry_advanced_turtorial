const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const rootDir = path.resolve(__dirname, '..')
const levelsDir = path.join(rootDir, 'frontend', 'public', 'levels')
const mapMetaPath = path.join(levelsDir, 'map-meta.json')
const frontendManifestPath = path.join(levelsDir, 'level-manifest.json')
const contractsManifestPath = path.join(rootDir, 'contracts', 'script', 'level-manifest.json')

const fail = (message) => {
  console.error(`[build-level-manifest] ${message}`)
  process.exit(1)
}

const canonicalize = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item))
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key])
        return result
      }, {})
  }
  return value
}

const toLevelIdBytes32 = (value) => {
  const hex = Buffer.from(value, 'utf8').toString('hex')
  if (hex.length > 64) {
    fail(`levelId ${value} exceeds 32 bytes`)
  }
  return `0x${hex.padEnd(64, '0')}`
}

const keccak256 = (input) => {
  const result = spawnSync('cast', ['keccak', input], {
    cwd: rootDir,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    fail(`cast keccak failed: ${(result.stderr || result.stdout || '').trim()}`)
  }

  return result.stdout.trim()
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

const supportedPrefabs = new Set([
  'crate-large',
  'beam-long',
  'beam-xl',
  'crate-small',
  'roof-pyramid',
  'pig-basic',
  'bird-red',
])

const supportedAudioMaterials = new Set(['generic', 'wood', 'stone', 'glass', 'pig'])

const validateGameplay = (level, file) => {
  if (!level.levelId || typeof level.levelId !== 'string') {
    fail(`${file}: levelId is required`)
  }
  if (!Number.isInteger(level.version) || level.version <= 0) {
    fail(`${file}: version must be a positive integer`)
  }
  if (!Array.isArray(level.birdQueue) || level.birdQueue.length === 0) {
    fail(`${file}: birdQueue cannot be empty`)
  }
  if (!level.audioMaterials || typeof level.audioMaterials !== 'object' || Array.isArray(level.audioMaterials)) {
    fail(`${file}: audioMaterials is required`)
  }
  for (const [prefabKey, audioMaterial] of Object.entries(level.audioMaterials)) {
    if (!supportedPrefabs.has(prefabKey)) {
      fail(`${file}: unsupported audioMaterials prefab ${prefabKey}`)
    }
    if (!supportedAudioMaterials.has(audioMaterial)) {
      fail(`${file}: unsupported audioMaterial ${audioMaterial} for ${prefabKey}`)
    }
  }
  if (!Array.isArray(level.pieces) || level.pieces.length === 0) {
    fail(`${file}: pieces cannot be empty`)
  }
  const supportedBirds = new Set(['red'])
  for (const birdType of level.birdQueue) {
    if (!supportedBirds.has(birdType)) {
      fail(`${file}: unsupported bird type ${birdType}`)
    }
  }
  for (const piece of level.pieces) {
    if (!piece || typeof piece !== 'object') {
      fail(`${file}: invalid piece entry`)
    }
    if (!supportedPrefabs.has(piece.prefabKey)) {
      fail(`${file}: unsupported prefab ${piece.prefabKey}`)
    }
    if (!(piece.prefabKey in level.audioMaterials)) {
      fail(`${file}: missing audioMaterial mapping for ${piece.prefabKey}`)
    }
  }
}

const loadMapMeta = () => {
  const mapMeta = readJson(mapMetaPath)
  if (!Array.isArray(mapMeta.levels) || mapMeta.levels.length === 0) {
    fail('map-meta.json must contain levels[]')
  }

  const seenIds = new Set()
  const seenOrders = new Set()
  for (const level of mapMeta.levels) {
    if (!level.levelId || typeof level.levelId !== 'string') {
      fail('map-meta.json: every level needs levelId')
    }
    if (!Number.isInteger(level.order) || level.order <= 0) {
      fail(`map-meta.json: invalid order for ${level.levelId}`)
    }
    if (seenIds.has(level.levelId)) {
      fail(`map-meta.json: duplicate levelId ${level.levelId}`)
    }
    if (seenOrders.has(level.order)) {
      fail(`map-meta.json: duplicate order ${level.order}`)
    }
    seenIds.add(level.levelId)
    seenOrders.add(level.order)
  }

  return mapMeta
}

const main = () => {
  const mapMeta = loadMapMeta()
  const mapEntries = new Map(mapMeta.levels.map((level) => [level.levelId, level]))

  const gameplayFiles = fs
    .readdirSync(levelsDir)
    .filter((file) => file.endsWith('.gameplay.json'))
    .sort()

  if (gameplayFiles.length === 0) {
    fail('no gameplay json files found')
  }

  const levels = gameplayFiles.map((file) => {
    const fullPath = path.join(levelsDir, file)
    const gameplay = readJson(fullPath)
    validateGameplay(gameplay, file)

    const mapEntry = mapEntries.get(gameplay.levelId)
    if (!mapEntry) {
      fail(`${file}: missing map-meta entry for ${gameplay.levelId}`)
    }

    const canonicalJson = JSON.stringify(canonicalize(gameplay))
    return {
      levelId: gameplay.levelId,
      version: gameplay.version,
      file: `/levels/${file}`,
      contentHash: keccak256(canonicalJson),
      order: mapEntry.order,
      enabled: true,
    }
  })

  const frontendManifest = {
    generatedAt: new Date().toISOString(),
    levelCount: levels.length,
    levels: levels.sort((left, right) => left.order - right.order),
  }

  const contractsManifest = {
    generatedAt: frontendManifest.generatedAt,
    levelCount: frontendManifest.levelCount,
    levels: frontendManifest.levels.map((level) => ({
      levelId: toLevelIdBytes32(level.levelId),
      version: level.version,
      contentHash: level.contentHash,
      order: level.order,
      enabled: level.enabled,
    })),
  }

  fs.writeFileSync(frontendManifestPath, `${JSON.stringify(frontendManifest, null, 2)}\n`)
  fs.writeFileSync(contractsManifestPath, `${JSON.stringify(contractsManifest, null, 2)}\n`)

  console.log(`[build-level-manifest] wrote ${path.relative(rootDir, frontendManifestPath)}`)
  console.log(`[build-level-manifest] wrote ${path.relative(rootDir, contractsManifestPath)}`)
}

if (require.main === module) {
  main()
}

module.exports = {
  canonicalize,
  toLevelIdBytes32,
}
