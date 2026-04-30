import { describe, expect, it } from 'vitest'
import { assessActiveSession, buildDeploymentIdHash, SESSION_RENEWAL_MARGIN_SECONDS } from './sessionGuard'

const createSession = (overrides: Partial<{
  player: `0x${string}`
  deploymentIdHash: `0x${string}`
  deadline: number
  maxRuns: number
}> = {}) => ({
  permit: {
    player: overrides.player ?? ('0x1234567890123456789012345678901234567890' as `0x${string}`),
    delegate: '0x1111111111111111111111111111111111111111' as `0x${string}`,
    sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
    deploymentIdHash: overrides.deploymentIdHash ?? buildDeploymentIdHash('local-dev-1'),
    issuedAt: 100,
    deadline: overrides.deadline ?? 10_000,
    nonce: 1,
    maxRuns: overrides.maxRuns ?? 3,
  },
  permitSignature:
    '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`,
})

describe('assessActiveSession', () => {
  it('reuses a matching active session', () => {
    expect(
      assessActiveSession({
        activeSession: createSession(),
        currentWalletAddress: '0x1234567890123456789012345678901234567890',
        queueLength: 1,
        scope: {
          chainId: 31337,
          deploymentId: 'local-dev-1',
        },
        nowSeconds: 1_000,
      }),
    ).toEqual({
      status: 'ready',
      reason: 'ready',
    })
  })

  it('requests renewal near expiry or once maxRuns is reached', () => {
    expect(
      assessActiveSession({
        activeSession: createSession({
          deadline: 1_000 + SESSION_RENEWAL_MARGIN_SECONDS - 1,
        }),
        currentWalletAddress: '0x1234567890123456789012345678901234567890',
        queueLength: 0,
        scope: {
          chainId: 31337,
          deploymentId: 'local-dev-1',
        },
        nowSeconds: 1_000,
      }).status,
    ).toBe('needs-renewal')

    expect(
      assessActiveSession({
        activeSession: createSession({ maxRuns: 2 }),
        currentWalletAddress: '0x1234567890123456789012345678901234567890',
        queueLength: 2,
        scope: {
          chainId: 31337,
          deploymentId: 'local-dev-1',
        },
        nowSeconds: 1_000,
      }).reason,
    ).toBe('max-runs')
  })

  it('rejects missing, expired, or mismatched sessions', () => {
    expect(
      assessActiveSession({
        activeSession: null,
        currentWalletAddress: '0x1234567890123456789012345678901234567890',
        queueLength: 0,
        scope: {
          chainId: 31337,
          deploymentId: 'local-dev-1',
        },
        nowSeconds: 1_000,
      }).status,
    ).toBe('missing')

    expect(
      assessActiveSession({
        activeSession: createSession({ deadline: 999 }),
        currentWalletAddress: '0x1234567890123456789012345678901234567890',
        queueLength: 0,
        scope: {
          chainId: 31337,
          deploymentId: 'local-dev-1',
        },
        nowSeconds: 1_000,
      }).status,
    ).toBe('expired')

    expect(
      assessActiveSession({
        activeSession: createSession({
          deploymentIdHash: buildDeploymentIdHash('local-dev-old'),
        }),
        currentWalletAddress: '0x1234567890123456789012345678901234567890',
        queueLength: 0,
        scope: {
          chainId: 31337,
          deploymentId: 'local-dev-1',
        },
        nowSeconds: 1_000,
      }).reason,
    ).toBe('deployment-mismatch')
  })
})
