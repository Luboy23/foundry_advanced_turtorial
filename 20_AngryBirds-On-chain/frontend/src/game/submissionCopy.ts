import type { SubmissionState, WalletState } from './types'

type HomeSubmissionCopyOptions = {
  wallet: WalletState
  submission: SubmissionState
  hasResumeLevel: boolean
  shouldContinue: boolean
}

type ResultSubmissionCopyOptions = {
  summaryCleared: boolean
  submission: SubmissionState
  campaignCompleteSummary?: string
}

export type HomeSubmissionCopy = {
  ctaLabel: string
  hintText: string
  detailText: string
}

export type ResultSubmissionCopy = {
  badgeLabel: string
  statusText: string
  detailText: string
}

const formatSyncReference = (txHash: `0x${string}` | null) =>
  txHash ? `同步详情：确认编号 ${txHash.slice(0, 10)}...` : ''

const buildSyncProgressDetail = (submission: SubmissionState) => {
  if (submission.lastStatus === 'submitted') {
    return formatSyncReference(submission.txHash) || '同步详情：同步请求已发出。'
  }

  if (submission.lastStatus === 'queued') {
    return '同步详情：成绩已交给同步服务继续处理。'
  }

  return ''
}

export const buildHomeSubmissionCopy = ({
  wallet,
  submission,
  hasResumeLevel,
  shouldContinue,
}: HomeSubmissionCopyOptions): HomeSubmissionCopy => {
  const ctaLabel = !wallet.isConnected
    ? wallet.isConnecting
      ? '连接中…'
      : '连接钱包'
    : submission.status === 'signing'
      ? '准备中…'
      : submission.status === 'finalizing' && submission.queuedRuns > 0
        ? '同步中…'
        : !hasResumeLevel
          ? '载入中…'
          : shouldContinue
            ? '继续游戏'
            : '开始游戏'

  if (submission.status === 'error') {
    if (submission.requiresSessionRenewal) {
      return {
        ctaLabel,
        hintText: '需要重新登录后再继续',
        detailText: '返回首页重新登录后，系统会继续处理已保存的成绩。',
      }
    }

    return {
      ctaLabel,
      hintText: '成绩同步出了点问题',
      detailText:
        submission.lastStatus === 'failed'
          ? '已保存的成绩会继续尝试同步。'
          : '可稍后再试，已保存的进度不会丢失。',
    }
  }

  if (submission.status === 'finalizing') {
    return {
      ctaLabel,
      hintText:
        submission.lastStatus === 'submitted'
          ? '上一局成绩正在等待同步完成'
          : '上一局成绩正在同步中',
      detailText: buildSyncProgressDetail(submission),
    }
  }

  if (submission.status === 'confirmed') {
    return {
      ctaLabel,
      hintText: '同步完成，可继续挑战',
      detailText: formatSyncReference(submission.txHash),
    }
  }

  if (submission.status === 'synced') {
    return {
      ctaLabel,
      hintText: '成绩已保存，会自动同步',
      detailText: '你可以直接继续挑战，系统会在后台完成同步。',
    }
  }

  if (submission.status === 'validating') {
    return {
      ctaLabel,
      hintText: '正在保存最新成绩',
      detailText: '请稍候，马上就好。',
    }
  }

  if (!wallet.isConnected) {
    return {
      ctaLabel,
      hintText: wallet.isConnecting ? '正在连接钱包' : '连接钱包后开始挑战',
      detailText: wallet.isConnecting ? '连接完成后就能开始游戏。' : '连接后即可保存成绩并参与排行。',
    }
  }

  if (submission.status === 'signing') {
    return {
      ctaLabel,
      hintText: '正在准备本局成绩保存',
      detailText: '请在钱包中完成确认。',
    }
  }

  if (!hasResumeLevel) {
    return {
      ctaLabel,
      hintText: '正在准备游戏内容',
      detailText: '请稍候，马上就好。',
    }
  }

  if (submission.activeSession) {
    return {
      ctaLabel,
      hintText: '本局成绩会自动保存',
      detailText: '完成关卡后会自动继续同步。',
    }
  }

  if (shouldContinue) {
    return {
      ctaLabel,
      hintText: '继续当前进度',
      detailText: '已完成的关卡成绩会继续保留。',
    }
  }

  return {
    ctaLabel,
    hintText: '首次开始会准备成绩保存',
    detailText: '完成关卡后会自动同步最新成绩。',
  }
}

export const buildResultSubmissionCopy = ({
  summaryCleared,
  submission,
  campaignCompleteSummary = '',
}: ResultSubmissionCopyOptions): ResultSubmissionCopy => {
  if (!summaryCleared) {
    return {
      badgeLabel: '本局未保存',
      statusText: '未通关的回合不会保存成绩。',
      detailText: '',
    }
  }

  const withCampaignSummary = (text: string) =>
    campaignCompleteSummary ? `${campaignCompleteSummary}\n${text}` : text

  if (submission.status === 'error') {
    if (submission.requiresSessionRenewal) {
      return {
        badgeLabel: '需要重新登录',
        statusText: withCampaignSummary('请返回首页重新登录后继续同步成绩。'),
        detailText: '',
      }
    }

    return {
      badgeLabel: '同步出了点问题',
      statusText: withCampaignSummary('成绩暂时还没同步成功，可稍后再试。'),
      detailText: submission.lastStatus === 'failed' ? '同步详情：系统会继续尝试恢复。' : '',
    }
  }

  if (submission.status === 'confirmed') {
    return {
      badgeLabel: '同步完成',
      statusText: withCampaignSummary('成绩已经同步完成，可继续挑战。'),
      detailText: formatSyncReference(submission.txHash),
    }
  }

  if (submission.status === 'finalizing') {
    return {
      badgeLabel: '正在同步',
      statusText: withCampaignSummary(
        submission.lastStatus === 'submitted'
          ? '成绩已保存，正在等待同步完成。'
          : '成绩已保存，正在排队同步。',
      ),
      detailText: buildSyncProgressDetail(submission),
    }
  }

  if (submission.status === 'signing' || submission.status === 'validating') {
    return {
      badgeLabel: '正在同步',
      statusText: withCampaignSummary('正在保存本局成绩，请稍候。'),
      detailText: '',
    }
  }

  if (submission.status === 'synced' || submission.status === 'queued' || submission.status === 'idle') {
    return {
      badgeLabel: '成绩已保存',
      statusText: withCampaignSummary('成绩已经保存，稍后会自动同步。'),
      detailText: '',
    }
  }

  return {
    badgeLabel: '成绩已保存',
    statusText: withCampaignSummary('成绩已经保存。'),
    detailText: '',
  }
}
