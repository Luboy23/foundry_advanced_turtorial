import { expect, test, type Locator, type Page } from '@playwright/test'
import type { DebugPlatformStateSnapshot, DebugPlayerStateSnapshot } from '../../game/types'
import {
  clearTestPlatforms,
  forceGameOver,
  getPlatformState,
  getPlayerStateSnapshot,
  hasDownmanDebugBridge,
  setElapsedMs,
  setPlayerState,
  spawnTestPlatform,
} from './helpers/downmanDebug'

const parseScore = (raw: string | null): number => {
  if (!raw) {
    return 0
  }
  return Number.parseInt(raw.replace(/,/g, ''), 10)
}

const dismissPortraitHintIfVisible = async (page: Page) => {
  const dismissButton = page.getByRole('button', { name: '本次不再提醒' })
  if (await dismissButton.isVisible()) {
    await dismissButton.click()
  }
}

const gotoHome = async (page: Page) => {
  await page.goto('/', {
    waitUntil: 'commit',
    timeout: 45_000,
  })
  await expect(page.getByTestId('control-start')).toBeVisible({
    timeout: 45_000,
  })
}

const startAndEnterRunning = async (page: Page) => {
  await dismissPortraitHintIfVisible(page)
  await expect
    .poll(async () => hasDownmanDebugBridge(page), {
      timeout: 45_000,
    })
    .toBe(true)
  const startButton = page.getByTestId('control-start')
  await expect(startButton).toBeEnabled()
  await startButton.click()
  await expect(page.getByTestId('control-pause-resume')).toBeEnabled({
    timeout: 25_000,
  })
}

const PLATFORM_HALF_HEIGHT_PX = 16
const PLAYER_CENTER_OFFSET_FROM_PLATFORM_TOP_PX = 45.62
const WORLD_WIDTH_PX = 1280
const PLAYER_VISUAL_HALF_WIDTH_PX = 28
const VISUAL_BOUNDARY_EPSILON_PX = 0.6

const resolveStandingPlayerY = (platformCenterY: number): number =>
  platformCenterY - PLATFORM_HALF_HEIGHT_PX - PLAYER_CENTER_OFFSET_FROM_PLATFORM_TOP_PX

const waitForGroundedOnPlatform = async (
  page: Page,
  platformId: number,
  timeout = 10_000,
) => {
  await expect
    .poll(async () => {
      const snapshot = await getPlayerStateSnapshot(page)
      return Boolean(snapshot?.grounded && snapshot.currentGroundPlatformId === platformId)
    }, {
      timeout,
    })
    .toBe(true)
}

const waitForLandingEventOnPlatform = async (
  page: Page,
  platformId: number,
  timeout = 10_000,
) => {
  await expect
    .poll(async () => {
      const snapshot = await getPlayerStateSnapshot(page)
      return snapshot?.lastLandingEvent?.platformId ?? null
    }, {
      timeout,
    })
    .toBe(platformId)
}

const setupPlatformToPlatformDrop = async (
  page: Page,
  input: {
    upperPlatformId: number
    upperPlatformType: 'stable' | 'vanishing'
    upperPlatformY: number
    upperPlatformWidth: number
    lowerPlatformId: number
    lowerPlatformType: 'stable' | 'moving' | 'vanishing'
    lowerPlatformY: number
    lowerPlatformWidth: number
    lowerMoveSpeed?: number
    lowerDirection?: -1 | 1
    playerX?: number
  },
) => {
  const playerX = input.playerX ?? 640
  const targetStandingY = resolveStandingPlayerY(input.upperPlatformY)
  const playerSpawnY = targetStandingY - 64
  await clearTestPlatforms(page)
  await spawnTestPlatform(page, {
    id: input.upperPlatformId,
    type: input.upperPlatformType,
    x: playerX,
    y: input.upperPlatformY,
    width: input.upperPlatformWidth,
  })
  await spawnTestPlatform(page, {
    id: input.lowerPlatformId,
    type: input.lowerPlatformType,
    x: playerX,
    y: input.lowerPlatformY,
    width: input.lowerPlatformWidth,
    moveSpeed: input.lowerMoveSpeed,
    direction: input.lowerDirection,
  })
  await setPlayerState(page, {
    x: playerX,
    y: playerSpawnY,
    velocityX: 0,
    velocityY: 360,
  })
}

