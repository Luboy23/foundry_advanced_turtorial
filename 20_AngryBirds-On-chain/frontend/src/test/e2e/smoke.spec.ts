import { expect, test, type Page } from '@playwright/test'

type DebugSnapshot = {
  session: {
    scene: string
  }
  wallet: {
    isConnected: boolean
  }
  ui: {
    overlayRoute: string | null
    activeMenuTab: string | null
  }
}

type DebugBridge = {
  startLevel: (levelId: string) => void
  forceWin: (levelId?: string | null) => void
  goToHome: () => void
  openMenu: (tab: 'leaderboard' | 'history' | 'wallet' | 'settings', route?: string | null) => void
  getSnapshot: () => DebugSnapshot
}

type PlayDebugState = {
  runCompleted: boolean
  elapsedTimeMs: number
  effectiveRightBoundaryX: number
  effectiveRightBoundaryScreenX: number
  cameraZoom: number
  birdsUsed: number
  destroyedPigs: number
  pieceCount: number
  remainingPigCount: number
  reserveBirdCount: number
  shotPhase: string
  hasMeaningfulImpact: boolean
  timeSinceImpactMs: number | null
  birdRetireReason: string | null
  activeRollingPigCount: number
  reserveBirdSlots: Array<{
    birdType: string
    x: number
    y: number
    scale: number
    alpha: number
  }>
  launchVector: {
    x: number
    y: number
    magnitudePxPerSecond: number
    pullDistancePx: number
    clampedPoint: { x: number; y: number }
  } | null
  slingshot: {
    isReady: boolean
    birdRest: { x: number; y: number; screen: { x: number; y: number } } | null
    rearBandAnchor: { x: number; y: number } | null
    frontBandAnchor: { x: number; y: number } | null
  }
  currentBird: {
    id: string
    birdType: string
    launched: boolean
    x: number
    y: number
    screen: { x: number; y: number }
  } | null
}

const readSnapshot = async (page: Page) =>
  page.evaluate(() => {
    return ((window as Window & { __ANGRY_BIRDS_DEBUG__?: DebugBridge }).__ANGRY_BIRDS_DEBUG__ as DebugBridge)
      .getSnapshot()
  })

const readPlayState = async (page: Page) =>
  page.evaluate(() => {
    const game = (window as Window & {
      __ANGRY_BIRDS_PHASER_GAME__?: {
        scene: { getScene: (key: string) => { getDebugRuntimeState?: () => PlayDebugState } }
      }
    }).__ANGRY_BIRDS_PHASER_GAME__
    return game?.scene.getScene('league-play')?.getDebugRuntimeState?.() ?? null
  })

