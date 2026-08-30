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
  if (product) {
    const testCases = await prisma.testCase.findMany({ where: { productId: product.id }, select: { id: true } });
    if (testCases.length) {
      await prisma.auditEvent.deleteMany({ where: { entityType: "TestCase", entityId: { in: testCases.map((testCase) => testCase.id) } } });
      await prisma.testCase.deleteMany({ where: { id: { in: testCases.map((testCase) => testCase.id) } } });
    }
    await prisma.recordingSession.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.auditEvent.deleteMany({ where: { entityId: product.id } });
  }
  await prisma.productDeletionRequest.deleteMany({ where: { productName } });
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
    await renamedProduct.getByRole("button", { name: `More actions for ${renamedProductName}` }).click();
    await expect(renamedProduct.getByRole("link", { name: "View Test Cases" })).toBeVisible();
    await page.getByRole("heading", { name: "Products" }).click();
    await expect(renamedProduct.getByRole("link", { name: "View Test Cases" })).toBeHidden();
    await renamedProduct.getByRole("button", { name: `More actions for ${renamedProductName}` }).click();
    await renamedProduct.getByRole("link", { name: "View Test Cases" }).click();
    await expect(page).toHaveURL(/\/test-cases\?productId=/);
    await expect(page.getByLabel("Filter by Product").locator("option:checked")).toHaveText(renamedProductName);
    await page.getByRole("navigation", { name: "Workspace sections" }).getByRole("link", { name: "Products" }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();

    await page.locator(".command-masthead").getByRole("button", { name: "New recording" }).click();
    await expect(page.getByRole("dialog", { name: "Create recording workspace" })).toBeVisible();
    await expect(page.getByLabel("Product").locator("option:checked")).toHaveText(renamedProductName);
    await page.getByLabel("Test Name").fill(testName);
    await page.getByRole("button", { name: "Create recording workspace" }).click();
    await expect(page.locator(".browser-stage").getByRole("button", { name: "Launch live browser" })).toBeVisible();
    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await expect(page.getByRole("dialog", { name: "Save or discard this draft" })).toBeVisible();
    await page.getByRole("button", { name: "Discard Test Case" }).click();

    await signIn(page, "ava.tester@example.test", "sentinel-dev");
    await page.getByRole("link", { name: "Products" }).click();
    await expect(page).toHaveURL(/\/products$/);
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

test("requires explicit confirmation and reports background Product deletion", async ({ page }) => {
  const productName = `Delete UI Product ${Date.now()}`;
  try {
    await signIn(page, "ava.tester@example.test", "sentinel-dev");
    await page.getByRole("link", { name: "Products" }).click();
    await page.getByRole("button", { name: "New product" }).click();
    await page.getByLabel("Product name").fill(productName);
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect(page.getByRole("heading", { name: productName })).toBeVisible({ timeout: 10_000 });

    const product = page.locator(".product-list__item").filter({ hasText: productName });
    await expect(product.getByRole("button", { name: `Edit ${productName}` })).toBeVisible();
    await expect(product.getByRole("button", { name: `Delete ${productName}` })).toBeVisible();
    const moreActions = product.getByRole("button", { name: `More actions for ${productName}` });
    await expect(moreActions).toBeVisible();
    await moreActions.press("Enter");
    await expect(product.getByRole("link", { name: "View Test Cases" })).toBeVisible();
    await moreActions.press("Enter");
    await product.getByRole("button", { name: `Delete ${productName}` }).click();

    const dialog = page.getByRole("dialog", { name: `Delete “${productName}”?` });
    await expect(dialog).toContainText("This will permanently delete");
    await expect(dialog).toContainText("affected Release");
    const confirmButton = dialog.getByRole("button", { name: "Delete Product" });
    await expect(confirmButton).toBeDisabled();
    await dialog.getByLabel("Type DELETE to confirm").fill("delete");
    await expect(confirmButton).toBeDisabled();
    await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    await expect(page.getByText(new RegExp(`Deleting .*${productName}.*(queued|progress)`, "i"))).toBeVisible();
    await expect(page.getByRole("heading", { name: productName })).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText(new RegExp(`${productName}.*deleted`, "i"))).toBeVisible();
  } finally {
    await cleanupProduct(productName);
  }
});
