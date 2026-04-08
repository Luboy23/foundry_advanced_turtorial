import { expect, test } from '@playwright/test'

test('死亡结算 @smoke', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('stage-title-cn')).toHaveText('战斗至死')
})

test('手动结算', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '结算' })).toBeVisible()
})

test('购弓再战', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('霜翎逐月永久解锁')).toBeVisible()
})
