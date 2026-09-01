import { expect, test } from "@playwright/test";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

test("keeps optional GitHub controls safe when no repository integration is configured", async ({ page }) => {
  await page.goto(baseUrl);
  await page.getByLabel("Email").fill("ava.tester@example.test");
  await page.getByLabel("Password").fill("sentinel-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`${baseUrl}/products`);
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  await page.getByRole("button", { name: /^More actions for / }).first().click();
  await page.getByRole("menuitem", { name: "GitHub", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "GitHub repositories" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/GitHub is not available|Connected repositories/)).toBeVisible();
  await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
  await expect(dialog).not.toContainText("GITHUB_APP_PRIVATE_KEY");
  await expect(dialog).not.toContainText("GITHUB_WEBHOOK_SECRET");
  await expect(dialog).toHaveCSS("overflow-y", "hidden");
  await expect(dialog.locator(".github-settings-modal__content")).toHaveCSS("overflow-y", "auto");
  await expect(page.locator(".modal-backdrop")).toHaveCSS("z-index", "100");
  await page.setViewportSize({ width: 390, height: 720 });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".github-settings-modal__content")).toHaveCSS("overflow-y", "auto");
  await dialog.getByText(/GitHub is not available|Connected repositories/).click();
  await expect(dialog).toBeVisible();
  await page.locator(".modal-backdrop").click({ position: { x: 4, y: 4 } });
  await expect(dialog).toHaveCount(0);

  await page.goto(`${baseUrl}/test-cases`);
  await expect(page.getByRole("heading", { name: "Test Cases" })).toBeVisible();
  await expect(page.getByLabel("Filter by Product")).toBeVisible();
});