const waitForPositiveScore = async (page: Page) => {
  await expect
    .poll(async () => parseScore(await page.getByTestId('score-value').textContent()), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0)
}

const expectNoGameOverModal = async (page: Page) => {
  await expect(page.getByRole('heading', { name: '本局结算' })).toHaveCount(0)
}

const modalCloseButtons = (page: Page): Locator =>
  page.getByRole('button', { name: '关闭' }).first()

test('start game and score should increase after countdown @smoke', async ({ page }) => {
  await gotoHome(page)
  await startAndEnterRunning(page)

  await setElapsedMs(page, 35_000)

  await expect
    .poll(async () => parseScore(await page.getByTestId('score-value').textContent()))
    .toBeGreaterThan(0)
})

test('mobile viewport uses follow pad by default', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoHome(page)
  await dismissPortraitHintIfVisible(page)

  await expect(page.getByTestId('touch-follow-pad')).toBeVisible()
  await expect(page.getByTestId('touch-left')).toHaveCount(0)
  await expect(page.getByTestId('touch-right')).toHaveCount(0)
})

test('modal x button stays usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoHome(page)
  await dismissPortraitHintIfVisible(page)

  await page.getByTestId('control-settings').click()
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()
  await modalCloseButtons(page).click()
  await expect(page.getByRole('heading', { name: '设置' })).toHaveCount(0)
})

test('game over auto submits on-chain and unlocks actions on success', async ({ page }) => {
  await gotoHome(page)
  await startAndEnterRunning(page)
  await setElapsedMs(page, 24_000)
  await waitForPositiveScore(page)
  await forceGameOver(page)

  await expect(page.getByRole('heading', { name: '本局结算' })).toBeVisible()
  await expect(page.getByText(/链上提交状态：/)).toBeVisible()

  const closeButton = page
    .getByRole('heading', { name: '本局结算' })
    .locator('..')
    .getByRole('button', { name: '关闭' })
    .first()
  const restartButton = page.getByRole('button', { name: '再来一局' })
  await expect(restartButton).toBeVisible()

  await expect(page.getByText('链上提交状态：成绩已成功上链')).toBeVisible({
    timeout: 15_000,
  })
  await expect(closeButton).toBeEnabled()
  await expect(restartButton).toBeEnabled()
})

test('leaderboard and history are fetched from on-chain records', async ({ page }) => {
  await gotoHome(page)
  await startAndEnterRunning(page)
  await setElapsedMs(page, 31_000)
  await waitForPositiveScore(page)
  await forceGameOver(page)
  await expect(page.getByText('链上提交状态：成绩已成功上链')).toBeVisible({
    timeout: 15_000,
  })

  await page.getByLabel('关闭').click()

  await page.getByTestId('control-leaderboard').click()
  await expect(page.getByRole('heading', { name: '链上排行榜' })).toBeVisible()
  await expect(page.getByText('排名 #1')).toBeVisible()
  await modalCloseButtons(page).click()

  await page.getByTestId('control-history').click()
  await expect(page.getByRole('heading', { name: '我的历史成绩' })).toBeVisible()
  await expect(page.locator('li p', { hasText: / 分$/ }).first()).toBeVisible()
})

test('space toggles pause/resume and keeps score frozen while paused', async ({ page }) => {
  await gotoHome(page)
  await startAndEnterRunning(page)
  await setElapsedMs(page, 35_000)

  const pauseResume = page.getByTestId('control-pause-resume')
  const beforePause = parseScore(await page.getByTestId('score-value').textContent())
  await page.keyboard.press('Space')
  await expect(pauseResume).toHaveText('继续')

  const pausedA = parseScore(await page.getByTestId('score-value').textContent())
  await page.waitForTimeout(700)
  const pausedB = parseScore(await page.getByTestId('score-value').textContent())
  expect(pausedB).toBe(pausedA)
  expect(pausedA).toBeGreaterThanOrEqual(beforePause)

  await page.keyboard.press('Space')
  await expect(pauseResume).toHaveText('暂停')
})

