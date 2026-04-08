import { BRAVEMAN_API_BASE_URL } from './chain'
import type { EndReason, InputEvent } from '../game/types'

/** `/api/sessions` 成功响应：前端据此启动本地模拟并绑定规则版本。 */
export type SessionResponse = {
  sessionId: `0x${string}`
  seed: string
  expiresAt: string
  bowUnlocked: boolean
  rulesetMeta: {
    rulesetVersion: number
    configHash: `0x${string}`
  }
}

/** `/api/settlements/verify` 请求体：提交本地输入日志与本地结算摘要。 */
export type VerifyRequest = {
  player: `0x${string}`
  sessionId: `0x${string}`
  rulesetVersion: number
  configHash: `0x${string}`
  logs: InputEvent[]
  localSummary: {
    kills: number
    survivalMs: number
    goldEarned: number
    endReason: EndReason
  }
}

/** `/api/settlements/verify` 成功响应：后端重放通过后返回 settlement + 签名。 */
export type VerifyResponse = {
  settlement: {
    sessionId: `0x${string}`
    player: `0x${string}`
    kills: number
    survivalMs: number
    goldEarned: number
    endedAt: number
    rulesetVersion: number
    configHash: `0x${string}`
  }
  signature: `0x${string}`
  replaySummary: {
    kills: number
    survivalMs: number
    goldEarned: number
    endReason: EndReason
  }
}

/** 后端统一错误结构，供前端判定是否可重试。 */
export type ApiErrorPayload = {
  code: string
  message: string
  retryable: boolean
}

type RequestOptions = {
  timeoutMs?: number
  signal?: AbortSignal
  dedupeKey?: string
}

const requestControllers = new Map<string, AbortController>()

/** 健康检查响应：用于开始按钮与状态提示。 */
export type ApiHealthResponse = {
  ok: boolean
  message?: string | null
}

/** 归一化会话响应命名（后端已是 camelCase，这里保留显式映射便于演进）。 */
const toCamelSession = (payload: {
  sessionId: `0x${string}`
  seed: string
  expiresAt: string
  bowUnlocked: boolean
  rulesetMeta: { rulesetVersion: number; configHash: `0x${string}` }
}): SessionResponse => ({
  sessionId: payload.sessionId,
  seed: payload.seed,
  expiresAt: payload.expiresAt,
  bowUnlocked: payload.bowUnlocked,
  rulesetMeta: {
    rulesetVersion: payload.rulesetMeta.rulesetVersion,
    configHash: payload.rulesetMeta.configHash,
  },
})

const abortWith = (controller: AbortController, reason: unknown) => {
  try {
    controller.abort(reason)
  } catch {
    controller.abort()
  }
}

const toApiError = (
  code: string,
  message: string,
  retryable: boolean,
): ApiErrorPayload => ({
  code,
  message,
  retryable,
})

const isAbortError = (error: unknown): error is DOMException =>
  error instanceof DOMException && error.name === 'AbortError'

export const isApiErrorPayload = (value: unknown): value is ApiErrorPayload => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.code === 'string'
    && typeof candidate.message === 'string'
    && typeof candidate.retryable === 'boolean'
}

/**
 * 通用请求封装：
 * 1) 统一拼接 API Base URL；
 * 2) 统一 JSON 头；
 * 3) 统一网络错误与 HTTP 错误处理格式。
 */
