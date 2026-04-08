import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** 集中管理 verify mock，便于在不同用例里切换成功/失败/恢复态分支。 */
const hookMocks = vi.hoisted(() => ({
  verifySettlement: vi.fn(),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    verifySettlement: hookMocks.verifySettlement,
  }
})

vi.mock('../lib/contract', async () => {
  const actual = await vi.importActual<typeof import('../lib/contract')>('../lib/contract')
  return {
    ...actual,
    BRAVEMAN_ADDRESS: '0x1111111111111111111111111111111111111111',
    BRAVEMAN_ADDRESS_VALID: true,
  }
})

import {
  CLAIM_CACHE_KEY,
  CLAIM_PREVIEW_CACHE_KEY,
  CLAIM_TX_HASH_CACHE_KEY,
  useSettlementFlow,
} from './useSettlementFlow'

/** 一局正常战斗结束后的最小结算样本。 */
const sessionStats = {
  sessionId: '0x1111111111111111111111111111111111111111111111111111111111111111' as const,
  rulesetVersion: 1,
  configHash: '0x2222222222222222222222222222222222222222222222222222222222222222' as const,
  kills: 12,
  survivalMs: 43820,
  goldEarned: 15,
  endReason: 'death' as const,
  inputSource: 'keyboard' as const,
  logs: [],
}

/** 后端 verify 成功后的签名响应，用于驱动 claim 主链路测试。 */
const verifyResponse = {
  settlement: {
    sessionId: '0x1111111111111111111111111111111111111111111111111111111111111111' as const,
    player: '0x1111111111111111111111111111111111111111' as const,
    kills: 12,
    survivalMs: 43820,
    goldEarned: 15,
    endedAt: 1711111111,
    rulesetVersion: 1,
    configHash: '0x2222222222222222222222222222222222222222222222222222222222222222' as const,
  },
  signature: '0x3333333333333333333333333333333333333333333333333333333333333333' as const,
  replaySummary: {
    kills: 12,
    survivalMs: 43820,
    goldEarned: 15,
    endReason: 'death' as const,
  },
}