test('player visual bounds remain symmetric on left and right edges @landing', async ({ page }) => {
  await gotoHome(page)
  await startAndEnterRunning(page)
  await setElapsedMs(page, 20_000)

  const testY = 420
  await clearTestPlatforms(page)
  await setPlayerState(page, {
    x: WORLD_WIDTH_PX + 200,
    y: testY,
    velocityX: 0,
    velocityY: 0,
  })

  await expect
    .poll(async () => {
      const snapshot = await getPlayerStateSnapshot(page)
      return snapshot?.x ?? Number.NaN
    }, {
      timeout: 3_000,
    })
    .toBeLessThanOrEqual(WORLD_WIDTH_PX - PLAYER_VISUAL_HALF_WIDTH_PX + 1)
  const rightSnapshot = await getPlayerStateSnapshot(page)
  expect(rightSnapshot).not.toBeNull()
  const rightState = rightSnapshot as DebugPlayerStateSnapshot
  expect(rightState.x + PLAYER_VISUAL_HALF_WIDTH_PX).toBeLessThanOrEqual(
    WORLD_WIDTH_PX + VISUAL_BOUNDARY_EPSILON_PX,
  )
  expect(Math.abs(rightState.x - (WORLD_WIDTH_PX - PLAYER_VISUAL_HALF_WIDTH_PX))).toBeLessThanOrEqual(1)

  await setPlayerState(page, {
    x: -200,
    y: testY,
    velocityX: 0,
    velocityY: 0,
  })

  await expect
    .poll(async () => {
      const snapshot = await getPlayerStateSnapshot(page)
      return snapshot?.x ?? Number.NaN
    }, {
      timeout: 3_000,
    })
    .toBeGreaterThanOrEqual(PLAYER_VISUAL_HALF_WIDTH_PX - 1)
  const leftSnapshot = await getPlayerStateSnapshot(page)
  expect(leftSnapshot).not.toBeNull()
  const leftState = leftSnapshot as DebugPlayerStateSnapshot
  expect(leftState.x - PLAYER_VISUAL_HALF_WIDTH_PX).toBeGreaterThanOrEqual(
    -VISUAL_BOUNDARY_EPSILON_PX,
  )
  expect(Math.abs(leftState.x - PLAYER_VISUAL_HALF_WIDTH_PX)).toBeLessThanOrEqual(1)

  await expect(page.getByRole('heading', { name: '本局结算' })).toHaveCount(0)
})

test('black-box natural run remains stable without debug injections @landing', async ({
  page,
}) => {
  await gotoHome(page)
  await startAndEnterRunning(page)
  const initialScore = parseScore(await page.getByTestId('score-value').textContent())

  const landedPlatformIds = new Set<number>()
  await expect
    .poll(async () => {
      const snapshot = await getPlayerStateSnapshot(page)
      const platformId = snapshot?.lastLandingEvent?.platformId
      if (typeof platformId === 'number') {
        landedPlatformIds.add(platformId)
      }
      return landedPlatformIds.size
    }, {
      timeout: 20_000,
    })
    .toBeGreaterThanOrEqual(1)

  await expect
    .poll(async () => parseScore(await page.getByTestId('score-value').textContent()), {
      timeout: 10_000,
    })
    .toBeGreaterThan(initialScore + 5)

  await expectNoGameOverModal(page)
})

test('black-box steering remains responsive near boundary without spawn/player injection @landing', async ({ page }) => {
  await gotoHome(page)
  await startAndEnterRunning(page)
  await setElapsedMs(page, 20_000)

  const initialSnapshot = await getPlayerStateSnapshot(page)
  const startX = initialSnapshot?.x ?? 640

  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(1_000)
  await page.keyboard.up('ArrowRight')
  await expect
    .poll(async () => {
      const snapshot = await getPlayerStateSnapshot(page)
      return snapshot?.x ?? Number.NaN
    }, {
      timeout: 5_000,
    })
    .toBeGreaterThan(startX + 35)
  const rightMovedSnapshot = await getPlayerStateSnapshot(page)
  const rightMovedX = rightMovedSnapshot?.x ?? (startX + 35)

  await page.keyboard.down('ArrowLeft')
  await page.waitForTimeout(900)
  await page.keyboard.up('ArrowLeft')

  await expect
    .poll(async () => {
      const snapshot = await getPlayerStateSnapshot(page)
      return snapshot?.x ?? Number.NaN
    }, {
      timeout: 5_000,
    })
    .toBeLessThan(rightMovedX - 30)

  await expectNoGameOverModal(page)
})

