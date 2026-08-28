import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

async function signIn(page: Page) {
  await page.goto(baseUrl);
  await page.getByLabel("Email").fill("ava.tester@example.test");
  await page.getByLabel("Password").fill("sentinel-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("returns an expired protected session to sign-in without page error feedback", async ({ page }) => {
  await signIn(page);
  await page.getByRole("navigation", { name: "Workspace sections" }).getByRole("link", { name: "Products" }).click();
  await expect(page).toHaveURL(/\/products$/);

  let logoutRequests = 0;
  await page.route("**/api/auth/logout", async (route) => {
    logoutRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signedOut: true }) });
  });
  await page.route("**/api/dashboard**", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Sign in required." }) });
  });
  await page.route("**/api/pilot-readiness", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Sign in required." }) });
  });

  await page.getByRole("navigation", { name: "Workspace sections" }).getByRole("link", { name: "Dashboard" }).click();

  await expect(page).toHaveURL(`${baseUrl}/`);
  await expect(page.getByRole("heading", { name: "Sign in to Sentinel" })).toBeVisible();
  await expect(page.getByText("Sign in required.", { exact: true })).toHaveCount(0);
  await expect.poll(() => logoutRequests).toBe(1);
});

test("keeps invalid credentials and authenticated permission denials in context", async ({ page }) => {
  await page.goto(baseUrl);
  await page.getByLabel("Email").fill("ava.tester@example.test");
  await page.getByLabel("Password").fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password.", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(`${baseUrl}/`);

  await page.getByLabel("Password").fill("sentinel-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  let logoutRequests = 0;
  await page.route("**/api/auth/logout", async (route) => {
    logoutRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signedOut: true }) });
  });
  await page.route("**/api/products", async (route) => {
    await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "You do not have access to this resource." }) });
  });

  await page.getByRole("navigation", { name: "Workspace sections" }).getByRole("link", { name: "Products" }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByText("You do not have access to this resource.", { exact: true })).toBeVisible();
  expect(logoutRequests).toBe(0);
});
