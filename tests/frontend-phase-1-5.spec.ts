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
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await signIn(page);
  expect(consoleErrors.filter((message) => message.includes("hydrated"))).toEqual([]);
  await expect(page.getByRole("heading", { name: "Health overview" })).toBeVisible();
  await expect(page.getByText("Test inventory", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Product context", { exact: true })).toHaveCount(0);

  const workspaceNavigation = page.getByRole("navigation", { name: "Workspace sections" });
  await expect(workspaceNavigation.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  const initialTheme = await page.locator("html").getAttribute("data-theme");
  const changedTheme = initialTheme === "dark" ? "light" : "dark";
  await page.locator(".command-masthead").locator(".theme-control").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", changedTheme);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", changedTheme);

  await workspaceNavigation.getByRole("link", { name: "Test Cases" }).click();
  await expect(page).toHaveURL(/\/test-cases$/);
  await expect(workspaceNavigation.getByRole("link", { name: "Test Cases" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByLabel("Filter by Product")).toBeVisible();
  await expect(page.locator(".page-header").getByText(/\d+ \/ \d+ visible Test Cases?/)).toBeVisible();
  await expect(page.locator(".inventory-toolbar")).toHaveCSS("margin-bottom", "20px");

  await page.setViewportSize({ width: 900, height: 900 });
  await expect(workspaceNavigation).toBeHidden();
  await page.getByRole("button", { name: "Open workspace navigation" }).click();
  const navigationSheet = page.getByRole("complementary", { name: "Workspace navigation" });
  await expect(navigationSheet).toBeVisible();
  await navigationSheet.getByRole("link", { name: "Products" }).click();
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  await expect(navigationSheet).toHaveCount(0);

  await page.setViewportSize({ width: 1440, height: 900 });
  const newRecording = page.locator(".command-masthead").getByRole("button", { name: "New recording" });
  await expect(page.getByRole("button", { name: "New recording" })).toHaveCount(1);
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
  await expect(page.getByRole("dialog", { name: "Create recording workspace" })).toBeVisible();
  await expect(page).not.toHaveURL(/\/recordings\/new/);

  const testName = `Frontend workspace ${Date.now()}`;
  await page.getByLabel("Test Name").fill(testName);
  await page.getByRole("button", { name: "Create recording workspace" }).click();
  await expect(page).toHaveURL(/\/recordings\/[a-z0-9]+$/);
  await expect(page.locator(".recording-workspace")).toBeVisible();
  await expect(page.locator(".command-masthead")).toHaveCount(0);
  await expect(page.locator(".section-nav")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: testName })).toBeVisible();
  await expect(page.locator(".recording-bar").getByRole("button", { name: "Launch live browser" })).toHaveCount(0);
  const browserStage = page.locator(".browser-stage");
  await browserStage.getByRole("button", { name: "Launch live browser" }).click();
  const liveBrowser = page.getByTitle("Live recording browser");
  await expect(liveBrowser).toBeVisible({ timeout: 15_000 });
  await expect(page.frameLocator('iframe[title="Live recording browser"]').locator("#noVNC_control_bar_anchor")).toBeHidden();
  const [stageBox, browserBox] = await Promise.all([browserStage.boundingBox(), liveBrowser.boundingBox()]);
  expect(browserBox?.width).toBe(stageBox?.width);
  expect(browserBox?.height).toBe(stageBox?.height);

  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.getByRole("heading", { name: "Use a wider screen to record a live journey." })).toBeVisible();
  await expect(page.locator(".recording-workspace")).toBeHidden();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--motion-base").trim())).toBe("0ms");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator(".recording-bar").getByRole("button", { name: "Back to dashboard" }).click();
  await expect(page.getByRole("dialog", { name: "Save or discard this draft" })).toBeVisible();
  await expect(page).toHaveURL(/\/recordings\/[a-z0-9]+$/);
  await page.getByRole("button", { name: "Discard Test Case" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("uses compact icon controls for the recording Step Log rail", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "New recording" }).click();
  await page.getByLabel("Test Name").fill(`Compact rail ${Date.now()}`);
  await page.getByRole("button", { name: "Create recording workspace" }).click();

  const collapse = page.getByRole("button", { name: "Collapse Step Log" });
  await expect(collapse).toHaveCSS("font-size", "0px");
  await collapse.click();
  const expand = page.getByRole("button", { name: "Expand Step Log" });
  await expect(expand).toBeVisible();
  await expect(expand).toHaveCSS("font-size", "0px");
  await expect(expand).toHaveCSS("writing-mode", "horizontal-tb");
  await expect(page.locator(".step-panel__rail-count")).toBeHidden();
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("keeps the workspace shell responsive during rapid section navigation", async ({ page }) => {
  await signIn(page);
  const masthead = page.locator(".command-masthead");
  await masthead.evaluate((element) => { element.setAttribute("data-navigation-shell", "persistent"); });
  const navigation = page.getByRole("navigation", { name: "Workspace sections" });
  const products = navigation.getByRole("link", { name: "Products" });
  const runs = navigation.getByRole("link", { name: "Runs" });
  const releases = navigation.getByRole("link", { name: "Releases" });

  await products.click({ noWaitAfter: true });
  await expect(products).toHaveAttribute("aria-current", "page");
  await runs.click({ noWaitAfter: true });
  await expect(runs).toHaveAttribute("aria-current", "page");
  await releases.click({ noWaitAfter: true });
  await expect(releases).toHaveAttribute("aria-current", "page");

  await expect(page).toHaveURL(/\/releases$/);
  await expect(page.getByRole("heading", { name: "Releases", exact: true })).toBeVisible();
  await expect(masthead).toHaveAttribute("data-navigation-shell", "persistent");
  await expect(page.getByRole("main")).toHaveAttribute("aria-busy", "false");
});
