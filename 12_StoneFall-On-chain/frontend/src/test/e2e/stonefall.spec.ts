import { expect, test, type Locator, type Page } from '@playwright/test'

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
    .poll(async () => {
      return page.evaluate(() => {
        return Boolean(
          (window as Window & {
            __STONEFALL_DEBUG__?: unknown
          }).__STONEFALL_DEBUG__,
        )
      })
    }, {
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

const forceGameOver = async (page: Page) => {
  await page.evaluate(() => {
    ;(window as Window & {
      __STONEFALL_DEBUG__?: {
        forceGameOver: () => void
      }
    }).__STONEFALL_DEBUG__?.forceGameOver()
  })
}

const setElapsed = async (page: Page, elapsedMs: number) => {
  await page.evaluate((value) => {
    ;(window as Window & {
      __STONEFALL_DEBUG__?: {
        setElapsedMs: (nextMs: number) => void
      }
    }).__STONEFALL_DEBUG__?.setElapsedMs(value)
  }, elapsedMs)
}

const waitForPositiveScore = async (page: Page) => {
  await expect
    .poll(async () => parseScore(await page.getByTestId('score-value').textContent()), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0)
}

const modalCloseButtons = (page: Page): Locator =>
  page.getByRole('button', { name: '关闭' }).first()

test('start game and score should increase after countdown @smoke', async ({ page }) => {
  await gotoHome(page)
  await startAndEnterRunning(page)

  await setElapsed(page, 35_000)

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
  await setElapsed(page, 24_000)
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

test('restart after game over resumes hazard spawning and score growth', async ({ page }) => {
  await gotoHome(page)
  await startAndEnterRunning(page)
  await setElapsed(page, 35_000)
  await waitForPositiveScore(page)
  await forceGameOver(page)

  const restartButton = page.getByRole('button', { name: '再来一局' })
  await expect(page.getByText('链上提交状态：成绩已成功上链')).toBeVisible({
    timeout: 15_000,
  })
  await expect(restartButton).toBeEnabled()

  await restartButton.click()
  await expect(page.getByRole('heading', { name: '本局结算' })).toHaveCount(0)
  await expect
    .poll(async () => parseScore(await page.getByTestId('score-value').textContent()), {
      timeout: 5_000,
    })
    .toBe(0)
  await expect(page.getByTestId('control-pause-resume')).toBeEnabled({
    timeout: 25_000,
  })

  await setElapsed(page, 35_000)
  await expect
    .poll(async () => parseScore(await page.getByTestId('score-value').textContent()), {
      timeout: 8_000,
    })
    .toBeGreaterThan(0)
})

test('leaderboard and history are fetched from on-chain records', async ({ page }) => {
  await gotoHome(page)
  await startAndEnterRunning(page)
  await setElapsed(page, 31_000)
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
  await setElapsed(page, 35_000)

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
