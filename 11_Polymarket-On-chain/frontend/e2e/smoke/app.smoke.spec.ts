import { expect, test } from "@playwright/test";

import { ensureEventExists } from "../utils/chain";
import { ensureWalletConnected } from "../utils/ui";

test("应用可启动且 owner/resolver 可访问核心页面", async ({ page }) => {
  const eventId = await ensureEventExists();

  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "事件大厅" })).toBeVisible();
  await expect(page.getByTestId("event-tag-bar")).toBeVisible();
  await expect(page.getByTestId("event-tag-filter-all")).toBeVisible();
  await expect(page.getByTestId("event-tag-filter-finance")).toBeVisible();
  await expect(page.getByTestId("event-tag-filter-sports")).toBeVisible();
  await ensureWalletConnected(page);

  await page.goto("/events/create");
  await ensureWalletConnected(page);
  await expect(page.getByTestId("create-event-submit")).toBeVisible();

  await page.goto("/events/resolve");
  await expect(page.getByRole("heading", { name: "事件结算" })).toBeVisible();

  await page.goto(`/events/${eventId.toString()}/resolve`);
  await ensureWalletConnected(page);
  await expect(page.getByTestId("resolve-actions-card")).toBeVisible();
});
