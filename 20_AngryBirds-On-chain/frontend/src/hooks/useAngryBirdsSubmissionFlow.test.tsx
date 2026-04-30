import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readRunSyncSnapshot, writeRunSyncSnapshot } from '../features/progress/localStore'
import type { RunSummary } from '../game/types'
import { ApiError } from '../lib/api'
import { buildDeploymentIdHash } from '../lib/sessionGuard'
import { useAngryBirdsSubmissionFlow } from './useAngryBirdsSubmissionFlow'

const {
  mockActivateSession,
  mockCreateSession,
  mockFetchSessionStatus,
  mockFinalizeSession,
  mockUploadRunEvidence,
} = vi.hoisted(() => ({
  mockActivateSession: vi.fn(),
  mockCreateSession: vi.fn(),
  mockFetchSessionStatus: vi.fn(),
  mockFinalizeSession: vi.fn(),
  mockUploadRunEvidence: vi.fn(),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    activateSession: mockActivateSession,
    createSession: mockCreateSession,
    fetchSessionStatus: mockFetchSessionStatus,
    finalizeSession: mockFinalizeSession,
    uploadRunEvidence: mockUploadRunEvidence,
  }
})

const createScope = (
  overrides: Partial<{
    chainId: number
    deploymentId: string
    walletAddress?: `0x${string}`
  }> = {},
) => ({
  chainId: overrides.chainId ?? 31337,
  deploymentId: overrides.deploymentId ?? 'local-dev-1',
  walletAddress: overrides.walletAddress,
})

const createSummary = (overrides: Partial<RunSummary> = {}): RunSummary => ({
  runId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  levelId: 'level-2',
  levelVersion: 1,
  birdsUsed: 2,
  destroyedPigs: 4,
  durationMs: 18_000,
  evidenceHash: '0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  cleared: true,
  evidence: {
    sessionId: '0x3234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    levelId: 'level-2',
    levelVersion: 1,
    levelContentHash: '0x4234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    clientBuildHash: '0x5234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    startedAtMs: 1_000,
    finishedAtMs: 19_000,
    summary: {
      birdsUsed: 2,
      destroyedPigs: 4,
      durationMs: 18_000,
      cleared: true,
    },
    launches: [],
    abilities: [],
    destroys: [],
    checkpoints: [],
  },
  ...overrides,
})

const createActiveSessionGrant = (deploymentId = 'local-dev-1') => ({
  permit: {
    player: '0x1234567890123456789012345678901234567890' as `0x${string}`,
    delegate: '0x1111111111111111111111111111111111111111' as `0x${string}`,
    sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
    deploymentIdHash: buildDeploymentIdHash(deploymentId),
    issuedAt: 100,
    deadline: 4_000_000_000,
    nonce: 1,
    maxRuns: 10,
  },
  permitSignature:
    '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' as `0x${string}`,
})

