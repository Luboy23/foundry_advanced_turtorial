import { describe, expect, it } from 'vitest'
import { buildHomeSubmissionCopy, buildResultSubmissionCopy } from './submissionCopy'
import type { SubmissionState, WalletState } from './types'

const createWalletState = (patch: Partial<WalletState> = {}): WalletState => ({
  isConnected: false,
  isConnecting: false,
  label: '钱包未连接',
  mode: 'disconnected',
  ...patch,
})

const createSubmissionState = (patch: Partial<SubmissionState> = {}): SubmissionState => ({
  status: 'idle',
  lastStatus: null,
  canSubmit: false,
  error: null,
  requiresSessionRenewal: false,
  txHash: null,
  isRecoveryMode: false,
  summary: null,
  queuedRuns: 0,
  activeSession: null,
  ...patch,
})

describe('buildHomeSubmissionCopy', () => {
  it('uses player-friendly sync wording on the home screen', () => {
    const copy = buildHomeSubmissionCopy({
      wallet: createWalletState({ isConnected: true, label: '0x1234...5678', mode: 'wallet' }),
      submission: createSubmissionState({
        status: 'finalizing',
        lastStatus: 'submitted',
        queuedRuns: 1,
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      }),
      hasResumeLevel: true,
      shouldContinue: true,
    })

    expect(copy.ctaLabel).toBe('同步中…')
    expect(copy.hintText).toBe('上一局成绩正在等待同步完成')
    expect(copy.detailText).toContain('同步详情：确认编号 0x12345678...')
  })

  it('maps renewal states to relogin wording', () => {
    const copy = buildHomeSubmissionCopy({
      wallet: createWalletState({ isConnected: true, label: '0x1234...5678', mode: 'wallet' }),
      submission: createSubmissionState({
        status: 'error',
        requiresSessionRenewal: true,
      }),
      hasResumeLevel: true,
      shouldContinue: false,
    })

    expect(copy.hintText).toBe('需要重新登录后再继续')
    expect(copy.detailText).toContain('重新登录')
  })
})

describe('buildResultSubmissionCopy', () => {
  it('keeps primary result copy player-facing while moving sync ids to detail text', () => {
    const copy = buildResultSubmissionCopy({
      summaryCleared: true,
      submission: createSubmissionState({
        status: 'confirmed',
        txHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      }),
      campaignCompleteSummary: '',
    })

    expect(copy.badgeLabel).toBe('同步完成')
    expect(copy.statusText).toBe('成绩已经同步完成，可继续挑战。')
    expect(copy.detailText).toContain('同步详情：确认编号 0xabcdefab...')
  })

  it('shows relogin wording for renewal errors on the result screen', () => {
    const copy = buildResultSubmissionCopy({
      summaryCleared: true,
      submission: createSubmissionState({
        status: 'error',
        requiresSessionRenewal: true,
      }),
      campaignCompleteSummary: '你已完成全部 5 关挑战，所有据点已被清空。',
    })

    expect(copy.badgeLabel).toBe('需要重新登录')
    expect(copy.statusText).toContain('请返回首页重新登录后继续同步成绩。')
    expect(copy.detailText).toBe('')
  })
})
