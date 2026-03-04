import { createPublicClient, http, isAddress } from 'viem'
import { anvil } from 'viem/chains'
import scoreboardAbi from './scoreboard.abi.json'
import addressJson from './scoreboard.address.json'

// 旧版合约读取 ABI（兼容历史字段）
const legacyReadAbi = [
  {
    type: 'function',
    name: 'getGlobalTop',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'player', type: 'address' },
          { name: 'score', type: 'uint32' },
          { name: 'maxCombo', type: 'uint16' },
          { name: 'durationSec', type: 'uint32' },
          { name: 'speedPeak', type: 'uint16' },
          { name: 'timestamp', type: 'uint64' },
          { name: 'seq', type: 'uint64' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getUserRecent',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'player', type: 'address' },
          { name: 'score', type: 'uint32' },
          { name: 'maxCombo', type: 'uint16' },
          { name: 'durationSec', type: 'uint32' },
          { name: 'speedPeak', type: 'uint16' },
          { name: 'timestamp', type: 'uint64' },
          { name: 'seq', type: 'uint64' },
        ],
      },
    ],
  },
] as const

// 默认本地 RPC
const DEFAULT_RPC_URL = 'http://127.0.0.1:8545'
// 解析 RPC 地址（优先 override > env > 默认）
const resolveRpcUrlValue = (override?: string) =>
  override ||
  process.env.NEXT_PUBLIC_ANVIL_RPC_URL ||
  DEFAULT_RPC_URL

// 解析合约地址并校验格式（override > env > address.json）
const resolveAddressValue = (override?: string | null) => {
  const candidate =
    override ||
    process.env.NEXT_PUBLIC_SCOREBOARD_ADDRESS ||
    addressJson?.address ||
    ''
  return isAddress(candidate) ? (candidate as `0x${string}`) : null
}

// 公共客户端缓存（按 RPC URL 复用）
const clientCache = new Map<string, ReturnType<typeof createPublicClient>>()

// 获取或创建 public client
const getClient = (rpcUrl?: string) => {
  const resolved = resolveRpcUrlValue(rpcUrl)
  const cached = clientCache.get(resolved)
  if (cached) return cached
  const client = createPublicClient({
    chain: anvil,
    transport: http(resolved),
  })
  clientCache.set(resolved, client)
  return client
}

// 为 RPC 调用提供超时保护
const withTimeout = async <T>(promise: Promise<T>, ms = 8000) => {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('RPC_TIMEOUT')), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// 兼容不同 ABI 推导下的 number/bigint 字段
const toBigIntValue = (value: number | bigint) =>
  typeof value === 'bigint' ? value : BigInt(value)

// 对外暴露的地址解析方法（便于 UI 在提交前做显式校验）
export const resolveScoreboardAddress = (override?: string) =>
  resolveAddressValue(override)

// 检查合约地址是否可读且有字节码
export const checkContractReady = async (
  override?: string | null,
  rpcUrl?: string
) => {
  const address = resolveAddressValue(override)
  if (!address) {
    return { ok: false, reason: 'missing_address' }
  }
  try {
    const code = await withTimeout(
      getClient(rpcUrl).getBytecode({ address })
    )
    if (!code || code === '0x') {
      return { ok: false, reason: 'no_code' }
    }
    return { ok: true, address }
  } catch (error) {
    const message =
      (error as { message?: string })?.message ?? ''
    if (message.includes('RPC_TIMEOUT')) {
      return { ok: false, reason: 'rpc_timeout', error }
    }
    return { ok: false, reason: 'rpc_error', error }
  }
}

// 拉取全局排行榜（失败时回退旧 ABI）
export const fetchGlobalTop = async (
  override?: string | null,
  rpcUrl?: string
) => {
  const address = resolveAddressValue(override)
  if (!address) {
    throw new Error('MISSING_ADDRESS')
  }
  try {
    return await withTimeout(
      getClient(rpcUrl).readContract({
        address,
        abi: scoreboardAbi,
        functionName: 'getGlobalTop',
      })
    )
  } catch (error) {
    // 新 ABI 读取失败时回退旧 ABI，兼容历史部署版本
    try {
      const legacyEntries = (await withTimeout(
        getClient(rpcUrl).readContract({
          address,
          abi: legacyReadAbi,
          functionName: 'getGlobalTop',
        })
      )) as ReadonlyArray<{
        player: `0x${string}`
        score: number | bigint
        durationSec: number | bigint
        speedPeak: number | bigint
        timestamp: number | bigint
      }>
      return legacyEntries.map((entry) => ({
        player: entry.player,
        // 统一转为 bigint，避免 UI 排序/格式化出现 number 精度差异
        score: toBigIntValue(entry.score),
        durationSec: toBigIntValue(entry.durationSec),
        speedPeak: toBigIntValue(entry.speedPeak),
        timestamp: toBigIntValue(entry.timestamp),
      }))
    } catch {
      throw error
    }
  }
}

// 拉取用户历史（失败时回退旧 ABI）
export const fetchUserRecent = async (
  user: `0x${string}`,
  override?: string | null,
  rpcUrl?: string
) => {
  const address = resolveAddressValue(override)
  if (!address) {
    throw new Error('MISSING_ADDRESS')
  }
  try {
    return await withTimeout(
      getClient(rpcUrl).readContract({
        address,
        abi: scoreboardAbi,
        functionName: 'getUserRecent',
        args: [user],
      })
    )
  } catch (error) {
    // 用户历史同样提供旧 ABI 兜底，保持页面在旧链上可读
    try {
      const legacyEntries = (await withTimeout(
        getClient(rpcUrl).readContract({
          address,
          abi: legacyReadAbi,
          functionName: 'getUserRecent',
          args: [user],
        })
      )) as ReadonlyArray<{
        score: number | bigint
        durationSec: number | bigint
        speedPeak: number | bigint
        timestamp: number | bigint
      }>
      return legacyEntries.map((entry) => ({
        score: toBigIntValue(entry.score),
        durationSec: toBigIntValue(entry.durationSec),
        speedPeak: toBigIntValue(entry.speedPeak),
        timestamp: toBigIntValue(entry.timestamp),
      }))
    } catch {
      throw error
    }
  }
}
