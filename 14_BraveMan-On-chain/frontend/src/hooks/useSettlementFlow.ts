import { useCallback, useEffect, useRef, useState } from 'react'

import type { SessionStats } from '../game/types'
import { type ApiErrorPayload, verifySettlement } from '../lib/api'
import {
  BRAVEMAN_ABI,
  BRAVEMAN_ADDRESS,
  settlementToArgs,
  type SettlementPayload,
} from '../lib/contract'
import { formatTxError } from '../lib/txError'
import type { ToastInput } from '../features/toast/ToastViewport'

export type SubmitStage = 'idle' | 'verifying' | 'signing' | 'pending' | 'success' | 'error'
export type PendingClaim = { settlement: SettlementPayload; signature: `0x${string}` }
export type SettlementPreview = Pick<SessionStats, 'sessionId' | 'kills' | 'survivalMs' | 'goldEarned' | 'endReason'>

type CachedSettlementRecovery = {
  pendingClaim: PendingClaim
  preview: SettlementPreview
  txHash: `0x${string}` | null
}

type UseSettlementFlowOptions = {
  effectiveAddress?: `0x${string}`
  sendContractAndConfirm: (
    config: Record<string, unknown>,
    onSubmitted?: (hash: `0x${string}`) => void,
  ) => Promise<`0x${string}`>
  invalidateChainData: () => Promise<unknown>
  showToast: (toast: ToastInput) => void
}

/** sessionStorage: 已拿到签名、等待或可重试上链的 claim 数据。 */
export const CLAIM_CACHE_KEY = 'braveman.pending-claim.v1'
/** sessionStorage: 结算弹窗展示用的轻量摘要。 */
export const CLAIM_PREVIEW_CACHE_KEY = 'braveman.pending-claim-preview.v1'
/** sessionStorage: 已提交但页面可能刷新时保留的交易哈希。 */
export const CLAIM_TX_HASH_CACHE_KEY = 'braveman.pending-claim-tx-hash.v1'

/** 从 sessionStorage 读取缓存的 signed claim；读取失败时回退为 null。 */
const readCachedClaim = (): PendingClaim | null => {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(CLAIM_CACHE_KEY)
    return raw ? JSON.parse(raw) as PendingClaim : null
  } catch {
    return null
  }
}

/** 写入或清空缓存的 signed claim。 */
const writeCachedClaim = (value: PendingClaim | null) => {
  if (typeof window === 'undefined') return

  if (!value) {
    window.sessionStorage.removeItem(CLAIM_CACHE_KEY)
    return
  }

  window.sessionStorage.setItem(CLAIM_CACHE_KEY, JSON.stringify(value))
}

/** 读取结算弹窗展示用的摘要缓存。 */
const readCachedPreview = (): SettlementPreview | null => {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(CLAIM_PREVIEW_CACHE_KEY)
    return raw ? JSON.parse(raw) as SettlementPreview : null
  } catch {
    return null
  }
}

/** 写入或清空摘要缓存。 */
const writeCachedPreview = (value: SettlementPreview | null) => {
  if (typeof window === 'undefined') return

  if (!value) {
    window.sessionStorage.removeItem(CLAIM_PREVIEW_CACHE_KEY)
    return
  }

  window.sessionStorage.setItem(CLAIM_PREVIEW_CACHE_KEY, JSON.stringify(value))
}

/** 读取最近一次已提交交易的哈希，用于刷新后恢复展示。 */
const readCachedTxHash = (): `0x${string}` | null => {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(CLAIM_TX_HASH_CACHE_KEY)
    return raw ? raw as `0x${string}` : null
  } catch {
    return null
  }
}

/** 写入或清空交易哈希缓存。 */
const writeCachedTxHash = (value: `0x${string}` | null) => {
  if (typeof window === 'undefined') return

  if (!value) {
    window.sessionStorage.removeItem(CLAIM_TX_HASH_CACHE_KEY)
    return
  }

  window.sessionStorage.setItem(CLAIM_TX_HASH_CACHE_KEY, value)
}

/** 将三段缓存重新组合为一个“可恢复结算态”。 */
const readCachedSettlementRecovery = (): CachedSettlementRecovery | null => {
  const pendingClaim = readCachedClaim()
  const preview = readCachedPreview()

  if (!pendingClaim || !preview) return null

  return {
    pendingClaim,
    preview,
    txHash: readCachedTxHash(),
  }
}

/** 一次性写入或清空完整恢复态，避免三段缓存不一致。 */
const writeCachedSettlementRecovery = (value: CachedSettlementRecovery | null) => {
  writeCachedClaim(value?.pendingClaim ?? null)
  writeCachedPreview(value?.preview ?? null)
  writeCachedTxHash(value?.txHash ?? null)
}