test('black-box alternating input keeps progression without spawn/player injection @landing', async ({
  page,
}) => {
  await gotoHome(page)
  await startAndEnterRunning(page)
  await setElapsedMs(page, 20_000)
  const scoreBefore = parseScore(await page.getByTestId('score-value').textContent())

  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.down(index % 2 === 0 ? 'ArrowRight' : 'ArrowLeft')
    await page.waitForTimeout(180)
    await page.keyboard.up(index % 2 === 0 ? 'ArrowRight' : 'ArrowLeft')
    await page.waitForTimeout(160)
  }

  await expect
    .poll(async () => parseScore(await page.getByTestId('score-value').textContent()), {
      timeout: 6_000,
    })
    .toBeGreaterThan(scoreBefore + 2)
  await expectNoGameOverModal(page)
})

test('platform-to-platform drop lands on expected lower stable platform @landing', async ({ page }) => {
  await gotoHome(page)
  await startAndEnterRunning(page)

  const upperPlatformId = 9301
  const lowerPlatformId = 9302
  await setupPlatformToPlatformDrop(page, {
    upperPlatformId,
    upperPlatformType: 'vanishing',
    upperPlatformY: 332,
    upperPlatformWidth: 248,
    lowerPlatformId,
    lowerPlatformType: 'stable',
    lowerPlatformY: 498,
    lowerPlatformWidth: 276,
  })

  await waitForGroundedOnPlatform(page, lowerPlatformId, 12_000)
  await waitForLandingEventOnPlatform(page, lowerPlatformId, 12_000)
  await expect(page.getByRole('heading', { name: '本局结算' })).toHaveCount(0)
})

test('stable middle landing remains recoverable without horizontal input in loop @landing', async ({
  page,
}) => {
  await gotoHome(page)
  await startAndEnterRunning(page)

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const upperPlatformId = 9400 + attempt * 2
    const lowerPlatformId = upperPlatformId + 1
    const currentSnapshot = await getPlayerStateSnapshot(page)
    const cameraScrollY = currentSnapshot?.cameraScrollY ?? 0
    const upperPlatformY = Math.round(cameraScrollY + 360 + (attempt % 2) * 8)
    const lowerPlatformY = upperPlatformY + 164 + (attempt % 2) * 10
    await setupPlatformToPlatformDrop(page, {
      upperPlatformId,
      upperPlatformType: 'vanishing',
      upperPlatformY,
      upperPlatformWidth: 236,
      lowerPlatformId,
      lowerPlatformType: 'stable',
      lowerPlatformY,
      lowerPlatformWidth: 268,
    })

    await waitForGroundedOnPlatform(page, lowerPlatformId, 12_000)
    const snapshot = await getPlayerStateSnapshot(page)
    expect(snapshot?.velocityX ?? 0).toBeLessThan(5)
    await expect(page.getByRole('heading', { name: '本局结算' })).toHaveCount(0)
  }
})

test('moving platform path confirms real landing instead of only no-death assertion @landing', async ({
  page,
}) => {
  await gotoHome(page)
  await startAndEnterRunning(page)

  const upperPlatformId = 9501
  const lowerPlatformId = 9502
  await setupPlatformToPlatformDrop(page, {
    upperPlatformId,
    upperPlatformType: 'vanishing',
    upperPlatformY: 336,
    upperPlatformWidth: 250,
    lowerPlatformId,
    lowerPlatformType: 'moving',
    lowerPlatformY: 506,
    lowerPlatformWidth: 320,
    lowerMoveSpeed: 86,
    lowerDirection: 1,
  })

  await waitForGroundedOnPlatform(page, lowerPlatformId, 12_000)
  await waitForLandingEventOnPlatform(page, lowerPlatformId, 12_000)
  await expect(page.getByRole('heading', { name: '本局结算' })).toHaveCount(0)
})

