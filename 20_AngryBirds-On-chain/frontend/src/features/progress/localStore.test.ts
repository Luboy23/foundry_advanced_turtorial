import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultProgress } from '../../game/types'
import {
  buildProgressStorageKey,
  buildRunSyncStorageKey,
  hydrateRunSyncState,
  loadLastPlayedLevel,
  loadProgress,
  markLevelCleared,
  saveProgress,
  writeRunSyncSnapshot,
} from './localStore'

const createScope = (
  overrides: Partial<{
    chainId: number
    deploymentId: string
    walletAddress?: `0x${string}`
  }> = {},
) => ({
  chainId: overrides.chainId ?? 31337,
  deploymentId: overrides.deploymentId ?? 'local-dev-1',
  walletAddress: overrides.walletAddress ?? ('0x1234567890123456789012345678901234567890' as `0x${string}`),
})

describe('markLevelCleared', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('unlocks the next order and marks the level as completed', () => {
    const next = markLevelCleared(
      createDefaultProgress(),
      {
        levelId: 'level-0',
        version: 1,
        world: { width: 1, height: 1, groundY: 1, gravityY: 1, pixelsPerMeter: 1 },
        camera: { minX: 0, maxX: 1, defaultZoom: 1 },
        slingshot: { anchorX: 0, anchorY: 0, maxDrag: 1, launchVelocityScale: 1 },
        birdQueue: ['red'],
        audioMaterials: {},
        pieces: [],
        manifest: {
          levelId: 'level-0',
          version: 1,
          file: '/levels/level-0.gameplay.json',
          contentHash: '0x1'.padEnd(66, '0') as `0x${string}`,
          order: 1,
          enabled: true,
        },
        map: { levelId: 'level-0', order: 1, label: '1', title: 'A', mapX: 0, mapY: 0 },
      },
    )

    expect(next.unlockedOrders).toEqual([1, 2])
    expect(next.completedLevelIds).toEqual(['level-0'])
  })

  it('stores progress in a deployment-scoped envelope', () => {
    const scope = createScope()
    const progress = {
      unlockedOrders: [1, 2, 3],
      completedLevelIds: ['level-0', 'level-1'],
    }

    saveProgress(scope, progress, 'level-1')

    expect(loadProgress(scope)).toEqual(progress)
    expect(loadLastPlayedLevel(scope)).toBe('level-1')
    expect(buildProgressStorageKey(scope)).toBe(
      'angrybirds.progress.v2.31337.local-dev-1.0x1234567890123456789012345678901234567890',
    )
  })

  it('isolates progress across deployment ids', () => {
    const walletAddress = '0x1234567890123456789012345678901234567890' as `0x${string}`
    const firstScope = createScope({ deploymentId: 'local-dev-1', walletAddress })
    const secondScope = createScope({ deploymentId: 'local-dev-2', walletAddress })
    const progress = {
      unlockedOrders: [1, 2],
      completedLevelIds: ['level-0'],
    }

    saveProgress(firstScope, progress, 'level-0')

    expect(loadProgress(firstScope)).toEqual(progress)
    expect(loadProgress(secondScope)).toEqual(createDefaultProgress())
    expect(loadLastPlayedLevel(secondScope)).toBeNull()
  })

  it('does not read legacy wallet-only progress keys', () => {
    const scope = createScope()
    window.localStorage.setItem(
      'angrybirds.progress.0x1234567890123456789012345678901234567890',
      JSON.stringify({
        unlockedOrders: [1, 2, 3],
        completedLevelIds: ['level-0', 'level-1'],
      }),
    )

    expect(loadProgress(scope)).toEqual(createDefaultProgress())
    expect(loadLastPlayedLevel(scope)).toBeNull()
  })

  it('hydrates run sync state only for the active deployment scope', () => {
    const firstScope = {
      chainId: 31337,
      deploymentId: 'local-dev-1',
      walletAddress: '0x1234567890123456789012345678901234567890' as `0x${string}`,
    }
    writeRunSyncSnapshot(firstScope, {
      schemaVersion: 6,
      chainId: 31337,
      deploymentId: 'local-dev-1',
      activeSession: null,
      pendingSessionId: null,
      queue: [],
      txHashes: [],
      lastStatus: 'active',
      walletAddress: '0x1234567890123456789012345678901234567890',
      capturedAt: Date.now(),
    })

    expect(buildRunSyncStorageKey(firstScope)).toBe(
      'angrybirds.session-run-queue.v4.31337.local-dev-1.0x1234567890123456789012345678901234567890',
    )
    expect(hydrateRunSyncState(firstScope).lastStatus).toBe('active')
    expect(
      hydrateRunSyncState({
        chainId: 31337,
        deploymentId: 'local-dev-2',
        walletAddress: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      }),
    ).toEqual({
      activeSession: null,
      pendingSessionId: null,
      queue: [],
      txHashes: [],
      lastStatus: null,
    })
    expect(
      hydrateRunSyncState({
        chainId: 31337,
        deploymentId: 'local-dev-1',
        walletAddress: '0x9999999999999999999999999999999999999999' as `0x${string}`,
      }),
    ).toEqual({
      activeSession: null,
      pendingSessionId: null,
      queue: [],
      txHashes: [],
      lastStatus: null,
    })
  })
})
