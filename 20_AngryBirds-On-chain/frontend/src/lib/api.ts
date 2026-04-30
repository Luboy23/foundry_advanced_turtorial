import type {
  ActiveSessionPermit,
  RunEvidenceV1,
  SessionPermitTypedData,
} from '../game/types'
import { getResolvedRuntimeConfig } from './runtime-config'

type CreateSessionResponse = {
  sessionId: `0x${string}`
  deadline: number
  maxRuns: number
  permit: ActiveSessionPermit
  typedData: SessionPermitTypedData
}

type UploadRunResponse = {
  run: {
    runId: `0x${string}`
    levelId: `0x${string}`
    levelVersion: number
    birdsUsed: number
    destroyedPigs: number
    durationMs: number
    evidenceHash: `0x${string}`
  }
  status: string
}

type FinalizeSessionResponse = {
  ok: boolean
  status: string
}

export type SessionStatusResponse = {
  sessionId: `0x${string}`
  status: string
  receivedRuns: number
  validatedRuns: number
  queuedRuns: number
  submittedRuns: number
  confirmedRuns: number
  failedRuns: number
  txHashes: `0x${string}`[]
  lastError: string | null
}

export type IndexedLeaderboardRow = {
  player: `0x${string}`
  result: {
    levelId: string
    levelVersion: number
    birdsUsed: number
    destroyedPigs: number
    durationMs: number
    evidenceHash: `0x${string}`
    submittedAt: number
  }
}

export type IndexedHistoryRow = {
  player: `0x${string}`
  result: {
    levelId: string
    levelVersion: number
    birdsUsed: number
    destroyedPigs: number
    durationMs: number
    evidenceHash: `0x${string}`
    submittedAt: number
  }
}

export type IndexerStatusResponse = {
  ok: boolean
  status: 'idle' | 'running' | 'error'
  lastProcessedBlock: number
  lastProcessedLogIndex: number
  lastError: string | null
}

export type ApiErrorCode =
  | 'request_timeout'
  | 'backend_unavailable'
  | 'session_expired'
  | 'session_auth_failed'
  | 'validation_failed'
  | 'relay_failed'
  | 'request_in_progress'
  | 'request_id_conflict'
  | 'internal_error'
  | 'api_error'

// 统一 API 错误对象，携带可重试标记和 requestId 便于追踪。
export class ApiError extends Error {
  code: ApiErrorCode
  status: number | null
  retriable: boolean
  requestId: string

  constructor({
    code,
    message,
    status,
    retriable,
    requestId,
  }: {
    code: ApiErrorCode
    message: string
    status: number | null
    retriable: boolean
    requestId: string
  }) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.retriable = retriable
    this.requestId = requestId
  }
}

const DEFAULT_TIMEOUT_MS = 8_000
const MAX_RETRY_ATTEMPTS = 2

// 规范化 API 根地址，去掉末尾斜杠避免拼接重复。
const getApiBaseUrl = () => getResolvedRuntimeConfig().apiBaseUrl.replace(/\/+$/, '')

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

// 每次请求生成稳定 requestId；重试沿用同一个 requestId。
const buildRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ab-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// 将后端 code/status/message 映射为前端统一错误语义。
const classifyApiError = ({
  code,
  status,
  message,
  retriable,
  requestId,
}: {
  code?: string | null
  status: number | null
  message: string
  retriable: boolean
  requestId: string
}) => {
  if (code === 'request_timeout') {
    return new ApiError({
      code: 'request_timeout',
      message,
      status,
      retriable: true,
      requestId,
    })
  }
  if (code === 'validation_failed') {
    return new ApiError({
      code: 'validation_failed',
      message,
      status,
      retriable: false,
      requestId,
    })
  }
  if (code === 'session_expired' || code === 'session_not_found') {
    return new ApiError({
      code: 'session_expired',
      message,
      status,
      retriable: false,
      requestId,
    })
  }
  if (code === 'session_auth_failed') {
    return new ApiError({
      code: 'session_auth_failed',
      message,
      status,
      retriable: false,
      requestId,
    })
  }
  if (code === 'relay_failed') {
    return new ApiError({
      code: 'relay_failed',
      message,
      status,
      retriable,
      requestId,
    })
  }
  if (code === 'request_in_progress') {
    return new ApiError({
      code: 'request_in_progress',
      message,
      status,
      retriable: true,
      requestId,
    })
  }
  if (code === 'request_id_conflict') {
    return new ApiError({
      code: 'request_id_conflict',
      message,
      status,
      retriable: false,
      requestId,
    })
  }
  if (code === 'internal_error') {
    return new ApiError({
      code: 'internal_error',
      message,
      status,
      retriable,
      requestId,
    })
  }
  if (code === 'backend_unavailable') {
    return new ApiError({
      code: 'backend_unavailable',
      message,
      status,
      retriable: true,
      requestId,
    })
  }

  const normalized = message.toLowerCase()
  if (status === 408 || normalized.includes('timeout') || normalized.includes('aborted')) {
    return new ApiError({
      code: 'request_timeout',
      message,
      status,
      retriable: true,
      requestId,
    })
  }
  if (
    status === 422 ||
    normalized.includes('validation failed') ||
    normalized.includes('checkpoint gap') ||
    normalized.includes('destroyed pig count')
  ) {
    return new ApiError({
      code: 'validation_failed',
      message,
      status,
      retriable: false,
      requestId,
    })
  }
  if (
    status === 404 ||
    status === 409 ||
    status === 410 ||
    normalized.includes('session permit expired') ||
    normalized.includes('session not found') ||
    normalized.includes('session must be activated') ||
    normalized.includes('session maxruns exceeded')
  ) {
    return new ApiError({
      code: 'session_expired',
      message,
      status,
      retriable: false,
      requestId,
    })
  }
  if (normalized.includes('relay') || normalized.includes('tx') || normalized.includes('on-chain')) {
    return new ApiError({
      code: 'relay_failed',
      message,
      status,
      retriable,
      requestId,
    })
  }
  if (retriable || (status !== null && [502, 503, 504].includes(status))) {
    return new ApiError({
      code: 'backend_unavailable',
      message,
      status,
      retriable: true,
      requestId,
    })
  }
  return new ApiError({
    code: 'api_error',
    message,
    status,
    retriable,
    requestId,
  })
}

