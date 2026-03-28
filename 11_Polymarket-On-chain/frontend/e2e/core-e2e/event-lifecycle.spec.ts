import { expect, test } from "@playwright/test";
import { parseEther } from "viem";

import {
  extractEventIdFromUrl,
  getLatestBlockTimestamp,
  getEventCloseTime,
  getOwnerAddress,
  getUserPosition,
  increaseTime,
  setNextBlockTimestamp
} from "../utils/chain";
import { ensureWalletConnected } from "../utils/ui";

test.setTimeout(300_000);

test("创建事件 -> 买入是 -> 提案 -> 最终化 -> 赎回", async ({ page }) => {
  await page.goto("/events/create", { waitUntil: "domcontentloaded" });
  await ensureWalletConnected(page);
  const createQuestionInput = page.getByTestId("create-event-question-input");
  const createCloseDurationInput = page.getByTestId("create-event-close-duration-input");
  const createSubmitButton = page.getByTestId("create-event-submit");
  const e2eQuestion = `E2E Lifecycle ${Date.now()}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await createQuestionInput.fill(e2eQuestion);
    await createCloseDurationInput.fill("30s");
    if (await createSubmitButton.isEnabled()) {
      break;
    }
    await page.waitForTimeout(500);
  }

  await expect(createSubmitButton).toBeEnabled();
  await createSubmitButton.click();

  await expect(page).toHaveURL(/\/events\/\d+$/);
  const eventId = extractEventIdFromUrl(page.url());

  const chainNow = await getLatestBlockTimestamp();
  const closeTime = await getEventCloseTime(eventId);
  expect(closeTime - chainNow).toBeGreaterThanOrEqual(1);
  expect(closeTime - chainNow).toBeLessThanOrEqual(40);

  await page.goto(`/events/${eventId.toString()}`, { waitUntil: "domcontentloaded" });
  await ensureWalletConnected(page);
  await page.getByTestId("detail-buy-amount").fill("1");
  await page.getByTestId("detail-buy-yes").click();

  const owner = getOwnerAddress();
  await expect
    .poll(async () => {
      const position = await getUserPosition(eventId, owner);
      return position.yes.toString();
    }, { timeout: 120_000, intervals: [1_000, 2_000, 5_000] })
    .not.toBe("0");

  const chainNowAfterBuy = await getLatestBlockTimestamp();
  await setNextBlockTimestamp(Math.max(closeTime + 1, chainNowAfterBuy + 1));

  await page.goto(`/events/${eventId.toString()}/resolve`, { waitUntil: "domcontentloaded" });
  await ensureWalletConnected(page);
  await expect(page.getByTestId("resolve-propose-yes")).toBeEnabled();
  await page.getByTestId("resolve-propose-yes").click();
  await expect(page.getByText("已提案")).toBeVisible();

  await increaseTime(31);
  await expect(page.getByTestId("resolve-finalize")).toBeEnabled();
  await page.getByTestId("resolve-finalize").click();
  await expect(page.getByText("已确认")).toBeVisible();

  const beforeRedeem = await getUserPosition(eventId, owner);
  const redeemAmount = parseEther("0.1");

  await page.goto(`/events/${eventId.toString()}`, { waitUntil: "domcontentloaded" });
  await ensureWalletConnected(page);
  await page.getByTestId("redeem-yes-input").fill("0.1");
  await page.getByTestId("redeem-no-input").fill("0");
  await page.getByTestId("redeem-submit").click();

  await expect.poll(async () => (await getUserPosition(eventId, owner)).yes.toString()).toBe(
    (beforeRedeem.yes - redeemAmount).toString()
  );
});