describe('useAngryBirdsSubmissionFlow', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    mockActivateSession.mockReset()
    mockCreateSession.mockReset()
    mockFetchSessionStatus.mockReset()
    mockFinalizeSession.mockReset()
    mockUploadRunEvidence.mockReset()
  })

  it('does not leak a previous scope snapshot into the next scope key', async () => {
    const guestScope = createScope()
    const walletScope = createScope({
      walletAddress: '0x1234567890123456789012345678901234567890',
    })

    writeRunSyncSnapshot(guestScope, {
      schemaVersion: 6,
      chainId: guestScope.chainId,
      deploymentId: guestScope.deploymentId,
      activeSession: null,
      pendingSessionId: null,
      queue: [],
      txHashes: [],
      lastStatus: 'active',
      walletAddress: undefined,
      capturedAt: Date.now(),
    })

    const refreshAfterConfirmedRun = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ scope }) =>
        useAngryBirdsSubmissionFlow({
          refreshAfterConfirmedRun,
          selectedLevel: null,
          syncScope: scope,
          walletClient: undefined,
        }),
      {
        initialProps: {
          scope: guestScope,
        },
      },
    )

    await waitFor(() => expect(result.current.lastStatus).toBe('active'))

    rerender({
      scope: walletScope,
    })

    await waitFor(() => expect(result.current.lastStatus).toBeNull())
    await waitFor(() =>
      expect(readRunSyncSnapshot(walletScope)).toMatchObject({
        pendingSessionId: null,
        lastStatus: null,
      }),
    )
  })

  it('drops a stale pending session status when the backend no longer knows it', async () => {
    const scope = createScope({
      walletAddress: '0x1234567890123456789012345678901234567890',
    })

    writeRunSyncSnapshot(scope, {
      schemaVersion: 6,
      chainId: scope.chainId,
      deploymentId: scope.deploymentId,
      activeSession: createActiveSessionGrant(),
      pendingSessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      queue: [],
      txHashes: ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
      lastStatus: 'submitted',
      walletAddress: scope.walletAddress,
      capturedAt: Date.now(),
    })
    mockFetchSessionStatus.mockRejectedValue(
      new ApiError({
        code: 'session_expired',
        message: 'session not found',
        status: 404,
        retriable: false,
        requestId: 'req-stale-session',
      }),
    )

    const refreshAfterConfirmedRun = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useAngryBirdsSubmissionFlow({
        refreshAfterConfirmedRun,
        selectedLevel: null,
        syncScope: scope,
        walletClient: undefined,
      }),
    )

    await waitFor(() => expect(mockFetchSessionStatus).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.submitStage).toBe('idle'))
    expect(result.current.submitError).toBeNull()
    expect(result.current.lastStatus).toBeNull()
    expect(result.current.txHash).toBeNull()
    expect(result.current.isRecoveryMode).toBe(false)
    expect(readRunSyncSnapshot(scope)).toMatchObject({
      pendingSessionId: null,
      txHashes: [],
      lastStatus: null,
    })
  })

  it('drops an orphan pending session when status polling hits a retriable backend error', async () => {
    const scope = createScope({
      walletAddress: '0x1234567890123456789012345678901234567890',
    })

    writeRunSyncSnapshot(scope, {
      schemaVersion: 6,
      chainId: scope.chainId,
      deploymentId: scope.deploymentId,
      activeSession: createActiveSessionGrant(),
      pendingSessionId: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      queue: [],
      txHashes: ['0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'],
      lastStatus: 'submitted',
      walletAddress: scope.walletAddress,
      capturedAt: Date.now(),
    })
    mockFetchSessionStatus.mockRejectedValue(
      new ApiError({
        code: 'backend_unavailable',
        message: 'temporary unavailable',
        status: 503,
        retriable: true,
        requestId: 'req-retry-later',
      }),
    )

    const refreshAfterConfirmedRun = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useAngryBirdsSubmissionFlow({
        refreshAfterConfirmedRun,
        selectedLevel: null,
        syncScope: scope,
        walletClient: undefined,
      }),
    )

    await waitFor(() => expect(mockFetchSessionStatus).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.submitStage).toBe('idle'))
    expect(result.current.submitError).toBeNull()
    expect(result.current.lastStatus).toBeNull()
    expect(result.current.isRecoveryMode).toBe(false)
    expect(readRunSyncSnapshot(scope)).toMatchObject({
      pendingSessionId: null,
      txHashes: [],
      lastStatus: null,
    })
  })

  it('refreshes chain data only once when a pending session becomes confirmed', async () => {
    const scope = createScope({
      walletAddress: '0x1234567890123456789012345678901234567890',
    })
    const summary = createSummary()

    writeRunSyncSnapshot(scope, {
      schemaVersion: 6,
      chainId: scope.chainId,
      deploymentId: scope.deploymentId,
      activeSession: createActiveSessionGrant(),
      pendingSessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      queue: [summary],
      txHashes: ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
      lastStatus: 'submitted',
      walletAddress: scope.walletAddress,
      capturedAt: Date.now(),
    })
    mockFetchSessionStatus.mockResolvedValue({
      sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      status: 'confirmed',
      receivedRuns: 1,
      validatedRuns: 0,
      queuedRuns: 0,
      submittedRuns: 0,
      confirmedRuns: 1,
      failedRuns: 0,
      txHashes: ['0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'],
      lastError: null,
    })

    const refreshAfterConfirmedRun = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ scopeValue }) =>
        useAngryBirdsSubmissionFlow({
          refreshAfterConfirmedRun,
          selectedLevel: null,
          syncScope: scopeValue,
          walletClient: undefined,
        }),
      {
        initialProps: {
          scopeValue: scope,
        },
      },
    )

    await waitFor(() => expect(result.current.submitStage).toBe('confirmed'))
    await waitFor(() => expect(refreshAfterConfirmedRun).toHaveBeenCalledWith(summary))
    expect(result.current.activeSession).toEqual(createActiveSessionGrant())
    expect(mockFetchSessionStatus).toHaveBeenCalledWith(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      createActiveSessionGrant().permitSignature,
    )
    expect(readRunSyncSnapshot(scope)).toMatchObject({
      activeSession: createActiveSessionGrant(),
      pendingSessionId: null,
      lastStatus: 'confirmed',
    })

    rerender({ scopeValue: scope })
    await waitFor(() => expect(refreshAfterConfirmedRun).toHaveBeenCalledTimes(1))
  })

  it('reuses the confirmed active session for the next gameplay start without re-signing', async () => {
    const scope = createScope({
      walletAddress: '0x1234567890123456789012345678901234567890',
    })
    const activeSession = createActiveSessionGrant(scope.deploymentId)
    const signTypedData = vi.fn()
    const walletClient = {
      account: {
        address: scope.walletAddress!,
      },
      signTypedData,
    } as unknown as Parameters<typeof useAngryBirdsSubmissionFlow>[0]['walletClient']

    writeRunSyncSnapshot(scope, {
      schemaVersion: 6,
      chainId: scope.chainId,
      deploymentId: scope.deploymentId,
      activeSession,
      pendingSessionId: null,
      queue: [],
      txHashes: ['0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'],
      lastStatus: 'confirmed',
      walletAddress: scope.walletAddress,
      capturedAt: Date.now(),
    })

    const refreshAfterConfirmedRun = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useAngryBirdsSubmissionFlow({
        refreshAfterConfirmedRun,
        selectedLevel: null,
        syncScope: scope,
        walletClient,
      }),
    )

    let reusedSession: Awaited<ReturnType<typeof result.current.ensureSessionReadyForGameplay>> | null = null
    await act(async () => {
      reusedSession = await result.current.ensureSessionReadyForGameplay()
    })

    expect(reusedSession).toEqual(activeSession)
    expect(mockCreateSession).not.toHaveBeenCalled()
    expect(mockActivateSession).not.toHaveBeenCalled()
    expect(signTypedData).not.toHaveBeenCalled()
  })
})
