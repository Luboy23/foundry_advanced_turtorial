import { keccak256, stringToHex } from 'viem'
import type { ActiveSessionGrant, RunSyncScope } from '../game/types'

export const SESSION_RENEWAL_MARGIN_SECONDS = 600

export type ActiveSessionAssessment = {
  status: 'ready' | 'needs-renewal' | 'expired' | 'missing'
  reason:
    | 'ready'
    | 'absent'
    | 'wallet-mismatch'
    | 'deployment-mismatch'
    | 'expired'
    | 'deadline-margin'
    | 'max-runs'
}

// 前端按与后端一致的规则计算 deploymentIdHash，避免跨部署误用会话。
export const buildDeploymentIdHash = (deploymentId: string) =>
  keccak256(stringToHex(deploymentId)) as `0x${string}`

type AssessActiveSessionOptions = {
  activeSession: ActiveSessionGrant | null
  currentWalletAddress?: `0x${string}`
  queueLength: number
  scope: RunSyncScope
  nowSeconds?: number
  renewalMarginSeconds?: number
}

// 评估当前 activeSession 是否可复用，并给出需要续签/失效原因。
export const assessActiveSession = ({
  activeSession,
  currentWalletAddress,
  queueLength,
  scope,
  nowSeconds = Math.floor(Date.now() / 1000),
  renewalMarginSeconds = SESSION_RENEWAL_MARGIN_SECONDS,
}: AssessActiveSessionOptions): ActiveSessionAssessment => {
  if (!activeSession) {
    return {
      status: 'missing',
      reason: 'absent',
    }
  }

  const permit = activeSession.permit

  if (
    currentWalletAddress &&
    permit.player.toLowerCase() !== currentWalletAddress.toLowerCase()
  ) {
    return {
      status: 'missing',
      reason: 'wallet-mismatch',
    }
  }

  if (
    permit.deploymentIdHash.toLowerCase() !==
    buildDeploymentIdHash(scope.deploymentId).toLowerCase()
  ) {
    return {
      status: 'missing',
      reason: 'deployment-mismatch',
    }
  }

  if (permit.deadline <= nowSeconds) {
    return {
      status: 'expired',
      reason: 'expired',
    }
  }

  if (queueLength >= permit.maxRuns) {
    return {
      status: 'needs-renewal',
      reason: 'max-runs',
    }
  }

  if (permit.deadline - nowSeconds <= renewalMarginSeconds) {
    return {
      status: 'needs-renewal',
      reason: 'deadline-margin',
    }
  }

  return {
    status: 'ready',
    reason: 'ready',
  }
}
