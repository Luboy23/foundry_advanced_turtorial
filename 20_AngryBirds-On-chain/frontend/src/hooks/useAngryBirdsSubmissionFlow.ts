import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WalletClient } from 'viem'
import type {
  ActiveSessionGrant,
  LevelCatalogEntry,
  RunSummary,
  RunSyncScope,
  RunSyncState,
} from '../game/types'
import {
  buildRunSyncStorageKey,
  clearRunSyncSnapshot,
  createDefaultRunSyncState,
  hydrateRunSyncState,
  writeRunSyncSnapshot,
} from '../features/progress/localStore'
import {
  ApiError,
  activateSession,
  createSession,
  fetchSessionStatus,
  finalizeSession,
  uploadRunEvidence,
} from '../lib/api'
import { assessActiveSession } from '../lib/sessionGuard'
import { buildEvidenceHash, buildRunId } from '../game/replayHash'

export type SubmitStage =
  | 'idle'
  | 'signing'
  | 'queued'
  | 'validating'
  | 'synced'
  | 'finalizing'
  | 'confirmed'
  | 'error'

type UseAngryBirdsSubmissionFlowOptions = {
  refreshAfterConfirmedRun: (summary: RunSummary) => Promise<unknown>
  selectedLevel: LevelCatalogEntry | null
  syncScope: RunSyncScope
  walletClient: WalletClient | undefined
}

type FinalizeOptions = {
  propagateError?: boolean
}

type SyncError = Error & {
  requiresSessionRenewal?: boolean
}

// 创建带“是否需要重新授权”标记的统一错误对象。
const createSyncError = (message: string, requiresSessionRenewal = false) => {
  const error = new Error(message) as SyncError
  error.requiresSessionRenewal = requiresSessionRenewal
  return error
}

// 将后端/钱包/网络等来源的错误归一化为前端可展示文案与控制标记。
const normalizeSyncError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof ApiError) {
    if (error.code === 'request_timeout') {
      return createSyncError('请求超时，请稍后再试。')
    }
    if (error.code === 'backend_unavailable') {
      return createSyncError('后端暂时不可用，系统会自动重试。')
    }
    if (error.code === 'request_in_progress') {
      return createSyncError('后台仍在处理上一次请求，请稍后自动重试。')
    }
    if (error.code === 'request_id_conflict') {
      return createSyncError('请求去重冲突，请重新发起一次操作。')
    }
    if (error.code === 'validation_failed') {
      return createSyncError(error.message || '证据校验失败。')
    }
    if (error.code === 'relay_failed') {
      return createSyncError(error.message || '链上提交失败。')
    }
    if (error.code === 'session_expired' || error.code === 'session_auth_failed') {
      return createSyncError('本局授权已失效，请返回首页重新授权后再继续。', true)
    }
    if (error.code === 'internal_error') {
      return createSyncError('后端处理失败，请稍后重试。')
    }
  }

  const message =
    error instanceof Error && error.message.trim().length > 0 ? error.message.trim() : fallbackMessage
  const lowerMessage = message.toLowerCase()

  if (
    lowerMessage.includes('user rejected') ||
    lowerMessage.includes('user denied') ||
    lowerMessage.includes('rejected the request') ||
    lowerMessage.includes('user disapproved')
  ) {
    return createSyncError('你已取消本局授权签名。')
  }

  if (
    lowerMessage.includes('session permit expired') ||
    lowerMessage.includes('session not found') ||
    lowerMessage.includes('session must be activated') ||
    lowerMessage.includes('session maxruns exceeded') ||
    lowerMessage.includes('授权已失效') ||
    lowerMessage.includes('重新授权')
  ) {
    return createSyncError('本局授权已失效，请返回首页重新授权后再继续。', true)
  }

  if (error instanceof Error && (error as SyncError).requiresSessionRenewal) {
    return createSyncError(message, true)
  }

  return createSyncError(message)
}

// 判断某条 summary 是否已进入待同步队列，避免重复入队。
const queueIncludesSummary = (queue: RunSummary[], summary: RunSummary) =>
  queue.some((entry) => entry.runId === summary.runId)