// 统一读取 JSON；非 2xx 时提取后端错误体并抛出结构化错误对象。
const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string
      message?: string
      requestId?: string
    } | null
    throw {
      code: body?.code ?? null,
      status: response.status,
      message: body?.message ?? `API request failed with ${response.status}`,
      requestId: body?.requestId ?? response.headers.get('x-request-id'),
    }
  }
  return (await response.json()) as T
}

// 通用 JSON 请求器：超时控制 + 幂等 requestId + 自动重试退避。
export const requestJson = async <T>(
  path: string,
  init: RequestInit = {},
  options: {
    timeoutMs?: number
  } = {},
): Promise<T> => {
  const requestId = buildRequestId()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort('timeout'), timeoutMs)
    const headers = new Headers(init.headers)
    headers.set('x-request-id', requestId)

    try {
      const response = await fetch(`${getApiBaseUrl()}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      })
      window.clearTimeout(timer)
      return await readJson<T>(response)
    } catch (error) {
      window.clearTimeout(timer)

      const isAbortError =
        error instanceof DOMException && error.name === 'AbortError'
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status?: number }).status ?? 0)
          : null
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: string }).message ?? 'API request failed')
          : 'API request failed'
      const retriable =
        isAbortError || status === null || [502, 503, 504].includes(status)
      const apiError = classifyApiError({
        code:
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code?: string | null }).code ?? '')
            : null,
        status,
        message,
        retriable,
        requestId:
          (typeof error === 'object' && error !== null && 'requestId' in error
            ? String((error as { requestId?: string }).requestId ?? requestId)
            : requestId),
      })

      if (!apiError.retriable || attempt === MAX_RETRY_ATTEMPTS) {
        throw apiError
      }

      await sleep(250 * (attempt + 1) * (attempt + 1))
    }
  }

  throw new ApiError({
    code: 'backend_unavailable',
    message: 'API request exhausted retries',
    status: null,
    retriable: true,
    requestId: buildRequestId(),
  })
}

// 创建会话并返回待签名 typedData。
export const createSession = async (player: `0x${string}`) =>
  requestJson<CreateSessionResponse>('/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ player }),
  })

// 提交玩家签名以激活会话。
export const activateSession = async (
  player: `0x${string}`,
  sessionId: `0x${string}`,
  signature: `0x${string}`,
) =>
  requestJson<{ ok: boolean }>('/sessions/activate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      player,
      sessionId,
      signature,
    }),
  })

// 上传单局证据，后端完成证据结构与哈希校验。
export const uploadRunEvidence = async (
  player: `0x${string}`,
  sessionId: `0x${string}`,
  evidence: RunEvidenceV1,
) =>
  requestJson<UploadRunResponse>('/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      player,
      sessionId,
      evidence,
    }),
  })

// 触发会话 finalize，进入链上批量提交流程。
export const finalizeSession = async (
  sessionId: `0x${string}`,
  permitSignature: `0x${string}`,
) =>
  requestJson<FinalizeSessionResponse>(`/sessions/${sessionId}/finalize`, {
    method: 'POST',
    headers: {
      'x-session-signature': permitSignature,
    },
  })

// 拉取会话同步状态（queued/submitted/confirmed/failed 等）。
export const fetchSessionStatus = async (
  sessionId: `0x${string}`,
  permitSignature: `0x${string}`,
) =>
  requestJson<SessionStatusResponse>(`/sessions/${sessionId}/status`, {
    headers: {
      'x-session-signature': permitSignature,
    },
  })

// 读取索引器汇总排行榜。
export const fetchIndexedLeaderboard = async (limit = 20) =>
  requestJson<IndexedLeaderboardRow[]>(`/leaderboard?limit=${limit}`)

// 读取索引器玩家历史，支持 offset/limit 分页。
export const fetchIndexedHistory = async (
  player: `0x${string}`,
  options: { offset?: number; limit?: number } = {},
) =>
  requestJson<IndexedHistoryRow[]>(
    `/history/${player}?offset=${options.offset ?? 0}&limit=${options.limit ?? 20}`,
  )

// 读取索引器运行状态，用于健康检查或调试展示。
export const fetchIndexerStatus = async () => requestJson<IndexerStatusResponse>('/indexer/status')
