import { expect, test } from "@playwright/test";
import { RecordingStatus, StepKind } from "@prisma/client";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

test.setTimeout(45_000);

async function createSavedTest(name: string) {
  const ava = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const product = await prisma.product.create({ data: { name: `Run browser ${Date.now()}`, createdById: ava.id, memberships: { create: { userId: ava.id } } } });
  const recording = await prisma.recordingSession.create({ data: { productId: product.id, ownerId: ava.id, testName: name, targetUrl: "http://demo-target", tokenHash: `playwright-run-${Date.now()}`, status: RecordingStatus.SAVED } });
  const testCase = await prisma.testCase.create({
    data: {
      productId: product.id,
      ownerId: ava.id,
      recordingSessionId: recording.id,
      name,
      versions: { create: { version: 1, steps: { create: [
        { order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" }, description: "Open the Demo CRM" },
        { order: 2, kind: StepKind.CLICK, timestamp: new Date(), target: { tag: "button", text: "Sign in" }, description: "Select Sign in" }
      ] } } }
    }
  });
  return { productId: product.id, recordingId: recording.id, testCaseId: testCase.id };
}

async function cleanup(productId: string) {
  const runs = await prisma.run.findMany({ where: { productId }, select: { id: true } });
  const testCases = await prisma.testCase.findMany({ where: { productId }, select: { id: true } });
  await prisma.auditEvent.deleteMany({ where: { entityId: { in: [...runs.map((run) => run.id), ...testCases.map((testCase) => testCase.id)] } } });
  await prisma.testCase.deleteMany({ where: { productId } });
  await prisma.recordingSession.deleteMany({ where: { productId } });
  await prisma.product.delete({ where: { id: productId } });
}

test("starts, refreshes, and completes a strict guided Run in the UI", async ({ page }) => {
  const name = `Run workspace ${Date.now()}`;
  const created = await createSavedTest(name);
  try {
    await page.goto(baseUrl);
    await page.getByLabel("Email").fill("ava.tester@example.test");
    await page.getByLabel("Password").fill("sentinel-dev");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.goto(`${baseUrl}/test-cases/${created.testCaseId}`);
    await page.getByRole("button", { name: "Guided Run" }).click();
    await expect(page).toHaveURL(/\/runs\//, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.locator('iframe[title="Guided Run browser"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Pass step" })).toBeVisible();

    await page.reload();
    await expect(page.locator('iframe[title="Guided Run browser"]')).toBeVisible();
    await page.getByRole("button", { name: "Pass step" }).click();
    await expect(page.getByText("Step 2")).toBeVisible();
    await page.getByRole("button", { name: "Fail step" }).click();
    await expect(page.getByRole("heading", { name: "Evidence timeline" })).toBeVisible();
    await expect(page.getByText("Failed", { exact: true }).first()).toBeVisible();
  } finally {
    await cleanup(created.productId);
  }
});
