import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

async function signIn(page: Page) {
  await page.goto(baseUrl);
  await page.getByLabel("Email").fill("ava.tester@example.test");
  await page.getByLabel("Password").fill("sentinel-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("shows safe Telegram integration status without exposing provider configuration", async ({ page }) => {
  await signIn(page);
  await page.getByLabel("Open account integrations").click();
  await expect(page).toHaveURL(/\/account\/integrations$/);
  await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
  await expect(page.getByText("Telegram Run Assistant")).toBeVisible();
  await expect(page.getByRole("button", { name: "Get Telegram link" }).or(page.getByRole("button", { name: "Unlink Telegram" })).or(page.getByText("Telegram is not configured for this local Sentinel deployment."))).toBeVisible();
  await expect(page.locator("body")).not.toContainText("TELEGRAM_BOT_TOKEN");
  await expect(page.locator("body")).not.toContainText("TELEGRAM_WEBHOOK_SECRET");

  await page.goto(`${baseUrl}/admin`);
  await expect(page.getByRole("heading", { name: "People and access" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Telegram Run Assistant" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Activate webhook|Deactivate webhook/ })).toBeVisible();
});

test("keeps Telegram administration controls unavailable to a Tester", async ({ page }) => {
  await page.goto(baseUrl);
  await page.getByLabel("Email").fill("ben.tester@example.test");
  await page.getByLabel("Password").fill("sentinel-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`${baseUrl}/admin`);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "People and access" })).toHaveCount(0);

  const status = await page.evaluate(async () => (await fetch("/api/admin/telegram")).status);
  expect(status).toBe(403);
});
