import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

async function signIn(page: Page, email: string, password: string) {
  await page.goto(baseUrl);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

async function cleanupProduct(productName: string) {
  const product = await prisma.product.findFirst({ where: { name: productName } });
  if (!product) return;
  const testCases = await prisma.testCase.findMany({ where: { productId: product.id }, select: { id: true } });
  if (testCases.length) {
    await prisma.auditEvent.deleteMany({ where: { entityType: "TestCase", entityId: { in: testCases.map((testCase) => testCase.id) } } });
    await prisma.testCase.deleteMany({ where: { id: { in: testCases.map((testCase) => testCase.id) } } });
  }
  await prisma.recordingSession.deleteMany({ where: { productId: product.id } });
  await prisma.product.delete({ where: { id: product.id } });
}

test("creates, persists, and authorizes a Product through the portal", async ({ page }) => {
  const productName = `Portal Product ${Date.now()}`;
  const renamedProductName = `Renamed Portal Product ${Date.now()}`;
  const testName = `Product recording ${Date.now()}`;
  let currentProductName = productName;

  try {
    await signIn(page, "ava.tester@example.test", "sentinel-dev");
    await page.getByRole("link", { name: "Products" }).click();
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
    await page.getByRole("button", { name: "New product" }).click();
    await expect(page.getByRole("dialog", { name: "Create new Product" })).toBeVisible();
    await page.getByLabel("Product name").fill(productName);
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect(page.getByText(`Product "${productName}" created and selected for your next recording.`)).toBeVisible();
    await expect(page.getByRole("heading", { name: productName })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Create new Product" })).toHaveCount(0);

    const createdProduct = page.locator(".product-list__item").filter({ hasText: productName });
    await createdProduct.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("dialog", { name: "Edit Product" })).toBeVisible();
    await page.getByLabel("Product name").fill(renamedProductName);
    await page.getByRole("button", { name: "Save changes" }).click();
    currentProductName = renamedProductName;
    await expect(page.getByText(`Product "${renamedProductName}" renamed.`)).toBeVisible();
    await expect(page.getByRole("heading", { name: renamedProductName })).toBeVisible();

    const renamedProduct = page.locator(".product-list__item").filter({ hasText: renamedProductName });
    await renamedProduct.getByRole("link", { name: "View Test Cases" }).click();
    await expect(page).toHaveURL(/\/test-cases\?productId=/);
    await expect(page.getByLabel("Filter by Product").locator("option:checked")).toHaveText(renamedProductName);
    await page.locator(".sidebar").getByRole("link", { name: "Products" }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();

    await page.locator(".topbar").getByRole("link", { name: "New recording" }).click();
    await expect(page.getByRole("heading", { name: "Create a recording workspace" })).toBeVisible();
    await expect(page.getByLabel("Product").locator("option:checked")).toHaveText(renamedProductName);
    await page.getByLabel("Test Name").fill(testName);
    await page.getByRole("button", { name: "Create recording workspace" }).click();
    await expect(page.locator(".recording-bar").getByRole("button", { name: "Launch live browser" })).toBeVisible();
    await page.getByRole("button", { name: "Back to dashboard" }).click();

    await signIn(page, "ava.tester@example.test", "sentinel-dev");
    await page.getByRole("link", { name: "Products" }).click();
    await expect(page.getByRole("heading", { name: renamedProductName })).toBeVisible();

    await page.getByRole("button", { name: "New product" }).click();
    await page.getByLabel("Product name").fill("   ");
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect(page.getByText("Product name is required.")).toBeVisible();

    await page.getByLabel("Product name").fill(renamedProductName);
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect(page.getByText("You already have a Product with this name.")).toBeVisible();

    await signIn(page, "ben.tester@example.test", "sentinel-dev");
    await page.getByRole("link", { name: "Products" }).click();
    await expect(page.getByRole("heading", { name: renamedProductName })).toHaveCount(0);
  } finally {
    await cleanupProduct(currentProductName);
  }
});
