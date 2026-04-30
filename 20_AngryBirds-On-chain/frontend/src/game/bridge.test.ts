import { describe, expect, it, vi } from 'vitest'
import { AngryBirdsBridge } from './bridge'
import type { LevelCatalogEntry } from './types'

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
  audioMaterials: {},
  pieces: [],
  manifest: {
    levelId: 'level-0',
    version: 1,
    file: 'levels/level-0.json',
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

describe('AngryBirdsBridge', () => {
  it('moves from boot to title once levels are loaded', () => {
    const bridge = new AngryBirdsBridge()
    bridge.setLevels([createLevel()])

    expect(bridge.getSession()).toMatchObject({
      scene: 'title',
      currentLevelId: 'level-0',
    })
  })

  it('dispatches menu and host command requests', () => {
    const bridge = new AngryBirdsBridge()
    const connectListener = vi.fn()
    const disconnectListener = vi.fn()
    const gameplayStartListener = vi.fn()
    const settingsListener = vi.fn()
    const menuListener = vi.fn()
    const clearSubmissionListener = vi.fn()

    bridge.on('wallet:connect-request', connectListener)
    bridge.on('wallet:disconnect-request', disconnectListener)
    bridge.on('gameplay:start-request', gameplayStartListener)
    bridge.on('settings:update-request', settingsListener)
    bridge.on('menu:open-request', menuListener)
    bridge.on('submission:clear-request', clearSubmissionListener)

    bridge.requestWalletConnect()
    bridge.requestWalletDisconnect()
    bridge.requestStartHomeLevel()
    bridge.requestSettingsUpdate({ musicEnabled: false })
    bridge.requestOpenMenu('history', 'home-menu')
    bridge.requestClearSubmission()

    expect(connectListener).toHaveBeenCalledTimes(1)
    expect(disconnectListener).toHaveBeenCalledTimes(1)
    expect(gameplayStartListener).toHaveBeenCalledWith({ mode: 'home' })
    expect(settingsListener).toHaveBeenCalledWith({ musicEnabled: false })
    expect(menuListener).toHaveBeenCalledWith({
      tab: 'history',
      route: 'home-menu',
    })
    expect(clearSubmissionListener).toHaveBeenCalledTimes(1)
  })

  it('dispatches resume requests with an explicit resume level id', () => {
    const bridge = new AngryBirdsBridge()
    const gameplayStartListener = vi.fn()
    const secondLevel = {
      ...createLevel(),
      levelId: 'level-1',
      manifest: {
        ...createLevel().manifest,
        levelId: 'level-1',
        order: 2,
      },
      map: {
        ...createLevel().map,
        levelId: 'level-1',
        order: 2,
        label: '2',
        title: 'Level 1',
      },
    }

    bridge.setLevels([createLevel(), secondLevel])
    bridge.updateProgress(
      {
        unlockedOrders: [1, 2],
        completedLevelIds: ['level-0'],
      },
      {
        lastPlayedLevelId: 'level-0',
      },
    )
    bridge.on('gameplay:start-request', gameplayStartListener)

    bridge.requestStartResumeLevel()

    expect(gameplayStartListener).toHaveBeenCalledWith({
      mode: 'level',
      levelId: 'level-1',
    })
  })

  it('resolves home and next levels through the linear campaign helpers', () => {
    const bridge = new AngryBirdsBridge()
    const secondLevel = {
      ...createLevel(),
      levelId: 'level-1',
      manifest: {
        ...createLevel().manifest,
        levelId: 'level-1',
        order: 2,
      },
      map: {
        ...createLevel().map,
        levelId: 'level-1',
        order: 2,
        label: '2',
        title: 'Level 1',
      },
    }

    bridge.setLevels([createLevel(), secondLevel])

    expect(bridge.getResumeLevel()?.levelId).toBe('level-0')
    expect(bridge.getHomeLevel()?.levelId).toBe('level-0')
    expect(bridge.getNextLevelAfter('level-0')?.levelId).toBe('level-1')

    bridge.updateProgress({
      unlockedOrders: [1, 2],
      completedLevelIds: ['level-0'],
    })

    expect(bridge.getResumeLevel()?.levelId).toBe('level-1')
    expect(bridge.getHomeLevel()?.levelId).toBe('level-1')
    bridge.startNextLevel()
    expect(bridge.getSession()).toMatchObject({
      scene: 'play',
      currentLevelId: 'level-1',
    })
  })

  it('keeps the just-played level selected when returning home after clearing a level', () => {
    const bridge = new AngryBirdsBridge()
    const secondLevel = {
      ...createLevel(),
      levelId: 'level-1',
      manifest: {
        ...createLevel().manifest,
        levelId: 'level-1',
        order: 2,
      },
      map: {
        ...createLevel().map,
        levelId: 'level-1',
        order: 2,
        label: '2',
        title: 'Level 1',
      },
    }
    const thirdLevel = {
      ...createLevel(),
      levelId: 'level-2',
      manifest: {
        ...createLevel().manifest,
        levelId: 'level-2',
        order: 3,
      },
      map: {
        ...createLevel().map,
        levelId: 'level-2',
        order: 3,
        label: '3',
        title: 'Level 2',
      },
    }

    bridge.setLevels([createLevel(), secondLevel, thirdLevel])
    bridge.updateProgress({
      unlockedOrders: [1, 2, 3],
      completedLevelIds: ['level-0'],
    })

    bridge.startLevel('level-1')
    bridge.publishRunSummary({
      runId: '0x0234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      levelId: 'level-1',
      levelVersion: 1,
      birdsUsed: 2,
      destroyedPigs: 4,
      durationMs: 18000,
      evidenceHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      cleared: true,
      evidence: {
        sessionId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        levelId: 'level-1',
        levelVersion: 1,
        levelContentHash: '0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        clientBuildHash: '0x3234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        startedAtMs: 1000,
        finishedAtMs: 19000,
        summary: {
          birdsUsed: 2,
          destroyedPigs: 4,
          durationMs: 18000,
          cleared: true,
        },
        launches: [],
        abilities: [],
        destroys: [],
        checkpoints: [],
      },
    })
    bridge.updateProgress({
      unlockedOrders: [1, 2, 3],
      completedLevelIds: ['level-0', 'level-1'],
    })

    bridge.returnHome()

    expect(bridge.getSession()).toMatchObject({
      scene: 'title',
      currentLevelId: 'level-1',
    })
    expect(bridge.getResumeLevel()?.levelId).toBe('level-2')
    expect(bridge.getHomeLevel()?.levelId).toBe('level-2')
  })

  it('falls back to the last played cleared level once the campaign is fully completed', () => {
    const bridge = new AngryBirdsBridge()
    const secondLevel = {
      ...createLevel(),
      levelId: 'level-1',
      manifest: {
        ...createLevel().manifest,
        levelId: 'level-1',
        order: 2,
      },
      map: {
        ...createLevel().map,
        levelId: 'level-1',
        order: 2,
        label: '2',
        title: 'Level 1',
      },
    }

    bridge.setLevels([createLevel(), secondLevel])
    bridge.updateProgress(
      {
        unlockedOrders: [1, 2],
        completedLevelIds: ['level-0', 'level-1'],
      },
      {
        lastPlayedLevelId: 'level-1',
      },
    )

    expect(bridge.getResumeLevel()?.levelId).toBe('level-1')
  })
})