const request = async <T>(path: string, init: RequestInit, options: RequestOptions = {}): Promise<T> => {
  const {
    timeoutMs = 10_000,
    signal,
    dedupeKey,
  } = options
  const controller = new AbortController()
  const currentController = controller
  let abortedByTimeout = false
  let timeoutId = 0
  let removeExternalListener: (() => void) | null = null

  if (dedupeKey) {
    const previousController = requestControllers.get(dedupeKey)
    if (previousController) {
      abortWith(previousController, 'REQUEST_SUPERSEDED')
    }
    requestControllers.set(dedupeKey, currentController)
  }

  if (signal) {
    if (signal.aborted) {
      abortWith(currentController, signal.reason)
    } else {
      const forwardAbort = () => abortWith(currentController, signal.reason)
      signal.addEventListener('abort', forwardAbort, { once: true })
      removeExternalListener = () => signal.removeEventListener('abort', forwardAbort)
    }
  }

  timeoutId = globalThis.setTimeout(() => {
    abortedByTimeout = true
    abortWith(currentController, 'REQUEST_TIMEOUT')
  }, timeoutMs)

  let response: Response
  try {
    // 统一挂载 API base URL，避免业务层重复拼接。
    response = await fetch(`${BRAVEMAN_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      signal: currentController.signal,
    })
  } catch (error) {
    if (isAbortError(error)) {
      if (abortedByTimeout) {
        throw toApiError('REQUEST_TIMEOUT', '请求超时，请确认本地服务仍在运行后重试。', true)
      }
      throw toApiError('REQUEST_ABORTED', '请求已取消。', true)
    }
    // 网络层失败（服务未启动/端口不可达）统一映射为可重试错误。
    throw toApiError(
      'NETWORK_ERROR',
      '对局服务连接失败，请确认 make dev 已启动，且本地链与后端服务仍在运行。',
      true,
    )
  } finally {
    if (timeoutId) globalThis.clearTimeout(timeoutId)
    removeExternalListener?.()
    if (dedupeKey && requestControllers.get(dedupeKey) === currentController) {
      requestControllers.delete(dedupeKey)
    }
  }

  const text = await response.text()
  const data = text ? safeJsonParse(text) : null

  if (!response.ok) {
    // 优先透传后端业务错误；若格式不符则回退到通用 HTTP 错误。
    throw (isApiErrorPayload(data)
      ? data
      : toApiError(
          'HTTP_ERROR',
          '对局服务暂时不可用，请稍后重试。',
          response.status >= 500,
        ))
  }

  return data as T
}

/** 安全 JSON 解析，解析失败时返回 null，避免抛出二次异常。 */
const safeJsonParse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** 创建一局 session，返回 seed、过期时间与规则元数据。 */
export const createSession = async (
  player: `0x${string}`,
  options?: Pick<RequestOptions, 'signal'>,
): Promise<SessionResponse> => {
  // 开局阶段只提交 player 地址，剩余 session 信息由后端生成并返回。
  const payload = await request<{
    sessionId: `0x${string}`
    seed: string
    expiresAt: string
    bowUnlocked: boolean
    rulesetMeta: { rulesetVersion: number; configHash: `0x${string}` }
  }>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ player }),
  }, {
    timeoutMs: 10_000,
    dedupeKey: 'create-session',
    signal: options?.signal,
  })

  return toCamelSession(payload)
}

/** 提交本地日志到后端复盘并请求签名结算。 */
export const verifySettlement = async (
  payload: VerifyRequest,
  options?: Pick<RequestOptions, 'signal'>,
): Promise<VerifyResponse> => {
  // 显式展开字段，避免未来对象结构变动造成隐式透传问题。
  return request<VerifyResponse>('/api/settlements/verify', {
    method: 'POST',
    body: JSON.stringify({
      player: payload.player,
      sessionId: payload.sessionId,
      rulesetVersion: payload.rulesetVersion,
      configHash: payload.configHash,
      logs: payload.logs,
      localSummary: {
        kills: payload.localSummary.kills,
        survivalMs: payload.localSummary.survivalMs,
        goldEarned: payload.localSummary.goldEarned,
        endReason: payload.localSummary.endReason,
      },
    }),
  }, {
    timeoutMs: 20_000,
    dedupeKey: 'verify-settlement',
    signal: options?.signal,
  })
}

/** 查询后端健康状态，用于开始按钮可用性判断。 */
export const getApiHealth = async (options?: Pick<RequestOptions, 'signal'>): Promise<ApiHealthResponse> => {
  return request<ApiHealthResponse>('/api/health', { method: 'GET' }, {
    timeoutMs: 3_000,
    signal: options?.signal,
  })
}
