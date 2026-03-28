import { expect, test } from "@playwright/test";

import { createEvent, getLatestBlockTimestamp, getEventCloseTime, increaseTime } from "../utils/chain";
import { ensureWalletConnected } from "../utils/ui";

test("无流动性时仍可直接买入是", async ({ page }) => {
  const eventId = await createEvent(`E2E Direct Buy ${Date.now()}`);

  await page.goto(`/events/${eventId.toString()}`, { waitUntil: "domcontentloaded" });
  await ensureWalletConnected(page);

  await expect(page.getByTestId("detail-buy-amount")).toBeVisible();
  await page.getByTestId("detail-buy-amount").fill("0.2");
  await page.getByTestId("detail-buy-yes").click();
  await expect(page.getByText("已买入“是”：0.2 ETH")).toBeVisible();
});

test("closeTime 后（未最终化）仍可买入", async ({ page }) => {
  const eventId = await createEvent(`E2E Close Buy Still Allowed ${Date.now()}`, 30);
  const chainNow = await getLatestBlockTimestamp();
  const closeTime = await getEventCloseTime(eventId);
  await increaseTime(Math.max(1, closeTime + 1 - chainNow));

  await page.goto(`/events/${eventId.toString()}`, { waitUntil: "domcontentloaded" });
  await ensureWalletConnected(page);

  await expect(page.getByTestId("detail-buy-yes")).toBeEnabled();
  await page.getByTestId("detail-buy-amount").fill("0.1");
  await page.getByTestId("detail-buy-yes").click();
  await expect(page.getByText("已买入“是”：0.1 ETH")).toBeVisible();
});

test("resolver 提案后（冷静期内）仍可买入", async ({ page }) => {
  const eventId = await createEvent(`E2E Proposed Buy Still Allowed ${Date.now()}`, 30);
  const chainNow = await getLatestBlockTimestamp();
  const closeTime = await getEventCloseTime(eventId);
  await increaseTime(Math.max(1, closeTime + 1 - chainNow));

  await page.goto(`/events/${eventId.toString()}/resolve`, { waitUntil: "domcontentloaded" });
  await ensureWalletConnected(page);
  await expect(page.getByTestId("resolve-propose-yes")).toBeEnabled();
  await page.getByTestId("resolve-propose-yes").click();
  await expect(page.getByText("已提案")).toBeVisible();

  await page.getByRole("link", { name: "返回事件详情" }).click();
  await expect(page).toHaveURL(new RegExp(`/events/${eventId.toString()}$`));
  await ensureWalletConnected(page);

  await expect(page.getByTestId("detail-buy-yes")).toBeEnabled();
  await page.getByTestId("detail-buy-amount").fill("0.1");
  await page.getByTestId("detail-buy-yes").click();
  await expect(page.getByText("已买入“是”：0.1 ETH")).toBeVisible();
});
