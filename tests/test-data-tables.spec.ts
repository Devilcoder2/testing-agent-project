import { expect, test } from "@playwright/test";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

test("manages a multi-row Test Data table from the all-Products workspace", async ({ page }) => {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const membership = await prisma.organizationMember.findFirstOrThrow({ where: { userId: owner.id } });
  const product = await prisma.product.create({ data: { name: `Test Data UI ${Date.now()}`, organizationId: membership.organizationId, createdById: owner.id, memberships: { create: { userId: owner.id } } } });

  try {
    await page.goto(baseUrl);
    await page.getByLabel("Email").fill("ava.tester@example.test");
    await page.getByLabel("Password").fill("sentinel-dev");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("link", { name: "Test Data" }).click();
    const productFilter = page.locator(".inventory-toolbar").getByLabel("Product");
    await expect(productFilter).toHaveValue("");
    await expect(productFilter.getByRole("option", { name: "All accessible Products" })).toHaveCount(1);
    await expect(page.locator("body")).not.toContainText("Create product-scoped data sets once");

    await page.getByRole("button", { name: "New Test Data" }).click();
    const dialog = page.getByRole("dialog", { name: "Create Test Data" });
    await dialog.getByLabel("Product").selectOption(product.id);
    await dialog.getByLabel("Test Data name").fill("Regional customers");
    await dialog.getByRole("button", { name: "Create Test Data" }).click();
    await expect(dialog.getByText("Row 1 needs a value for customer_email.")).toBeVisible();

    await dialog.getByLabel("Add column").click();
    await dialog.getByLabel("Column 2 name").fill("region");
    await dialog.getByLabel("Row 1, customer_email").fill("north@example.test");
    await dialog.getByLabel("Row 1, region").fill("north");
    await dialog.getByLabel("Add row").click();
    await dialog.getByLabel("Row 2, customer_email").fill("south@example.test");
    await dialog.getByLabel("Row 2, region").fill("south");
    await expect(dialog.getByText("2 rows · 2 columns")).toBeVisible();
    await dialog.getByRole("button", { name: "Create Test Data" }).click();

    const item = page.locator(".test-data-item").filter({ hasText: "Regional customers" });
    await expect(item).toContainText(product.name);
    await expect(item).toContainText("Fields: customer_email, region");
    await expect(item).toContainText("2 rows");
    await expect(item).not.toContainText("Reusable sequentially");
    await expect(page.locator("body")).not.toContainText("north@example.test");
    await expect(item.getByRole("button", { name: "Edit Regional customers" })).toBeVisible();
    await expect(item.getByRole("button", { name: "Invalidate Regional customers" })).toBeVisible();

    await item.getByRole("button", { name: "Edit Regional customers" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit Regional customers" });
    await expect(editDialog.getByLabel("Row 1, customer_email")).toHaveAttribute("placeholder", "Stored value (masked)");
    await editDialog.getByLabel("Test Data name").fill("Regional customer matrix");
    await editDialog.getByLabel("Row 1, customer_email").fill("updated-north@example.test");
    await editDialog.getByRole("button", { name: "Save Test Data changes" }).click();
    await expect(page.getByText("Regional customer matrix saved.")).toBeVisible();
    await expect(page.locator(".test-data-item").filter({ hasText: "Regional customer matrix" })).toContainText("2 rows");
    await expect(page.locator("body")).not.toContainText("updated-north@example.test");
  } finally {
    await prisma.product.delete({ where: { id: product.id } });
  }
});