test('player drops when only stuck on platform edge instead of jittering on air support @landing', async ({
  page,
}) => {
  await gotoHome(page)
  await startAndEnterRunning(page)
  await setElapsedMs(page, 20_000)

  const platformId = 9651
  const platformY = 520
  const startY = resolveStandingPlayerY(platformY) + 6
  await clearTestPlatforms(page)
  await spawnTestPlatform(page, {
    id: platformId,
    type: 'stable',
    x: 640,
    y: platformY,
    width: 220,
  })
  // 放在平台边缘外侧，旧逻辑可能因边缘容错反复吸附导致“空气平台抖动”。
  await setPlayerState(page, {
    x: 762,
    y: startY,
    velocityX: 0,
    velocityY: 220,
  })

  await expect
    .poll(async () => {
      const snapshot = await getPlayerStateSnapshot(page)
      return Boolean(
        snapshot &&
        snapshot.y > startY + 120 &&
        snapshot.currentGroundPlatformId !== platformId,
      )
    }, {
      timeout: 8_000,
    })
    .toBe(true)

  await expect(page.getByRole('heading', { name: '本局结算' })).toHaveCount(0)
})

test('tiny edge overlap on stable platform should release to fall instead of jittering in place @landing', async ({
  page,
}) => {
  await gotoHome(page)
  await startAndEnterRunning(page)
  await setElapsedMs(page, 20_000)

  const platformId = 9661
  const platformY = 620
  const startY = resolveStandingPlayerY(platformY) + 5
  await clearTestPlatforms(page)
  await spawnTestPlatform(page, {
    id: platformId,
    type: 'stable',
    x: 640,
    y: platformY,
    width: 220,
  })
  // 平台右边缘为 750，当前角色体在 x=773 时仅约 2px 重叠，最容易触发边缘“空气托举”。
  await setPlayerState(page, {
    x: 773,
    y: startY,
    velocityX: 0,
    velocityY: 180,
  })

  let escaped = false
  const samples: Array<{
    x: number
    y: number
    bodyLeft: number
    bodyRight: number
    bodyWidth: number
    rawOverlap: number
    velocityY: number
    blockedDown: boolean
    touchingDown: boolean
    grounded: boolean
    currentGroundSource: DebugPlayerStateSnapshot['currentGroundSource']
    currentGroundPlatformId: number | null
  }> = []
  for (let index = 0; index < 80; index += 1) {
    const snapshot = await getPlayerStateSnapshot(page)
    if (snapshot) {
      samples.push({
        x: Number(snapshot.x.toFixed(2)),
        y: Number(snapshot.y.toFixed(2)),
        bodyLeft: Number(snapshot.bodyLeft.toFixed(2)),
        bodyRight: Number(snapshot.bodyRight.toFixed(2)),
        bodyWidth: Number(snapshot.bodyWidth.toFixed(2)),
        rawOverlap: Number(
          (
            Math.min(snapshot.bodyRight, 750) -
            Math.max(snapshot.bodyLeft, 530)
          ).toFixed(2),
        ),
        velocityY: Number(snapshot.velocityY.toFixed(2)),
        blockedDown: snapshot.blockedDown,
        touchingDown: snapshot.touchingDown,
        grounded: snapshot.grounded,
        currentGroundSource: snapshot.currentGroundSource,
        currentGroundPlatformId: snapshot.currentGroundPlatformId,
      })
      if (
        snapshot.y > startY + 80 &&
        !snapshot.grounded &&
        snapshot.currentGroundPlatformId !== platformId
      ) {
        escaped = true
        break
      }
    }
    await page.waitForTimeout(40)
  }

  if (!escaped) {
    console.error(`[tiny-edge-debug] ${JSON.stringify(samples.slice(-30))}`)
  }
  expect(escaped).toBe(true)

  await expect(page.getByRole('heading', { name: '本局结算' })).toHaveCount(0)
})

