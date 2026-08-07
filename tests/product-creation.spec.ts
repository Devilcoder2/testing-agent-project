import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3001";

async function signIn(page: Page, email: string, password: string) {
  await page.goto(baseUrl);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Saved Test Cases" })).toBeVisible();
}

test("creates, persists, and authorizes a Product through the portal", async ({ page }) => {
  const productName = `Portal Product ${Date.now()}`;
  const testName = `Product recording ${Date.now()}`;

  await signIn(page, "ava.tester@example.test", "sentinel-dev");
  await page.getByLabel("Product name").fill(productName);
  await page.getByRole("button", { name: "Create Product" }).click();
  await expect(page.getByText(`Product "${productName}" created and selected.`)).toBeVisible();
  await expect(page.getByLabel("Product").locator("option", { hasText: productName })).toHaveCount(1);
  await expect(page.getByLabel("Product").locator("option:checked")).toHaveText(productName);

  await page.getByLabel("Test Name").fill(testName);
  await page.getByRole("button", { name: "Create recording workspace" }).click();
  await expect(page.getByRole("button", { name: "Launch live browser" })).toBeVisible();
  await page.getByRole("button", { name: "Back to dashboard" }).click();

  await signIn(page, "ava.tester@example.test", "sentinel-dev");
  await expect(page.getByLabel("Product").locator("option", { hasText: productName })).toHaveCount(1);

  await page.getByLabel("Product name").fill("   ");
  await page.getByRole("button", { name: "Create Product" }).click();
  await expect(page.getByText("Product name is required.")).toBeVisible();

  await page.getByLabel("Product name").fill(productName);
  await page.getByRole("button", { name: "Create Product" }).click();
  await expect(page.getByText("You already have a Product with this name.")).toBeVisible();

  await signIn(page, "ben.tester@example.test", "sentinel-dev");
  await expect(page.getByLabel("Product").locator("option", { hasText: productName })).toHaveCount(0);
});
