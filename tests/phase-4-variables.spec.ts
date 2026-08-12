import { expect, test } from "@playwright/test";
import { RecordingStatus, StepKind } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { encryptVariableValue } from "../lib/variables";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

test.setTimeout(50_000);

async function createVariableTestCase(name: string) {
  const ava = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const product = await prisma.product.create({ data: { name: `Variable UI ${Date.now()}`, createdById: ava.id, memberships: { create: { userId: ava.id } } } });
  const recording = await prisma.recordingSession.create({ data: { productId: product.id, ownerId: ava.id, testName: name, targetUrl: "http://demo-target", tokenHash: `variable-ui-${Date.now()}`, status: RecordingStatus.SAVED } });
  const testCase = await prisma.testCase.create({
    data: {
      productId: product.id,
      ownerId: ava.id,
      recordingSessionId: recording.id,
      name,
      versions: {
        create: {
          version: 1,
          steps: { create: [
            { order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" } },
            { order: 2, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "email" }, value: "[VARIABLE:customer_email]", variableName: "customer_email", isCheckpoint: true }
          ] },
          variables: { create: { name: "customer_email", staticValueEncrypted: encryptVariableValue("customer.static@example.test") } }
        }
      }
    }
  });
  return { productId: product.id, testCaseId: testCase.id };
}

async function cleanup(productId: string) {
  const runs = await prisma.run.findMany({ where: { productId }, select: { id: true } });
  const testCases = await prisma.testCase.findMany({ where: { productId }, select: { id: true } });
  await prisma.auditEvent.deleteMany({ where: { entityId: { in: [...runs.map((run) => run.id), ...testCases.map((testCase) => testCase.id)] } } });
  await prisma.testCase.deleteMany({ where: { productId } });
  await prisma.recordingSession.deleteMany({ where: { productId } });
  await prisma.product.delete({ where: { id: productId } });
}

test("creates masked Test Data and binds it to a checkpointed Auto Run", async ({ page }) => {
  const name = `Variable binding workspace ${Date.now()}`;
  const created = await createVariableTestCase(name);
  try {
    await page.goto(baseUrl);
    await page.getByLabel("Email").fill("ava.tester@example.test");
    await page.getByLabel("Password").fill("sentinel-dev");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.getByRole("link", { name: "Test Data" }).click();
    await page.locator(".inventory-toolbar").getByLabel("Product").selectOption(created.productId);
    await page.getByRole("button", { name: "New Test Data" }).click();
    const dialog = page.getByRole("dialog", { name: "Create Test Data Set" });
    await dialog.getByLabel("Data Set name").fill("Customer pool");
    await dialog.getByLabel("Fields").fill("customer_email=customer.pool@example.test");
    await dialog.getByRole("button", { name: "Create Test Data" }).click();
    await expect(page.getByText("Customer pool", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("customer.pool@example.test");

    await page.getByRole("link", { name: "Test Cases" }).click();
    await page.locator(".test-list__item").filter({ hasText: name }).getByRole("link", { name: "Open" }).click();
    await expect(page.getByRole("heading", { name: "Variables" })).toBeVisible();
    await page.getByRole("button", { name: "Auto Run" }).click();
    const bindingDialog = page.getByRole("dialog", { name: "Choose variable values" });
    await bindingDialog.getByLabel("customer_email").selectOption("POOL");
    await bindingDialog.getByLabel("Test Data Set for customer_email").selectOption({ label: "Customer pool" });
    await bindingDialog.getByRole("button", { name: "Queue Auto Run" }).click();
    await expect(page).toHaveURL(/\/runs\//);
    await expect(page.getByText("Checkpoint ready:", { exact: false })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Variable sources", { exact: false }).locator("..")).toContainText("customer_email: pool");
    await expect(page.locator("body")).not.toContainText("customer.pool@example.test");
    await page.getByRole("button", { name: "Cancel" }).click();
  } finally {
    await cleanup(created.productId);
  }
});
