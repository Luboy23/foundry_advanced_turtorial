import { expect, test } from "@playwright/test";

import { createEvent } from "../utils/chain";
import { ensureWalletConnected } from "../utils/ui";

test("奖池模式在无流动性时仍可直接买入", async ({ page }) => {
  const eventId = await createEvent(`E2E Wait Buy Smoke ${Date.now()}`);

  await page.goto(`/events/${eventId.toString()}`);
  await ensureWalletConnected(page);

  await expect(page.getByTestId("detail-buy-amount")).toBeVisible();
  await page.getByTestId("detail-buy-amount").fill("0.2");
  await page.getByTestId("detail-buy-yes").click();
  await expect(page.getByText("已买入“是”：0.2 ETH")).toBeVisible();
});