test('title -> home menu -> pause menu -> result -> home all stay inside the game viewport', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as Window & { __ANGRY_BIRDS_DEBUG__?: unknown }).__ANGRY_BIRDS_DEBUG__))

  await expect(page.locator('.game-canvas')).toBeVisible()
  await expect(page.locator('.game-frame')).toHaveCount(0)
  await expect(page.locator('.side-panel')).toHaveCount(0)
  const canvasBox = await page.locator('.game-canvas').boundingBox()
  const viewport = page.viewportSize()
  expect(Math.round(canvasBox?.width ?? 0)).toBe(viewport?.width ?? 0)
  expect(Math.round(canvasBox?.height ?? 0)).toBe(viewport?.height ?? 0)

  await page.waitForFunction(() => {
    const debug = (window as Window & { __ANGRY_BIRDS_DEBUG__?: DebugBridge }).__ANGRY_BIRDS_DEBUG__
    return Boolean(debug?.getSnapshot().session.scene === 'title')
  })
  await page.waitForFunction(() => {
    const debug = (window as Window & { __ANGRY_BIRDS_DEBUG__?: DebugBridge }).__ANGRY_BIRDS_DEBUG__
    return Boolean(debug?.getSnapshot().wallet.isConnected)
  })

  await page.evaluate(() => {
    ;(window as unknown as Window & { __ANGRY_BIRDS_DEBUG__: DebugBridge }).__ANGRY_BIRDS_DEBUG__.openMenu(
      'history',
      'home-menu',
    )
  })
  await page.waitForFunction(() => {
    const debug = (window as Window & { __ANGRY_BIRDS_DEBUG__?: DebugBridge }).__ANGRY_BIRDS_DEBUG__
    const snapshot = debug?.getSnapshot()
    return snapshot?.ui.overlayRoute === 'home-menu' && snapshot?.ui.activeMenuTab === 'history'
  })

  await page.evaluate(() => {
    const debug = (window as unknown as Window & { __ANGRY_BIRDS_DEBUG__: DebugBridge }).__ANGRY_BIRDS_DEBUG__
    debug.startLevel('level-0')
  })
  await page.waitForFunction(() => {
    const game = (window as Window & {
      __ANGRY_BIRDS_PHASER_GAME__?: { scene: { isActive: (key: string) => boolean } }
    }).__ANGRY_BIRDS_PHASER_GAME__
    return Boolean(game?.scene.isActive('league-play'))
  })
  await page.waitForTimeout(1500)
  expect((await readSnapshot(page)).session.scene).toBe('play')
  const playState = await readPlayState(page)
  expect(playState?.slingshot.isReady).toBe(true)
  expect(playState?.remainingPigCount).toBeGreaterThan(0)
  expect(playState?.reserveBirdCount).toBe(3)
  expect(playState ? playState.reserveBirdSlots.every((slot) => slot.x < (playState.slingshot.birdRest?.x ?? 0)) : false).toBe(true)

  await page.evaluate(() => {
    ;(window as unknown as Window & { __ANGRY_BIRDS_DEBUG__: DebugBridge }).__ANGRY_BIRDS_DEBUG__.openMenu(
      'leaderboard',
      'pause-menu',
    )
  })
  await page.waitForFunction(() => {
    const debug = (window as Window & { __ANGRY_BIRDS_DEBUG__?: DebugBridge }).__ANGRY_BIRDS_DEBUG__
    const snapshot = debug?.getSnapshot()
    return snapshot?.ui.overlayRoute === 'pause-menu' && snapshot?.ui.activeMenuTab === 'leaderboard'
  })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => {
    const debug = (window as Window & { __ANGRY_BIRDS_DEBUG__?: DebugBridge }).__ANGRY_BIRDS_DEBUG__
    return debug?.getSnapshot().ui.overlayRoute === null
  })

  await page.evaluate(() => {
    const debug = (window as unknown as Window & { __ANGRY_BIRDS_DEBUG__: DebugBridge }).__ANGRY_BIRDS_DEBUG__
    debug.forceWin('level-0')
  })
  await page.waitForFunction(() => {
    const debug = (window as Window & { __ANGRY_BIRDS_DEBUG__?: DebugBridge }).__ANGRY_BIRDS_DEBUG__
    return debug?.getSnapshot().session.scene === 'result'
  })

  await page.evaluate(() => {
    ;(window as unknown as Window & { __ANGRY_BIRDS_DEBUG__: DebugBridge }).__ANGRY_BIRDS_DEBUG__.goToHome()
  })
  await page.waitForFunction(() => {
    const debug = (window as Window & { __ANGRY_BIRDS_DEBUG__?: DebugBridge }).__ANGRY_BIRDS_DEBUG__
    return debug?.getSnapshot().session.scene === 'title'
  })
  await page.evaluate(() => {
    ;(window as unknown as Window & { __ANGRY_BIRDS_DEBUG__: DebugBridge }).__ANGRY_BIRDS_DEBUG__.openMenu(
      'history',
      'home-menu',
    )
  })
  await page.waitForFunction(() => {
    const debug = (window as Window & { __ANGRY_BIRDS_DEBUG__?: DebugBridge }).__ANGRY_BIRDS_DEBUG__
    const snapshot = debug?.getSnapshot()
    return snapshot?.ui.overlayRoute === 'home-menu' && snapshot?.ui.activeMenuTab === 'history'
  })

  const snapshot = await readSnapshot(page)
  expect(snapshot.ui.overlayRoute).toBe('home-menu')
  expect(snapshot.ui.activeMenuTab).toBe('history')
})

