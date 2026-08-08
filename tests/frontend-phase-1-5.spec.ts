import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

async function signIn(page: Page) {
  await page.goto(baseUrl);
  await page.getByLabel("Email").fill("ava.tester@example.test");
  await page.getByLabel("Password").fill("sentinel-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

test("provides routed, keyboard-accessible, reduced-motion-safe recording UI", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Test Cases by Product" })).toBeVisible();
  await expect(page.getByText("Test inventory", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Product context", { exact: true })).toHaveCount(0);

  const navigationToggle = page.getByRole("button", { name: "Toggle navigation" });
  await navigationToggle.click();
  await expect(page.locator(".app-shell")).toHaveClass(/app-shell--sidebar-collapsed/);
  await expect(page.locator(".sidebar__link-label").first()).toBeHidden();

  await page.locator(".sidebar").getByRole("link", { name: "Test Cases" }).click();
  await expect(page).toHaveURL(/\/test-cases$/);
  await expect(page.locator(".app-shell")).toHaveClass(/app-shell--sidebar-collapsed/);
  await expect(page.locator(".sidebar__link-label").first()).toBeHidden();
  await expect(page.getByLabel("Filter by Product")).toBeVisible();
  await expect(page.locator(".page-header").getByText(/\d+ \/ \d+ visible Test Cases?/)).toBeVisible();
  await expect(page.locator(".inventory-toolbar")).toHaveCSS("margin-bottom", "24px");
  await navigationToggle.click();
  await expect(page.locator(".app-shell")).not.toHaveClass(/app-shell--sidebar-collapsed/);
  await expect(page.locator(".sidebar__link-label").first()).toBeVisible();
  await page.locator(".sidebar").getByRole("link", { name: "Products" }).click();
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  const newRecording = page.locator(".topbar").getByRole("link", { name: "New recording" });
  await expect(page.getByRole("link", { name: "New recording" })).toHaveCount(1);
  await newRecording.focus();
  await expect(newRecording).toBeFocused();

  await page.getByRole("button", { name: "New product" }).click();
  await expect(page.getByRole("dialog", { name: "Create new Product" })).toBeVisible();
  await page.getByLabel("Product name").fill("   ");
  await page.getByRole("button", { name: "Create Product" }).click();
  await expect(page.getByRole("dialog", { name: "Create new Product" }).getByText("Product name is required.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "Create new Product" })).toHaveCount(0);

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