/** 从完整 `SessionStats` 中提取结算弹窗真正需要的轻量字段。 */
const toSettlementPreview = (stats: SessionStats): SettlementPreview => ({
  sessionId: stats.sessionId,
  kills: stats.kills,
  survivalMs: stats.survivalMs,
  goldEarned: stats.goldEarned,
  endReason: stats.endReason,
})

/**
 * 管理 BraveMan 的 verify -> claim 结算状态机。
 * 负责缓存恢复、后端重放校验、链上 claim、失败重试以及结算弹窗展示态。
 */
export const useSettlementFlow = ({
  effectiveAddress,
  sendContractAndConfirm,
  invalidateChainData,
  showToast,
}: UseSettlementFlowOptions) => {
  const cachedRecovery = readCachedSettlementRecovery()
  const verifyAbortRef = useRef<AbortController | null>(null)
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null)
  const [settlementPreview, setSettlementPreview] = useState<SettlementPreview | null>(() => cachedRecovery?.preview ?? null)
  const [pendingClaim, setPendingClaim] = useState<PendingClaim | null>(() => cachedRecovery?.pendingClaim ?? null)
  const [submitStage, setSubmitStage] = useState<SubmitStage>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(() => cachedRecovery?.txHash ?? null)
  const [isSettlementOpen, setIsSettlementOpen] = useState(() => Boolean(cachedRecovery))
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => Boolean(cachedRecovery))

  /** 组件卸载时中止仍在进行中的 verify 请求，避免旧响应污染新页面。 */
  useEffect(() => () => verifyAbortRef.current?.abort(), [])

  /** 清空本地恢复缓存，通常在成功上链或主动放弃时调用。 */
  const clearCachedSettlementRecovery = useCallback(() => {
    writeCachedSettlementRecovery(null)
  }, [])

  /**
   * 直接拿已签名 settlement 发起链上 claim。
   * 该路径既用于 verify 成功后的首次上链，也用于页面刷新后的恢复重试。
   */
  const claimSettlementOnChain = useCallback(async (
    claim: PendingClaim,
    preview: SettlementPreview | null,
  ) => {
    if (!BRAVEMAN_ADDRESS) throw new Error('合约地址未配置')

    // “signing” 在这里表示钱包确认交易请求的阶段，而不是后端 EIP-712 签名。
    setSubmitStage('signing')
    setSubmitError(null)
    setTxHash(null)

    const hash = await sendContractAndConfirm(
      {
        address: BRAVEMAN_ADDRESS,
        abi: BRAVEMAN_ABI,
        functionName: 'claimSettlement',
        args: [settlementToArgs(claim.settlement), claim.signature],
      },
      (submittedHash) => {
        // 交易一旦发出就立即缓存，便于页面刷新后恢复“待确认”状态。
        setTxHash(submittedHash)
        setSubmitStage('pending')
        if (preview) {
          writeCachedSettlementRecovery({
            pendingClaim: claim,
            preview,
            txHash: submittedHash,
          })
        }
      },
    )

    setSubmitStage('success')
    clearCachedSettlementRecovery()
    setPendingClaim(null)
    setIsRecoveryMode(false)
    await invalidateChainData()
    showToast({
      message: '战绩已成功上链',
      tone: 'success',
    })
    return hash
  }, [clearCachedSettlementRecovery, invalidateChainData, sendContractAndConfirm, showToast])

  /**
   * 先把本局日志提交给后端重放校验，再在通过后立刻发起链上 claim。
   * 这是 BraveMan 可信结算的主链路。
   */
  const verifyAndClaim = useCallback(async (stats: SessionStats) => {
    if (!effectiveAddress) {
      const message = '钱包已断开，请重新连接后重试结算'
      setSubmitStage('error')
      setSubmitError(message)
      showToast({
        message,
        tone: 'error',
        persistent: true,
      })
      return
    }

    // 新一轮 verify 会主动打断上一轮请求，避免旧结果覆盖新状态。
    verifyAbortRef.current?.abort()
    const nextVerifyController = new AbortController()
    verifyAbortRef.current = nextVerifyController
    setSubmitStage('verifying')
    setSubmitError(null)
    setTxHash(null)
    const preview = toSettlementPreview(stats)
    setSettlementPreview(preview)

    try {
      // 后端会基于 session/logs/localSummary 做重放一致性校验并返回签名。
      const response = await verifySettlement({
        player: effectiveAddress,
        sessionId: stats.sessionId,
        rulesetVersion: stats.rulesetVersion,
        configHash: stats.configHash,
        logs: stats.logs,
        localSummary: {
          kills: stats.kills,
          survivalMs: stats.survivalMs,
          goldEarned: stats.goldEarned,
          endReason: stats.endReason,
        },
      }, {
        signal: nextVerifyController.signal,
      })

      const nextClaim = { settlement: response.settlement, signature: response.signature }
      // verify 成功即缓存签名，确保钱包拒签或页面刷新后仍可继续 claim。
      writeCachedSettlementRecovery({
        pendingClaim: nextClaim,
        preview,
        txHash: null,
      })
      setPendingClaim(nextClaim)
      await claimSettlementOnChain(nextClaim, preview)
    } catch (error) {
      const apiError = error as Partial<ApiErrorPayload>
      if (apiError.code === 'REQUEST_ABORTED') return
      const message = apiError.message || formatTxError(error)
      setSubmitStage('error')
      setSubmitError(message)
      showToast({
        message,
        tone: 'error',
        persistent: true,
      })
    }
  }, [claimSettlementOnChain, effectiveAddress, showToast])

  /** 游戏终局入口：打开结算弹窗，并立即进入 verify -> claim 流程。 */
  const openSettlementForGameOver = useCallback(async (stats: SessionStats) => {
    setSessionStats(stats)
    setSettlementPreview(toSettlementPreview(stats))
    setIsRecoveryMode(false)
    setIsSettlementOpen(true)
    await verifyAndClaim(stats)
  }, [verifyAndClaim])

  /** 重试结算：优先复用已签名 claim；若没有签名则重新向后端发起 verify。 */
  const retrySettlement = useCallback(async () => {
    if (pendingClaim) {
      try {
        await claimSettlementOnChain(pendingClaim, settlementPreview)
      } catch (error) {
        const message = formatTxError(error)
        setSubmitStage('error')
        setSubmitError(message)
        showToast({
          message,
          tone: 'error',
          persistent: true,
        })
      }
      return
    }

    if (sessionStats) {
      await verifyAndClaim(sessionStats)
      return
    }

    const message = '缺少可重试的结算数据，请重新开始一局'
    setSubmitStage('error')
    setSubmitError(message)
    showToast({
      message,
      tone: 'error',
      persistent: true,
    })
  }, [claimSettlementOnChain, pendingClaim, sessionStats, settlementPreview, showToast, verifyAndClaim])

  /** 放弃刷新后恢复出来的本地缓存，彻底关闭恢复态结算弹窗。 */
  const discardRecoveredSettlement = useCallback(() => {
    verifyAbortRef.current?.abort()
    clearCachedSettlementRecovery()
    setPendingClaim(null)
    setSettlementPreview(null)
    setSessionStats(null)
    setSubmitStage('idle')
    setSubmitError(null)
    setTxHash(null)
    setIsRecoveryMode(false)
    setIsSettlementOpen(false)
  }, [clearCachedSettlementRecovery])

  /** 关闭结算弹窗；处理中和自动返回阶段禁止关闭，避免用户误操作打断流程。 */
  const closeSettlement = useCallback(() => {
    const isSettlementLocked =
      submitStage === 'verifying' || submitStage === 'signing' || submitStage === 'pending'
    const isSettlementAutoReturning = isSettlementOpen && submitStage === 'success'

    if (isSettlementLocked || isSettlementAutoReturning) return
    setIsSettlementOpen(false)
  }, [isSettlementOpen, submitStage])

  /** 回到大厅时重置整套结算状态机，并清空所有本地恢复缓存。 */
  const resetSettlementFlow = useCallback(() => {
    setIsSettlementOpen(false)
    setSessionStats(null)
    setSettlementPreview(null)
    setPendingClaim(null)
    setSubmitStage('idle')
    setSubmitError(null)
    setTxHash(null)
    setIsRecoveryMode(false)
    clearCachedSettlementRecovery()
  }, [clearCachedSettlementRecovery])

  // 这些派生状态用于驱动结算弹窗按钮可用性与阶段文案。
  const isSettlementLocked =
    submitStage === 'verifying' || submitStage === 'signing' || submitStage === 'pending'
  const isSettlementAutoReturning = isSettlementOpen && submitStage === 'success'
  const canRetry = submitStage === 'error' && (!!pendingClaim || !!sessionStats)
  const submitStatusText = submitStage === 'idle'
    ? isRecoveryMode
      ? '检测到上次未完成结算，你可以继续上链或放弃本地缓存。'
      : '等待结算开始...'
    : submitStage === 'verifying'
      ? '系统正在复盘本局'
      : submitStage === 'signing'
        ? '请在钱包中签名确认'
        : submitStage === 'pending'
          ? '交易已发出，等待链上确认'
          : submitStage === 'success'
            ? '战绩已成功上链，正在返回待机界面...'
            : '上链失败，请重试'

  return {
    // 这里暴露的是轻量预览数据，而不是完整 SessionStats，供弹窗稳定展示。
    sessionStats: settlementPreview,
    pendingClaim,
    submitStage,
    submitError,
    txHash,
    isSettlementOpen,
    isSettlementLocked,
    isSettlementAutoReturning,
    isRecoveryMode,
    submitStatusText,
    canRetry,
    openSettlementForGameOver,
    verifyAndClaim,
    retrySettlement,
    discardRecoveredSettlement,
    closeSettlement,
    resetSettlementFlow,
  }
}