test('an ordinary launch does not instantly clear every pig and structure', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as Window & { __ANGRY_BIRDS_DEBUG__?: unknown }).__ANGRY_BIRDS_DEBUG__))
  await page.waitForFunction(() => {
    const debug = (window as Window & { __ANGRY_BIRDS_DEBUG__?: DebugBridge }).__ANGRY_BIRDS_DEBUG__
    return Boolean(debug?.getSnapshot().session.scene === 'title')
  })
  await page.waitForFunction(() =>
    Boolean((window as Window & { __ANGRY_BIRDS_PHASER_GAME__?: unknown }).__ANGRY_BIRDS_PHASER_GAME__),
  )

  await page.evaluate(() => {
    ;(window as unknown as Window & { __ANGRY_BIRDS_DEBUG__: DebugBridge }).__ANGRY_BIRDS_DEBUG__.startLevel('level-0')
  })
  await page.waitForFunction(() => {
    const game = (window as Window & {
      __ANGRY_BIRDS_PHASER_GAME__?: { scene: { isActive: (key: string) => boolean } }
    }).__ANGRY_BIRDS_PHASER_GAME__
    return Boolean(game?.scene.isActive('league-play'))
  })

  await expect.poll(async () => (await readPlayState(page))?.currentBird?.id ?? null).not.toBeNull()
  const initialState = (await readPlayState(page)) as PlayDebugState
  expect(initialState.slingshot.isReady).toBe(true)
  expect(initialState.remainingPigCount).toBeGreaterThan(0)
  expect(initialState.reserveBirdCount).toBe(3)

  const canvasBox = await page.locator('.game-canvas').boundingBox()
  expect(canvasBox).not.toBeNull()

  const startX = (canvasBox?.x ?? 0) + (initialState.currentBird?.screen.x ?? 0)
  const startY = (canvasBox?.y ?? 0) + (initialState.currentBird?.screen.y ?? 0)

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX - 240, startY + 180, { steps: 18 })
  await page.mouse.up()

  await page.waitForFunction(() => {
    const game = (window as Window & {
      __ANGRY_BIRDS_PHASER_GAME__?: {
        scene: { getScene: (key: string) => { getDebugRuntimeState?: () => PlayDebugState } }
      }
    }).__ANGRY_BIRDS_PHASER_GAME__
    const state = game?.scene.getScene('league-play')?.getDebugRuntimeState?.()
    return Boolean(state?.currentBird?.x && state.currentBird.x > 860)
  })

  let maxObservedBirdScreenX = Number.NEGATIVE_INFINITY
  let lastObservedBoundaryScreenX = initialState.effectiveRightBoundaryScreenX

  for (let index = 0; index < 18; index += 1) {
    const state = (await readPlayState(page)) as PlayDebugState | null
    if (state) {
      lastObservedBoundaryScreenX = state.effectiveRightBoundaryScreenX
      if (state.currentBird?.launched) {
        maxObservedBirdScreenX = Math.max(maxObservedBirdScreenX, state.currentBird.screen.x)
      }
    }
    await page.waitForTimeout(90)
  }

  const afterLaunchState = (await readPlayState(page)) as PlayDebugState
  const sessionSnapshot = await readSnapshot(page)
  const canvasWidth = canvasBox?.width ?? 0

  expect(sessionSnapshot.session.scene).toBe('play')
  expect(afterLaunchState.runCompleted).toBe(false)
  expect(afterLaunchState.elapsedTimeMs).toBeGreaterThan(0)
  expect(afterLaunchState.effectiveRightBoundaryX).toBeGreaterThan(1200)
  expect(afterLaunchState.effectiveRightBoundaryScreenX).toBeLessThanOrEqual(canvasWidth + 2)
  expect(Math.abs(afterLaunchState.effectiveRightBoundaryScreenX - canvasWidth)).toBeLessThanOrEqual(10)
  expect(afterLaunchState.cameraZoom).toBeLessThanOrEqual(1)
  expect(afterLaunchState.remainingPigCount).toBeGreaterThan(0)
  expect(afterLaunchState.destroyedPigs).toBeLessThan(afterLaunchState.pieceCount)
  expect(lastObservedBoundaryScreenX).toBeLessThanOrEqual(canvasWidth + 2)
  expect(maxObservedBirdScreenX).toBeLessThanOrEqual(lastObservedBoundaryScreenX + 8)
})
