import { expect, test } from "@playwright/test";

import { ensureEventExists } from "../utils/chain";
import { ensureWalletConnected } from "../utils/ui";

test("非 owner / 非 resolver 的权限门禁可见", async ({ page }) => {
  const eventId = await ensureEventExists();

  await page.goto("/events");
  await ensureWalletConnected(page);

  await page.goto("/events/create");
  await ensureWalletConnected(page);
  await expect(page.getByTestId("create-no-permission-card")).toBeVisible();

  await page.goto(`/events/${eventId.toString()}/resolve`);
  await ensureWalletConnected(page);
  await expect(page.getByTestId("resolve-no-permission-card")).toBeVisible();
});
