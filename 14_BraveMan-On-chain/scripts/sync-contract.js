const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')

// 项目根目录：所有输出路径统一基于该目录解析。
const rootDir = path.resolve(__dirname, '..')
// Foundry 编译产物中的 ABI 来源文件。
const outFile = path.join(rootDir, 'contracts', 'out', 'BraveManGame.sol', 'BraveManGame.json')
// 前端 ABI 目标文件。
const abiTarget = path.join(rootDir, 'frontend', 'src', 'lib', 'braveman.abi.json')
// 前端本地环境变量文件。
const frontendEnvTarget = path.join(rootDir, 'frontend', '.env.local')
// 前端运行时配置文件，供浏览器端读取链/合约/API 接线信息。
const runtimeConfigTarget = path.join(rootDir, 'frontend', 'public', 'contract-config.json')
// 后端环境变量文件，包含合约与签名人配置。
const backendEnvTarget = path.join(rootDir, 'backend', '.env')
// Foundry broadcast 目录，用于在未显式传地址时回读最近一次部署结果。
const broadcastDir = path.join(rootDir, 'contracts', 'broadcast')

// 本地开发默认链配置。
const DEFAULT_RPC_URL = 'http://127.0.0.1:8545'
const DEFAULT_CHAIN_ID = '31337'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * 解析命令行参数。
 * 支持 address/rpc/chain/signerAddress/signerPrivateKey 覆盖。
 */
const parseArgs = () => {
  const args = process.argv.slice(2)
  const output = {}
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--address' && args[i + 1]) {
      output.address = args[++i]
      continue
    }
    if (arg === '--rpc-url' && args[i + 1]) {
      output.rpcUrl = args[++i]
      continue
    }
    if (arg === '--chain-id' && args[i + 1]) {
      output.chainId = args[++i]
      continue
    }
    if (arg === '--signer-address' && args[i + 1]) {
      output.signerAddress = args[++i]
      continue
    }
    if (arg === '--signer-private-key' && args[i + 1]) {
      output.signerPrivateKey = args[++i]
    }
  }
  return output
}

// 确保目标目录存在，避免写文件时报错。
const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true })

const isAddress = (value) =>
  typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)

/**
 * 仅覆盖已知 env 键，保留其他自定义行不变。
 * 兼容策略：已存在则替换，缺失则追加。
 */
const mergeEnvWithKnownKeys = (filePath, knownEntries) => {
  const nextKeys = Object.keys(knownEntries)
  const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
  const lines = raw.length > 0 ? raw.split(/\r?\n/) : []
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

  fs.writeFileSync(filePath, `${merged.join('\n').replace(/\n+$/, '')}\n`)
}

/**
 * 读取并校验 ABI。
 * 失败时直接退出，避免写入不完整配置。
 */
const loadAbi = () => {
  if (!fs.existsSync(outFile)) {
    console.error(`Missing foundry output: ${outFile}`)
    process.exit(1)
  }
  const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'))
  if (!Array.isArray(parsed.abi)) {
    console.error('Invalid ABI in foundry output.')
    process.exit(1)
  }
  return parsed.abi
}

const listRunLatestFiles = (dir, files = []) => {
  if (!fs.existsSync(dir)) return files

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

const readAddressFromBroadcast = () => {
  const files = listRunLatestFiles(broadcastDir)
  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)

  for (const filePath of files) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      for (const tx of parsed.transactions ?? []) {
        const contractName = tx.contractName || tx.contract_name
        const contractAddress = tx.contractAddress || tx.contract_address
        if (contractName === 'BraveManGame' && isAddress(contractAddress)) {
          console.log(`BraveManGame address inferred from ${path.relative(rootDir, filePath)}`)
          return contractAddress
        }
      }
    } catch (error) {
      console.warn(`Failed to parse ${filePath}: ${error.message}`)
    }
  }

  return undefined
}

/**
 * 主流程：
 * 1) 解析参数并补齐默认值；
 * 2) 同步 ABI；
 * 3) 若有地址则同步前后端 env。
 */
const main = () => {
  const args = parseArgs()
  const address = args.address || readAddressFromBroadcast()
  const rpcUrl = args.rpcUrl || process.env.RPC_URL || DEFAULT_RPC_URL
  const chainId = args.chainId || process.env.CHAIN_ID || DEFAULT_CHAIN_ID
  const signerAddress = args.signerAddress || process.env.BRAVEMAN_SIGNER_ADDRESS || ZERO_ADDRESS
  const signerPrivateKey = args.signerPrivateKey || process.env.API_SIGNER_PRIVATE_KEY || process.env.BRAVEMAN_SIGNER_PRIVATE_KEY || '0x...'
  // 每次部署生成唯一部署 ID，便于后端识别配置版本。
  const deploymentId = randomUUID()
  const abi = loadAbi()

  ensureDir(abiTarget)
  fs.writeFileSync(abiTarget, JSON.stringify(abi, null, 2))

  if (!address) {
    // 地址缺失时仅同步 ABI，避免误写空地址到运行配置。
    console.warn('Address missing, skip runtime/env sync.')
    return
  }

  const resolvedAddress = isAddress(address) ? address : ZERO_ADDRESS

  ensureDir(runtimeConfigTarget)
  fs.writeFileSync(
    runtimeConfigTarget,
    `${JSON.stringify(
      {
        braveManGameAddress: resolvedAddress,
        rpcUrl,
        chainId: Number(chainId),
        signerAddress: isAddress(signerAddress) ? signerAddress : ZERO_ADDRESS,
        apiBaseUrl: 'http://127.0.0.1:8787',
      },
      null,
      2,
    )}\n`,
  )

  // 增量更新前端环境变量。
  ensureDir(frontendEnvTarget)
  mergeEnvWithKnownKeys(frontendEnvTarget, {
    VITE_CHAIN_ID: chainId,
    VITE_RPC_URL: rpcUrl,
    VITE_BRAVEMAN_ADDRESS: resolvedAddress,
    VITE_API_BASE_URL: 'http://127.0.0.1:8787',
  })

  // 增量更新后端环境变量，确保 verify/claim 使用同一部署配置。
  ensureDir(backendEnvTarget)
  mergeEnvWithKnownKeys(backendEnvTarget, {
    BRAVEMAN_RPC_URL: rpcUrl,
    BRAVEMAN_CHAIN_ID: chainId,
    BRAVEMAN_CONTRACT_ADDRESS: resolvedAddress,
    BRAVEMAN_SIGNER_ADDRESS: signerAddress,
    BRAVEMAN_SIGNER_PRIVATE_KEY: signerPrivateKey,
    BRAVEMAN_DEPLOYMENT_ID: deploymentId,
  })

  console.log(`Synced ABI and runtime/env config -> ${resolvedAddress}`)
}

main()
