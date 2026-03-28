import { expect, type Page } from "@playwright/test";

export async function ensureWalletConnected(page: Page) {
  const networkBadge = page.getByTestId("wallet-network-badge");
  const connectButton = page.getByTestId("wallet-connect-button");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await networkBadge.isVisible().catch(() => false)) {
      await expect(networkBadge).toContainText("本地测试网");
      return;
    }

    if (await connectButton.isVisible().catch(() => false)) {
      if (!(await connectButton.isDisabled().catch(() => true))) {
        await connectButton.click();
      }
    }

    await page.waitForTimeout(400);
  }

  await expect(networkBadge).toContainText("本地测试网");
}