describe('useSettlementFlow', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    hookMocks.verifySettlement.mockReset()
    hookMocks.verifySettlement.mockResolvedValue(verifyResponse)
  })

  it('clears cached claim state after a successful settlement', async () => {
    // 前置条件：verify 成功且链上 claim 也成功，缓存应在流程结束后被清空。
    const sendContractAndConfirm = vi.fn(async (
      _config: Record<string, unknown>,
      onSubmitted?: (hash: `0x${string}`) => void,
    ) => {
      const hash = '0x4444444444444444444444444444444444444444444444444444444444444444' as const
      onSubmitted?.(hash)
      return hash
    })
    const invalidateChainData = vi.fn().mockResolvedValue(undefined)
    const showToast = vi.fn()

    const { result } = renderHook(() => useSettlementFlow({
      effectiveAddress: '0x1111111111111111111111111111111111111111',
      sendContractAndConfirm,
      invalidateChainData,
      showToast,
    }))

    await act(async () => {
      await result.current.openSettlementForGameOver(sessionStats)
    })

    expect(hookMocks.verifySettlement).toHaveBeenCalledTimes(1)
    expect(sendContractAndConfirm).toHaveBeenCalledTimes(1)
    expect(result.current.isSettlementOpen).toBe(true)
    expect(result.current.submitStage).toBe('success')
    expect(result.current.txHash).toBe('0x4444444444444444444444444444444444444444444444444444444444444444')
    expect(window.sessionStorage.getItem(CLAIM_CACHE_KEY)).toBeNull()
    expect(window.sessionStorage.getItem(CLAIM_PREVIEW_CACHE_KEY)).toBeNull()
    expect(window.sessionStorage.getItem(CLAIM_TX_HASH_CACHE_KEY)).toBeNull()
    expect(invalidateChainData).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith({
      message: '战绩已成功上链',
      tone: 'success',
    })
  })

  it('retries directly on-chain when a cached signed claim already exists', async () => {
    // 前置条件：第一次链上提交失败，但本地已缓存 signed claim；重试时不应重新 verify。
    const sendContractAndConfirm = vi.fn()
      .mockImplementationOnce(async (
        _config: Record<string, unknown>,
        onSubmitted?: (hash: `0x${string}`) => void,
      ) => {
        const hash = '0x5555555555555555555555555555555555555555555555555555555555555555' as const
        onSubmitted?.(hash)
        throw new Error('wallet rejected')
      })
      .mockImplementationOnce(async (
        _config: Record<string, unknown>,
        onSubmitted?: (hash: `0x${string}`) => void,
      ) => {
        const hash = '0x6666666666666666666666666666666666666666666666666666666666666666' as const
        onSubmitted?.(hash)
        return hash
      })
    const invalidateChainData = vi.fn().mockResolvedValue(undefined)
    const showToast = vi.fn()

    const { result } = renderHook(() => useSettlementFlow({
      effectiveAddress: '0x1111111111111111111111111111111111111111',
      sendContractAndConfirm,
      invalidateChainData,
      showToast,
    }))

    await act(async () => {
      await result.current.openSettlementForGameOver(sessionStats)
    })

    expect(hookMocks.verifySettlement).toHaveBeenCalledTimes(1)
    expect(sendContractAndConfirm).toHaveBeenCalledTimes(1)
    expect(result.current.submitStage).toBe('error')
    expect(result.current.canRetry).toBe(true)
    expect(window.sessionStorage.getItem(CLAIM_CACHE_KEY)).not.toBeNull()

    await act(async () => {
      await result.current.retrySettlement()
    })

    expect(hookMocks.verifySettlement).toHaveBeenCalledTimes(1)
    expect(sendContractAndConfirm).toHaveBeenCalledTimes(2)
    expect(result.current.submitStage).toBe('success')
    expect(window.sessionStorage.getItem(CLAIM_CACHE_KEY)).toBeNull()
    expect(window.sessionStorage.getItem(CLAIM_PREVIEW_CACHE_KEY)).toBeNull()
    expect(window.sessionStorage.getItem(CLAIM_TX_HASH_CACHE_KEY)).toBeNull()
  })

  it('reruns verify on retry when there is no cached signed claim', async () => {
    // 前置条件：首次 verify 失败，因此没有 signed claim；重试时应重新走后端复盘。
    hookMocks.verifySettlement
      .mockRejectedValueOnce(new Error('服务暂不可用'))
      .mockResolvedValueOnce(verifyResponse)

    const sendContractAndConfirm = vi.fn(async (
      _config: Record<string, unknown>,
      onSubmitted?: (hash: `0x${string}`) => void,
    ) => {
      const hash = '0x7777777777777777777777777777777777777777777777777777777777777777' as const
      onSubmitted?.(hash)
      return hash
    })
    const invalidateChainData = vi.fn().mockResolvedValue(undefined)
    const showToast = vi.fn()

    const { result } = renderHook(() => useSettlementFlow({
      effectiveAddress: '0x1111111111111111111111111111111111111111',
      sendContractAndConfirm,
      invalidateChainData,
      showToast,
    }))

    await act(async () => {
      await result.current.openSettlementForGameOver(sessionStats)
    })

    expect(hookMocks.verifySettlement).toHaveBeenCalledTimes(1)
    expect(sendContractAndConfirm).toHaveBeenCalledTimes(0)
    expect(result.current.submitStage).toBe('error')
    expect(result.current.canRetry).toBe(true)
    expect(window.sessionStorage.getItem(CLAIM_CACHE_KEY)).toBeNull()

    await act(async () => {
      await result.current.retrySettlement()
    })

    expect(hookMocks.verifySettlement).toHaveBeenCalledTimes(2)
    expect(sendContractAndConfirm).toHaveBeenCalledTimes(1)
    expect(result.current.submitStage).toBe('success')
  })

  it('restores cached pending settlement into recovery mode on page reload', async () => {
    // 前置条件：sessionStorage 中已有未完成结算缓存，页面刷新后应恢复为 recovery mode。
    window.sessionStorage.setItem(CLAIM_CACHE_KEY, JSON.stringify({
      settlement: verifyResponse.settlement,
      signature: verifyResponse.signature,
    }))
    window.sessionStorage.setItem(CLAIM_PREVIEW_CACHE_KEY, JSON.stringify({
      sessionId: sessionStats.sessionId,
      kills: sessionStats.kills,
      survivalMs: sessionStats.survivalMs,
      goldEarned: sessionStats.goldEarned,
      endReason: sessionStats.endReason,
    }))
    window.sessionStorage.setItem(
      CLAIM_TX_HASH_CACHE_KEY,
      '0x8888888888888888888888888888888888888888888888888888888888888888',
    )

    const { result } = renderHook(() => useSettlementFlow({
      effectiveAddress: '0x1111111111111111111111111111111111111111',
      sendContractAndConfirm: vi.fn(),
      invalidateChainData: vi.fn(),
      showToast: vi.fn(),
    }))

    expect(result.current.isSettlementOpen).toBe(true)
    expect(result.current.isRecoveryMode).toBe(true)
    expect(result.current.submitStage).toBe('idle')
    expect(result.current.sessionStats).toEqual({
      sessionId: sessionStats.sessionId,
      kills: sessionStats.kills,
      survivalMs: sessionStats.survivalMs,
      goldEarned: sessionStats.goldEarned,
      endReason: sessionStats.endReason,
    })
    expect(result.current.txHash).toBe('0x8888888888888888888888888888888888888888888888888888888888888888')
  })
})
