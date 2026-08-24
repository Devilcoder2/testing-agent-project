import { expect, test } from "@playwright/test";
import { RecordingStatus, StepKind } from "@prisma/client";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

test.setTimeout(50_000);

async function createReplayableTestCase(name: string, checkpointOrder?: number) {
  const ava = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const organization = await prisma.organizationMember.findFirstOrThrow({ where: { userId: ava.id } });
  const product = await prisma.product.create({ data: { name: `Auto Run UI ${Date.now()}`, organizationId: organization.organizationId, createdById: ava.id, memberships: { create: { userId: ava.id } } } });
  const recording = await prisma.recordingSession.create({ data: { productId: product.id, ownerId: ava.id, testName: name, targetUrl: "http://demo-target", tokenHash: `auto-run-ui-${Date.now()}`, status: RecordingStatus.SAVED } });
  const steps = [
    { order: 1, kind: StepKind.NAVIGATION, target: { url: "http://demo-target" } },
    { order: 2, kind: StepKind.TEXT_ENTRY, target: { tag: "input", name: "email" }, value: "qa.tester@example.test" },
    { order: 3, kind: StepKind.TEXT_ENTRY, target: { tag: "input", name: "password" }, value: "[REDACTED]", isRedacted: true },
    { order: 4, kind: StepKind.CLICK, target: { tag: "button", text: "Sign in" } },
    { order: 5, kind: StepKind.NAVIGATION, target: { url: "http://demo-target/#dashboard" } },
    { order: 6, kind: StepKind.CLICK, target: { tag: "button", text: "New customer" } },
    { order: 7, kind: StepKind.NAVIGATION, target: { url: "http://demo-target/#customer-new" } },
    { order: 8, kind: StepKind.TEXT_ENTRY, target: { tag: "input", name: "firstName" }, value: "Auto" },
    { order: 9, kind: StepKind.TEXT_ENTRY, target: { tag: "input", name: "lastName" }, value: "Runner" },
    { order: 10, kind: StepKind.TEXT_ENTRY, target: { tag: "input", name: "email" }, value: "auto.runner@example.test" },
    { order: 11, kind: StepKind.CLICK, target: { tag: "button", text: "Create customer" } },
    { order: 12, kind: StepKind.NAVIGATION, target: { url: "http://demo-target/#customer-saved" } }
  ];
  const testCase = await prisma.testCase.create({
    data: {
      productId: product.id,
      ownerId: ava.id,
      recordingSessionId: recording.id,
      name,
      versions: { create: { version: 1, steps: { create: steps.map((step) => ({ ...step, timestamp: new Date(), isRedacted: step.isRedacted ?? false, isCheckpoint: step.order === checkpointOrder })) } } }
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

test("queues and completes an Auto Run from saved Test Case detail", async ({ page }) => {
  const name = `Auto Run workspace ${Date.now()}`;
  const created = await createReplayableTestCase(name, 4);
  try {
    await page.goto(baseUrl);
    await page.getByLabel("Email").fill("ava.tester@example.test");
    await page.getByLabel("Password").fill("sentinel-dev");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.goto(`${baseUrl}/test-cases/${created.testCaseId}`);
    await page.getByRole("button", { name: "Auto Run" }).click();

    await expect(page).toHaveURL(/\/runs\//, { timeout: 15_000 });
    await expect(page.getByText("Auto Run", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Checkpoint ready:", { exact: false })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Review window ends:", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Execution evidence", { exact: true })).toBeVisible({ timeout: 35_000 });
    await expect(page.getByText("Passed", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Evidence timeline" })).toBeVisible();
    await expect(page.getByText("START", { exact: true })).toBeVisible();
    await expect(page.getByText("END", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("TestPassword!");
  } finally {
    await cleanup(created.productId);
  }
});
