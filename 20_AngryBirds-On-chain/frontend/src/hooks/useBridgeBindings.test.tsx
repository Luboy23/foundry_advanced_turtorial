import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AngryBirdsBridge } from '../game/bridge'
import { createDefaultProgress, createDefaultSettings, createEmptyChainPanelState, type LevelCatalogEntry } from '../game/types'
import { shouldExposeDebugBridge, useBridgeBindings } from './useBridgeBindings'

const createLevel = (): LevelCatalogEntry => ({
  levelId: 'level-0',
  version: 1,
  world: {
    width: 1280,
    height: 720,
    groundY: 612,
    gravityY: 22,
    pixelsPerMeter: 32,
  },
  camera: {
    minX: 0,
    maxX: 1280,
    defaultZoom: 1,
  },
  slingshot: {
    anchorX: 240,
    anchorY: 520,
    maxDrag: 130,
    launchVelocityScale: 14,
  },
  birdQueue: ['red'],
  audioMaterials: {
    'pig-basic': 'pig',
  },
  pieces: [
    {
      id: 'pig-0',
      entityType: 'pig',
      prefabKey: 'pig-basic',
      x: 960,
      y: 560,
      rotation: 0,
    },
  ],
  manifest: {
    levelId: 'level-0',
    version: 1,
    file: '/levels/level-0.json',
    contentHash: '0x1234',
    order: 1,
    enabled: true,
  },
  map: {
    levelId: 'level-0',
    order: 1,
    label: '1',
    title: 'Level 0',
    mapX: 640,
    mapY: 320,
  },
})

const createOptions = (overrides: Partial<Parameters<typeof useBridgeBindings>[0]> = {}) => ({
  bridge: new AngryBirdsBridge(),
  setSession: vi.fn(),
  currentScene: 'title' as const,
  mergedLevels: [createLevel()],
  progress: createDefaultProgress(),
  lastPlayedLevelId: null,
  settings: createDefaultSettings(),
  effectiveAddress: undefined,
  isWalletConnected: false,
  isConnecting: false,
  connectorAvailable: true,
  connectWallet: vi.fn(),
  disconnectWallet: vi.fn(),
  requestGameplayStart: vi.fn(),
  updateGameSettings: vi.fn(),
  updateProgress: vi.fn(),
  clearSubmission: vi.fn(),
  acceptSummary: vi.fn(),
  refreshLeaderboard: vi.fn().mockResolvedValue(undefined),
  refreshHistory: vi.fn().mockResolvedValue(undefined),
  submitRun: vi.fn().mockResolvedValue(undefined),
  finalizeQueuedRuns: vi.fn().mockResolvedValue(true),
  queuedRuns: 0,
  submitStage: 'idle' as const,
  lastStatus: null,
  canSubmit: false,
  submitError: null,
  requiresSessionRenewal: false,
  txHash: null,
  isRecoveryMode: false,
  submissionSummary: null,
  activeSession: null,
  chainPanelState: createEmptyChainPanelState(),
  ...overrides,
})

describe('useBridgeBindings', () => {
  it('exposes the debug bridge only in dev or test environments', () => {
    expect(shouldExposeDebugBridge({ DEV: true, MODE: 'development' })).toBe(true)
    expect(shouldExposeDebugBridge({ DEV: false, MODE: 'test' })).toBe(true)
    expect(shouldExposeDebugBridge({ DEV: false, MODE: 'production' })).toBe(false)
  })

  it('triggers targeted refreshes only for leaderboard/history menu requests on home or pause routes', () => {
    const options = createOptions()
    renderHook(() => useBridgeBindings(options))

    act(() => {
      options.bridge.requestOpenMenu('leaderboard', 'home-menu')
    })
    expect(options.refreshLeaderboard).toHaveBeenCalledTimes(1)
    expect(options.refreshHistory).toHaveBeenCalledTimes(0)

    act(() => {
      options.bridge.requestOpenMenu('history', 'pause-menu')
    })
    expect(options.refreshLeaderboard).toHaveBeenCalledTimes(1)
    expect(options.refreshHistory).toHaveBeenCalledTimes(1)

    act(() => {
      options.bridge.requestOpenMenu('settings', 'home-menu')
      options.bridge.requestOpenMenu('wallet', 'pause-menu')
      options.bridge.requestOpenMenu('leaderboard', null)
      options.bridge.requestOpenMenu('history', 'result')
    })
    expect(options.refreshLeaderboard).toHaveBeenCalledTimes(1)
    expect(options.refreshHistory).toHaveBeenCalledTimes(1)
  })

  it('updates bridge progress immediately when a cleared run finishes', () => {
    const options = createOptions()
    options.bridge.setLevels(options.mergedLevels)
    renderHook(() => useBridgeBindings(options))

    act(() => {
      options.bridge.publishRunSummary({
        runId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        levelId: 'level-0',
        levelVersion: 1,
        birdsUsed: 1,
        destroyedPigs: 1,
        durationMs: 9_000,
        evidenceHash: '0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        cleared: true,
        evidence: {
          sessionId: '0x3234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          levelId: 'level-0',
          levelVersion: 1,
          levelContentHash: '0x4234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          clientBuildHash: '0x5234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          startedAtMs: 1_000,
          finishedAtMs: 10_000,
          summary: {
            birdsUsed: 1,
            destroyedPigs: 1,
            durationMs: 9_000,
            cleared: true,
          },
          launches: [],
          abilities: [],
          destroys: [],
          checkpoints: [],
        },
      })
    })

    expect(options.updateProgress).toHaveBeenCalledTimes(1)
    expect(options.bridge.getProgress().completedLevelIds).toContain('level-0')
  })
})
