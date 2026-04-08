import { describe, expect, it } from 'vitest'
import {
  resolveSubmitStatusText,
} from './submissionState'

describe('submissionState', () => {
  it('maps each stage to user-facing status copy', () => {
    expect(resolveSubmitStatusText('idle')).toBe('等待自动上链...')
    expect(resolveSubmitStatusText('signing')).toBe('请在钱包中签名确认')
    expect(resolveSubmitStatusText('pending')).toBe('交易已发出，等待链上确认')
    expect(resolveSubmitStatusText('success')).toBe('成绩已成功上链')
    expect(resolveSubmitStatusText('zero_score_skipped')).toBe('零分局已跳过链上提交')
    expect(resolveSubmitStatusText('retriable_error')).toBe('上链失败，请重试（成功上链后可继续）')
  })
})
