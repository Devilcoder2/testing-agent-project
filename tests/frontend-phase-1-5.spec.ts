import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

async function signIn(page: Page) {
  await page.goto(baseUrl);
  await page.getByLabel("Email").fill("ava.tester@example.test");
  await page.getByLabel("Password").fill("sentinel-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Quality, made observable." })).toBeVisible();
}

test("provides routed, keyboard-accessible, reduced-motion-safe recording UI", async ({ page }) => {
  await signIn(page);

  const newRecording = page.locator(".topbar").getByRole("link", { name: "New recording" });
  await newRecording.focus();
  await expect(newRecording).toBeFocused();

  await page.getByLabel("Product name").fill("   ");
  await page.getByRole("button", { name: "Create Product" }).click();
  await expect(page.getByText("Product name is required.")).toBeVisible();

  await newRecording.click();
  await expect(page).toHaveURL(/\/recordings\/new/);
  await expect(page.getByRole("heading", { name: "Create a recording workspace" })).toBeVisible();

  const testName = `Frontend workspace ${Date.now()}`;
  await page.getByLabel("Test Name").fill(testName);
  await page.getByRole("button", { name: "Create recording workspace" }).click();
  await expect(page).toHaveURL(/\/recordings\/[a-z0-9]+$/);
  await expect(page.locator(".recording-workspace")).toBeVisible();
  await expect(page.getByRole("heading", { name: testName })).toBeVisible();

  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.getByRole("heading", { name: "Use a wider screen to record a live journey." })).toBeVisible();
  await expect(page.locator(".recording-workspace")).toBeHidden();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--motion-base").trim())).toBe("0ms");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator(".recording-bar").getByRole("button", { name: "Back to dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