test('moving platform continues oscillating after touching both horizontal bounds @landing', async ({
  page,
}) => {
  await gotoHome(page)
  await startAndEnterRunning(page)
  await setElapsedMs(page, 20_000)

  const playerSupportPlatformY = 700
  const playerStandingY = resolveStandingPlayerY(playerSupportPlatformY)
  const platformId = 9701
  await clearTestPlatforms(page)
  await spawnTestPlatform(page, {
    id: 9700,
    type: 'stable',
    x: 640,
    y: playerSupportPlatformY,
    width: 280,
  })
  await spawnTestPlatform(page, {
    id: platformId,
    type: 'moving',
    x: 640,
    y: 1600,
    width: 240,
    moveSpeed: 360,
    direction: 1,
  })
  await setPlayerState(page, {
    x: 640,
    y: playerStandingY,
    velocityX: 0,
    velocityY: 0,
  })

  let touchedAnyBound = false
  let reboundConfirmed = false
  let movedAwayAfterRebound = false
  const boundEpsilon = 24
  let leftReboundX: number | null = null
  let rightReboundX: number | null = null
  const samples: Array<{
    x: number
    velocityX: number
    moves: boolean
    direction: number
    minX: number
    maxX: number
    active: boolean
    enabled: boolean
  }> = []

  for (let index = 0; index < 220; index += 1) {
    if (index % 20 === 0) {
      await setElapsedMs(page, 20_000)
    }
    const snapshot = await getPlatformState(page, platformId)
    expect(snapshot).not.toBeNull()
    const state = snapshot as DebugPlatformStateSnapshot
    samples.push({
      x: state.x,
      velocityX: state.velocityX,
      moves: state.moves,
      direction: state.moveDirection,
      minX: state.moveMinX,
      maxX: state.moveMaxX,
      active: state.active,
      enabled: state.enabled,
    })
    expect(state.active).toBe(true)
    expect(state.enabled).toBe(true)
    expect(state.type).toBe('moving')

    if (state.x <= state.moveMinX + boundEpsilon) {
      touchedAnyBound = true
      if (state.moveDirection === 1) {
        reboundConfirmed = true
        leftReboundX = state.x
      }
    } else if (state.x >= state.moveMaxX - boundEpsilon) {
      touchedAnyBound = true
      if (state.moveDirection === -1) {
        reboundConfirmed = true
        rightReboundX = state.x
      }
    }

    if (leftReboundX !== null && state.x >= leftReboundX + 120) {
      movedAwayAfterRebound = true
    }
    if (rightReboundX !== null && state.x <= rightReboundX - 120) {
      movedAwayAfterRebound = true
    }

    if (touchedAnyBound && reboundConfirmed && movedAwayAfterRebound) {
      break
    }
    await page.waitForTimeout(40)
  }

  if (!touchedAnyBound || !reboundConfirmed || !movedAwayAfterRebound) {
    console.error(`[moving-bounds-debug] ${JSON.stringify(samples.slice(-40))}`)
  }
  expect(touchedAnyBound).toBe(true)
  expect(reboundConfirmed).toBe(true)
  expect(movedAwayAfterRebound).toBe(true)
  await expect(page.getByRole('heading', { name: '本局结算' })).toHaveCount(0)
})

test('vanishing chain path lands on fallback stable platform after middle break @landing', async ({
  page,
}) => {
  await gotoHome(page)
  await startAndEnterRunning(page)

  const upperPlatformId = 9601
  const middlePlatformId = 9602
  const lowerPlatformId = 9603
  await clearTestPlatforms(page)
  await spawnTestPlatform(page, {
    id: upperPlatformId,
    type: 'vanishing',
    x: 640,
    y: 332,
    width: 244,
  })
  await spawnTestPlatform(page, {
    id: middlePlatformId,
    type: 'vanishing',
    x: 640,
    y: 486,
    width: 238,
  })
  await spawnTestPlatform(page, {
    id: lowerPlatformId,
    type: 'stable',
    x: 640,
    y: 636,
    width: 320,
  })
  await setPlayerState(page, {
    x: 640,
    y: resolveStandingPlayerY(332) - 64,
    velocityX: 0,
    velocityY: 360,
  })

  await waitForGroundedOnPlatform(page, lowerPlatformId, 16_000)
  await waitForLandingEventOnPlatform(page, lowerPlatformId, 16_000)
  await expect(page.getByRole('heading', { name: '本局结算' })).toHaveCount(0)
})