// 将本地 summary 绑定到当前 sessionId，并重算 evidenceHash/runId。
const bindSummaryToSession = (summary: RunSummary, sessionId: `0x${string}`): RunSummary => {
  const evidence = {
    ...summary.evidence,
    sessionId,
  }
  const evidenceHash = buildEvidenceHash(evidence)

  return {
    ...summary,
    runId: buildRunId(sessionId, summary.levelId, summary.levelVersion, evidenceHash),
    evidence,
    evidenceHash,
  }
}

const isPendingRelayStatus = (status: string | null | undefined) => status === 'queued' || status === 'submitted'

// 根据当前同步状态推导提交按钮/提示使用的 UI 阶段。
const deriveStageFromSyncState = (state: RunSyncState): SubmitStage => {
  if (state.queue.length > 0) {
    return 'synced'
  }
  if (state.pendingSessionId) {
    if (state.lastStatus === 'confirmed') {
      return 'confirmed'
    }
    if (state.lastStatus === 'failed') {
      return 'error'
    }
    if (isPendingRelayStatus(state.lastStatus)) {
      return 'finalizing'
    }
  }
  return 'idle'
}

// 管理“成绩上传 -> 批量 finalize -> 链上确认”的完整同步状态机。
export const useAngryBirdsSubmissionFlow = ({
  refreshAfterConfirmedRun,
  selectedLevel,
  syncScope,
  walletClient,
}: UseAngryBirdsSubmissionFlowOptions) => {
  const hydratedSyncState = hydrateRunSyncState(syncScope)
  const syncStorageKey = useMemo(
    () =>
      buildRunSyncStorageKey({
        chainId: syncScope.chainId,
        deploymentId: syncScope.deploymentId,
        walletAddress: syncScope.walletAddress,
      }),
    [syncScope.chainId, syncScope.deploymentId, syncScope.walletAddress],
  )
  const [summary, setSummary] = useState<RunSummary | null>(() => hydratedSyncState.queue.at(-1) ?? null)
  const [runSyncState, setRunSyncState] = useState<RunSyncState>(() => hydratedSyncState)
  const [runSyncStateScopeKey, setRunSyncStateScopeKey] = useState(syncStorageKey)
  const [submitStage, setSubmitStage] = useState<SubmitStage>(() => deriveStageFromSyncState(hydratedSyncState))
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [requiresSessionRenewal, setRequiresSessionRenewal] = useState(false)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(() => hydratedSyncState.txHashes.at(-1) ?? null)
  const [isRecoveryMode, setIsRecoveryMode] = useState(
    hydratedSyncState.queue.length > 0 || hydratedSyncState.lastStatus === 'failed',
  )
  const confirmedRefreshKeyRef = useRef<string | null>(null)

  // 持久化最新 runSyncState，支持刷新页面后恢复同步流程。
  useEffect(() => {
    if (runSyncStateScopeKey !== syncStorageKey) {
      return
    }

    writeRunSyncSnapshot(syncScope, {
      schemaVersion: 6,
      chainId: syncScope.chainId,
      deploymentId: syncScope.deploymentId,
      activeSession: runSyncState.activeSession,
      pendingSessionId: runSyncState.pendingSessionId,
      queue: runSyncState.queue,
      txHashes: runSyncState.txHashes,
      lastStatus: runSyncState.lastStatus,
      walletAddress: runSyncState.walletAddress,
      capturedAt: Date.now(),
    })
  }, [runSyncState, runSyncStateScopeKey, syncScope, syncStorageKey])

  // scope（链/部署/钱包）变化时重载快照，防止串账户状态污染。
  useEffect(() => {
    const nextState = hydrateRunSyncState({
      chainId: syncScope.chainId,
      deploymentId: syncScope.deploymentId,
      walletAddress: syncScope.walletAddress,
    })
    setRunSyncStateScopeKey(syncStorageKey)
    setRunSyncState(nextState)
    setSummary(nextState.queue.at(-1) ?? null)
    setSubmitStage(deriveStageFromSyncState(nextState))
    setSubmitError(nextState.lastStatus === 'failed' ? '批量上链失败，后台将继续尝试恢复。' : null)
    setRequiresSessionRenewal(false)
    setTxHash(nextState.txHashes.at(-1) ?? null)
    setIsRecoveryMode(nextState.queue.length > 0 || nextState.lastStatus === 'failed')
    confirmedRefreshKeyRef.current = null
  }, [syncScope.chainId, syncScope.deploymentId, syncScope.walletAddress, syncStorageKey])

  // 当前会话不再可复用时主动清空 activeSession，避免后续误用旧授权。
  useEffect(() => {
    const currentScope = {
      chainId: syncScope.chainId,
      deploymentId: syncScope.deploymentId,
      walletAddress: syncScope.walletAddress,
    }
    if (!runSyncState.activeSession || runSyncState.queue.length > 0 || runSyncState.pendingSessionId) {
      return
    }

    const assessment = assessActiveSession({
      activeSession: runSyncState.activeSession,
      currentWalletAddress: runSyncState.walletAddress,
      queueLength: 0,
      scope: currentScope,
    })
    if (assessment.status === 'ready') {
      return
    }

    setRunSyncState((current) => ({
      ...current,
      activeSession: null,
    }))
    if (submitStage !== 'confirmed') {
      setSubmitStage('idle')
    }
    setRequiresSessionRenewal(false)
  }, [
    runSyncState.activeSession,
    runSyncState.pendingSessionId,
    runSyncState.queue.length,
    runSyncState.walletAddress,
    submitStage,
    syncScope.chainId,
    syncScope.deploymentId,
    syncScope.walletAddress,
  ])

  // 当存在 pendingSessionId 时轮询后端状态，驱动 finalizing/confirmed/error 切换。
  useEffect(() => {
    if (!runSyncState.pendingSessionId) {
      return
    }
    if (runSyncState.lastStatus === 'confirmed') {
      return
    }

    let cancelled = false
    let timer: number | null = null

    const syncStatus = async () => {
      let shouldScheduleNextPoll = true
      const activeSessionGrant = runSyncState.activeSession

      try {
        if (!activeSessionGrant) {
          throw createSyncError('当前会话签名缺失，请返回首页重新授权后再继续。', true)
        }

        const status = await fetchSessionStatus(
          runSyncState.pendingSessionId!,
          activeSessionGrant.permitSignature,
        )
        if (cancelled) {
          return
        }
        setTxHash(status.txHashes.at(-1) ?? null)
        setRunSyncState((current) => {
          if (current.pendingSessionId !== runSyncState.pendingSessionId) {
            return current
          }
          return {
            ...current,
            activeSession: current.activeSession,
            txHashes: status.txHashes,
            lastStatus: status.status,
            pendingSessionId: status.status === 'confirmed' ? null : current.pendingSessionId,
          }
        })

        if (status.status === 'confirmed') {
          shouldScheduleNextPoll = false
          setSubmitStage('confirmed')
          setSubmitError(null)
          setIsRecoveryMode(false)
          return
        }

        if (status.status === 'failed') {
          setSubmitStage('error')
          setSubmitError(status.lastError ?? '批量上链失败，后台将继续尝试恢复。')
          setIsRecoveryMode(true)
        } else if (isPendingRelayStatus(status.status)) {
          setSubmitStage('finalizing')
          setSubmitError(null)
          setIsRecoveryMode(false)
        }
      } catch (error) {
        if (cancelled) {
          return
        }
        const syncError = normalizeSyncError(error, '获取同步状态失败。')
        if (runSyncState.queue.length === 0) {
          shouldScheduleNextPoll = false
          setRunSyncState((current) => {
            if (current.pendingSessionId !== runSyncState.pendingSessionId) {
              return current
            }
            return {
              ...current,
              activeSession: null,
              pendingSessionId: null,
              txHashes: [],
              lastStatus: null,
            }
          })
          setSummary(null)
          setSubmitStage('idle')
          setSubmitError(null)
          setRequiresSessionRenewal(false)
          setTxHash(null)
          setIsRecoveryMode(false)
          return
        }
        setSubmitStage('error')
        setSubmitError(syncError.message)
        setRequiresSessionRenewal(Boolean(syncError.requiresSessionRenewal))
      } finally {
        if (!cancelled && shouldScheduleNextPoll && runSyncState.pendingSessionId) {
          timer = window.setTimeout(syncStatus, 2_500)
        }
      }
    }

    void syncStatus()

    return () => {
      cancelled = true
      if (timer !== null) {
        window.clearTimeout(timer)
      }
    }
  }, [runSyncState.lastStatus, runSyncState.pendingSessionId])

  // 仅在首次进入 confirmed 时触发链上数据刷新，避免重复刷新。
  useEffect(() => {
    if (submitStage !== 'confirmed' || !summary?.cleared) {
      return
    }

    const refreshKey = `${summary.runId}:${summary.evidenceHash}`
    if (confirmedRefreshKeyRef.current === refreshKey) {
      return
    }

    confirmedRefreshKeyRef.current = refreshKey
    void refreshAfterConfirmedRun(summary)
  }, [refreshAfterConfirmedRun, submitStage, summary])

  // 清空本地快照与内存状态，用于完整重置同步流程。
  const resetSyncState = useCallback(() => {
    clearRunSyncSnapshot(syncScope)
    setRunSyncState(createDefaultRunSyncState())
    setSummary(null)
    setSubmitStage('idle')
    setSubmitError(null)
    setRequiresSessionRenewal(false)
    setTxHash(null)
    setIsRecoveryMode(false)
  }, [syncScope])

  // 清理提交流程 UI 状态；若不存在排队任务则直接彻底重置。
  const clearSubmission = useCallback(() => {
    setSummary(null)
    setSubmitError(null)
    setRequiresSessionRenewal(false)
    if (runSyncState.queue.length === 0 && !runSyncState.pendingSessionId) {
      resetSyncState()
      return
    }
    setSubmitStage(deriveStageFromSyncState(runSyncState))
  }, [resetSyncState, runSyncState])

  // 接收场景回合结果并更新可提交状态。
  const acceptSummary = useCallback(
    (nextSummary: RunSummary | null) => {
      if (!nextSummary || !nextSummary.cleared) {
        setSummary(nextSummary)
        setSubmitStage('idle')
        setSubmitError(null)
        setRequiresSessionRenewal(false)
        return
      }

      setSummary(nextSummary)
      setSubmitError(null)
      setRequiresSessionRenewal(false)
      setSubmitStage(queueIncludesSummary(runSyncState.queue, nextSummary) ? 'synced' : 'queued')
    },
    [runSyncState.queue],
  )

  // 触发批量 finalize，把已验证队列交给后端中继上链。
  const finalizeQueuedRuns = useCallback(
    async (options?: FinalizeOptions) => {
      if (!runSyncState.activeSession || runSyncState.queue.length === 0) {
        return true
      }

      setSubmitStage('finalizing')
      setSubmitError(null)
      setRequiresSessionRenewal(false)

      try {
        const finalizeResult = await finalizeSession(
          runSyncState.activeSession.permit.sessionId,
          runSyncState.activeSession.permitSignature,
        )
        setRunSyncState((current) => ({
          ...current,
          activeSession: runSyncState.activeSession,
          pendingSessionId: runSyncState.activeSession?.permit.sessionId ?? null,
          queue: [],
          txHashes: [],
          lastStatus: finalizeResult.status,
        }))
        setTxHash(null)
        setSubmitStage('finalizing')
        setIsRecoveryMode(false)
        return true
      } catch (error) {
        const syncError = normalizeSyncError(error, '批量上链失败。')
        if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
          console.error('[angry-birds] finalize-error', syncError)
        }
        setSubmitStage('error')
        setSubmitError(syncError.message)
        setRequiresSessionRenewal(Boolean(syncError.requiresSessionRenewal))
        if (options?.propagateError) {
          throw syncError
        }
        return false
      }
    },
    [runSyncState.activeSession, runSyncState.queue.length],
  )

  // 确保进入游戏前拥有可用会话：可复用则直用，不可复用则创建并签名新会话。
  const ensureSessionReadyForGameplay = useCallback(async () => {
    if (!walletClient || !walletClient.account) {
      throw createSyncError('钱包未连接。')
    }

    const currentAddress = walletClient.account.address
    let pendingQueueLength = runSyncState.queue.length
    const reusableSession = runSyncState.pendingSessionId ? null : runSyncState.activeSession
    const assessment = assessActiveSession({
      activeSession: reusableSession,
      currentWalletAddress: currentAddress,
      queueLength: runSyncState.queue.length,
      scope: {
        chainId: syncScope.chainId,
        deploymentId: syncScope.deploymentId,
        walletAddress: currentAddress,
      },
    })

    if (assessment.status === 'ready' && reusableSession) {
      setSubmitError(null)
      setRequiresSessionRenewal(false)
      setSubmitStage(runSyncState.queue.length > 0 ? 'synced' : 'idle')
      return reusableSession
    }

    if (assessment.status === 'needs-renewal') {
      if (runSyncState.queue.length > 0 && runSyncState.activeSession) {
        await finalizeQueuedRuns({ propagateError: true })
        pendingQueueLength = 0
      } else {
        setRunSyncState((current) => ({
          ...current,
          activeSession: null,
          pendingSessionId: null,
          walletAddress: currentAddress,
        }))
        pendingQueueLength = 0
      }
    } else if (assessment.status === 'expired') {
      if (runSyncState.queue.length > 0) {
        throw createSyncError('当前会话已过期，请返回首页重新授权后再继续。', true)
      }
      setRunSyncState((current) => ({
        ...current,
        activeSession: null,
        pendingSessionId: null,
        walletAddress: currentAddress,
      }))
    } else if (assessment.status === 'missing') {
      if (runSyncState.queue.length > 0) {
        throw createSyncError('当前待同步战绩仍绑定旧会话，请返回首页重新授权后再继续。', true)
      }
      setRunSyncState((current) => ({
        ...current,
        activeSession: null,
        pendingSessionId: null,
        walletAddress: currentAddress,
      }))
    }

    setSubmitStage('signing')
    setSubmitError(null)
    setRequiresSessionRenewal(false)

    try {
      const session = await createSession(currentAddress)
      const signature = (await walletClient.signTypedData({
        account: walletClient.account,
        domain: session.typedData.domain,
        types: session.typedData.types,
        primaryType: session.typedData.primaryType,
        message: session.typedData.message,
      })) as `0x${string}`
      await activateSession(currentAddress, session.sessionId, signature)

      const activeSession: ActiveSessionGrant = {
        permit: session.permit,
        permitSignature: signature,
      }
      setRunSyncState((current) => ({
        ...current,
        activeSession,
        pendingSessionId: null,
        walletAddress: currentAddress,
        lastStatus: 'active',
      }))
      setSubmitStage(pendingQueueLength > 0 ? 'synced' : 'idle')
      setIsRecoveryMode(false)
      return activeSession
    } catch (error) {
      const syncError = normalizeSyncError(error, '会话授权失败。')
      if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
        console.error('[angry-birds] session-error', syncError)
      }
      setSubmitStage('error')
      setSubmitError(syncError.message)
      setRequiresSessionRenewal(Boolean(syncError.requiresSessionRenewal))
      throw syncError
    }
  }, [
    finalizeQueuedRuns,
    runSyncState.activeSession,
    runSyncState.pendingSessionId,
    runSyncState.queue.length,
    syncScope.chainId,
    syncScope.deploymentId,
    walletClient,
  ])

  // 限制仅在“当前关卡对应 summary”或“已 confirmed”时展示提交状态。
  const selectedLevelMatchesSummary = useMemo(
    () =>
      Boolean(
        summary &&
          selectedLevel &&
          summary.levelId === selectedLevel.levelId &&
          summary.levelVersion === selectedLevel.version,
      ),
    [selectedLevel, summary],
  )

  // 面板上可见的 summary（避免跨关卡误显示上一局结果）。
  const visibleSummary = useMemo(
    () =>
      summary &&
      (!selectedLevel || submitStage === 'confirmed' || selectedLevelMatchesSummary)
        ? summary
        : null,
    [selectedLevel, selectedLevelMatchesSummary, submitStage, summary],
  )

  // 面板上可见 submitStage（跨关卡时回退到更保守状态）。
  const visibleSubmitStage = useMemo(() => {
    if (!summary || !selectedLevel || submitStage === 'confirmed' || selectedLevelMatchesSummary) {
      return submitStage
    }

    return runSyncState.queue.length > 0 ? 'synced' : 'idle'
  }, [runSyncState.queue.length, selectedLevel, selectedLevelMatchesSummary, submitStage, summary])

  // 面板上可见错误信息（跨关卡时隐藏历史错误）。
  const visibleSubmitError = useMemo(() => {
    if (!summary || !selectedLevel || submitStage === 'confirmed' || selectedLevelMatchesSummary) {
      return submitError
    }

    return null
  }, [selectedLevel, selectedLevelMatchesSummary, submitError, submitStage, summary])

  // 上传单局证据到后端并进入“已验证待上链”队列。
  const submitRun = useCallback(
    async (nextSummary?: RunSummary | null) => {
      const candidateSummary =
        nextSummary ??
        (summary &&
        (!selectedLevel || submitStage === 'confirmed' || selectedLevelMatchesSummary)
          ? summary
          : null)
      if (!candidateSummary || !candidateSummary.cleared || !walletClient || !walletClient.account) {
        return
      }

      if (queueIncludesSummary(runSyncState.queue, candidateSummary)) {
        setSubmitStage('synced')
        setRequiresSessionRenewal(false)
        return
      }

      setSubmitStage('validating')
      setSubmitError(null)
      setRequiresSessionRenewal(false)

      try {
        const assessment = assessActiveSession({
          activeSession: runSyncState.activeSession,
          currentWalletAddress: walletClient.account.address,
          queueLength: runSyncState.queue.length,
          scope: {
            chainId: syncScope.chainId,
            deploymentId: syncScope.deploymentId,
            walletAddress: walletClient.account.address,
          },
        })
        if (assessment.status !== 'ready' || !runSyncState.activeSession) {
          throw createSyncError('本局授权已失效，请返回首页重新授权后再继续。', true)
        }

        const scopedSummary = bindSummaryToSession(
          candidateSummary,
          runSyncState.activeSession.permit.sessionId,
        )
        const uploadResult = await uploadRunEvidence(
          walletClient.account.address,
          runSyncState.activeSession.permit.sessionId,
          scopedSummary.evidence,
        )
        if (uploadResult.run.runId !== scopedSummary.runId) {
          throw createSyncError('本地 runId 与后端返回不一致，已拒绝继续同步。')
        }
        setRunSyncState((current) => ({
          ...current,
          activeSession: runSyncState.activeSession,
          pendingSessionId: null,
          walletAddress: walletClient.account?.address,
          queue: [...current.queue, scopedSummary],
          lastStatus: 'validated',
        }))
        setSummary(scopedSummary)
        setSubmitStage('synced')
        setIsRecoveryMode(false)
      } catch (error) {
        const syncError = normalizeSyncError(error, '成绩同步失败。')
        if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
          console.error('[angry-birds] sync-error', syncError)
        }
        setSubmitStage('error')
        setSubmitError(syncError.message)
        setRequiresSessionRenewal(Boolean(syncError.requiresSessionRenewal))
      }
    },
    [
      runSyncState.activeSession,
      runSyncState.queue,
      selectedLevel,
      selectedLevelMatchesSummary,
      submitStage,
      summary,
      syncScope,
      walletClient,
    ],
  )

  // 计算“提交按钮是否可点击”。
  const canSubmit = useMemo(
    () =>
      Boolean(
        visibleSummary &&
          visibleSummary.cleared &&
          walletClient &&
          selectedLevel &&
          !queueIncludesSummary(runSyncState.queue, visibleSummary) &&
          !requiresSessionRenewal &&
          (visibleSubmitStage === 'error' || visibleSubmitStage === 'idle'),
      ),
    [
      requiresSessionRenewal,
      runSyncState.queue,
      selectedLevel,
      visibleSubmitStage,
      visibleSummary,
      walletClient,
    ],
  )

  return {
    latestSummary: summary,
    summary: visibleSummary,
    submitStage: visibleSubmitStage,
    lastStatus: runSyncState.lastStatus,
    submitError: visibleSubmitError,
    requiresSessionRenewal,
    txHash,
    isRecoveryMode,
    canSubmit,
    queuedRuns: runSyncState.queue.length,
    activeSession: runSyncState.activeSession,
    acceptSummary,
    clearSubmission,
    ensureSessionReadyForGameplay,
    submitRun,
    finalizeQueuedRuns,
  }
}
