const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const contractsDir = path.join(rootDir, 'contracts')
const broadcastDir = path.join(contractsDir, 'broadcast')
const runtimeConfigTarget = path.join(rootDir, 'frontend', 'public', 'contract-config.json')
const envTarget = path.join(rootDir, 'frontend', '.env.local')
const rootEnvTarget = path.join(rootDir, '.env')

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const DEFAULT_RPC_URL = 'http://127.0.0.1:8545'
const DEFAULT_CHAIN_ID = '31337'
const DEFAULT_DEPLOYMENT_ID = 'local-dev'
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8788/api'

const parseArgs = () => {
  const args = process.argv.slice(2)
  const output = {}

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--rpc-url' && args[i + 1]) {
      output.rpcUrl = args[i + 1]
      i += 1
      continue
    }
    if (arg === '--chain-id' && args[i + 1]) {
      output.chainId = args[i + 1]
      i += 1
      continue
    }
    if (arg === '--deployment-id' && args[i + 1]) {
      output.deploymentId = args[i + 1]
      i += 1
      continue
    }
    if (arg === '--api-base-url' && args[i + 1]) {
      output.apiBaseUrl = args[i + 1]
      i += 1
      continue
    }
    if (arg === '--level-catalog-address' && args[i + 1]) {
      output.levelCatalogAddress = args[i + 1]
      i += 1
      continue
    }
    if (arg === '--scoreboard-address' && args[i + 1]) {
      output.scoreboardAddress = args[i + 1]
      i += 1
    }
  }

  return output
}

const ensureDir = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

const isAddress = (value) =>
  typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)

const parseJsonFile = (filePath, fallback = {}) => {
  if (!fs.existsSync(filePath)) {
    return fallback
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    console.warn(`Failed to parse ${filePath}: ${error.message}`)
    return fallback
  }
}

const writeJson = (filePath, data) => {
  ensureDir(filePath)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

const mergeEnvWithKnownKeys = (filePath, knownEntries) => {
  const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
  const lines = raw.length > 0 ? raw.split(/\r?\n/) : []
  const nextKeys = Object.keys(knownEntries)
  const seen = new Set()

  const merged = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)
    if (!match) {
      return line
    }

    const key = match[1]
    if (!(key in knownEntries)) {
      return line
    }

    seen.add(key)
    return `${key}=${knownEntries[key]}`
  })

  for (const key of nextKeys) {
    if (!seen.has(key)) {
      merged.push(`${key}=${knownEntries[key]}`)
    }
  }

  const normalized = merged.join('\n').replace(/\n+$/, '')
  fs.writeFileSync(filePath, `${normalized}\n`)
}

const listRunLatestFiles = (dir, files = []) => {
  if (!fs.existsSync(dir)) {
    return files
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      listRunLatestFiles(fullPath, files)
    } else if (entry.isFile() && entry.name === 'run-latest.json') {
      files.push(fullPath)
    }
  }

  return files
}

const readAddressesFromBroadcast = () => {
  const files = listRunLatestFiles(broadcastDir)
  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)

  const result = {}

  for (const filePath of files) {
    const parsed = parseJsonFile(filePath)
    for (const tx of parsed.transactions ?? []) {
      const contractName = tx.contractName || tx.contract_name
      const contractAddress = tx.contractAddress || tx.contract_address
      if (!isAddress(contractAddress)) {
        continue
      }

      if (contractName === 'AngryBirdsLevelCatalog' && !result.levelCatalogAddress) {
        result.levelCatalogAddress = contractAddress
      }
      if (contractName === 'AngryBirdsScoreboard' && !result.scoreboardAddress) {
        result.scoreboardAddress = contractAddress
      }
    }

    if (result.levelCatalogAddress || result.scoreboardAddress) {
      console.log(`Addresses inferred from ${path.relative(rootDir, filePath)}`)
      break
    }
  }

  return result
}

const toAddressOrZero = (value) => (isAddress(value) ? value : ZERO_ADDRESS)

const buildDeploymentId = ({
  explicitDeploymentId,
  chainId,
  levelCatalogAddress,
  scoreboardAddress,
}) => {
  if (explicitDeploymentId && explicitDeploymentId.trim().length > 0) {
    return explicitDeploymentId.trim()
  }

  if (levelCatalogAddress === ZERO_ADDRESS && scoreboardAddress === ZERO_ADDRESS) {
    return DEFAULT_DEPLOYMENT_ID
  }

  return `${chainId}-${levelCatalogAddress.slice(2, 8)}-${scoreboardAddress.slice(2, 8)}`
}

const main = () => {
  const args = parseArgs()
  const runtimeConfig = parseJsonFile(runtimeConfigTarget)
  const inferred = readAddressesFromBroadcast()

  const rpcUrl = args.rpcUrl || process.env.RPC_URL || DEFAULT_RPC_URL
  const chainId = String(args.chainId || process.env.CHAIN_ID || DEFAULT_CHAIN_ID)
  const apiBaseUrl =
    args.apiBaseUrl || process.env.VITE_API_BASE_URL || process.env.ANGRY_BIRDS_API_BASE_URL || DEFAULT_API_BASE_URL
  const levelCatalogAddress = toAddressOrZero(
    args.levelCatalogAddress ||
      inferred.levelCatalogAddress ||
      runtimeConfig.angryBirdsLevelCatalogAddress,
  )
  const scoreboardAddress = toAddressOrZero(
    args.scoreboardAddress ||
      inferred.scoreboardAddress ||
      runtimeConfig.angryBirdsScoreboardAddress,
  )
  const deploymentId = buildDeploymentId({
    explicitDeploymentId: args.deploymentId || process.env.DEPLOYMENT_ID,
    chainId,
    levelCatalogAddress,
    scoreboardAddress,
  })

  writeJson(runtimeConfigTarget, {
    chainId: Number(chainId),
    rpcUrl,
    deploymentId,
    apiBaseUrl,
    angryBirdsLevelCatalogAddress: levelCatalogAddress,
    angryBirdsScoreboardAddress: scoreboardAddress,
  })
  console.log(`Runtime config synced -> ${path.relative(rootDir, runtimeConfigTarget)}`)

  ensureDir(envTarget)
  mergeEnvWithKnownKeys(envTarget, {
    VITE_CHAIN_ID: chainId,
    VITE_RPC_URL: rpcUrl,
    VITE_DEPLOYMENT_ID: deploymentId,
    VITE_API_BASE_URL: apiBaseUrl,
    VITE_ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS: levelCatalogAddress,
    VITE_ANGRY_BIRDS_SCOREBOARD_ADDRESS: scoreboardAddress,
  })
  console.log(`Frontend env synced -> ${path.relative(rootDir, envTarget)}`)

  ensureDir(rootEnvTarget)
  mergeEnvWithKnownKeys(rootEnvTarget, {
    RPC_URL: rpcUrl,
    CHAIN_ID: chainId,
    DEPLOYMENT_ID: deploymentId,
    ANGRY_BIRDS_RPC_URL: rpcUrl,
    ANGRY_BIRDS_CHAIN_ID: chainId,
    ANGRY_BIRDS_DEPLOYMENT_ID: deploymentId,
    ANGRY_BIRDS_API_BASE_URL: apiBaseUrl,
    ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS: levelCatalogAddress,
    ANGRY_BIRDS_SCOREBOARD_ADDRESS: scoreboardAddress,
  })
  console.log(`Backend env synced -> ${path.relative(rootDir, rootEnvTarget)}`)
}

if (require.main === module) {
  main()
}
