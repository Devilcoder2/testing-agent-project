import { expect, test } from "@playwright/test";
import { RecordingStatus, RunMode, RunOutcome, RunStatus, StepKind } from "@prisma/client";
import { notifyRunFailure } from "../lib/notifications";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

async function createHealthFixture() {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const organization = await prisma.organizationMember.findFirstOrThrow({ where: { userId: owner.id }, orderBy: { organization: { name: "asc" } } });
  const product = await prisma.product.create({ data: { name: `Health UI ${Date.now()}`, organizationId: organization.organizationId, createdById: owner.id, memberships: { create: { userId: owner.id } } } });
  const recording = await prisma.recordingSession.create({ data: { productId: product.id, ownerId: owner.id, testName: "Dashboard failed journey", targetUrl: "http://demo-target", tokenHash: `health-ui-${Date.now()}`, status: RecordingStatus.SAVED } });
  const testCase = await prisma.testCase.create({ data: { productId: product.id, ownerId: owner.id, recordingSessionId: recording.id, name: "Dashboard failed journey", versions: { create: { version: 1, steps: { create: { order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" } } } } } }, include: { versions: true } });
  const run = await prisma.run.create({ data: { testCaseId: testCase.id, testCaseVersionId: testCase.versions[0].id, productId: product.id, initiatedById: owner.id, targetUrl: "http://demo-target", mode: RunMode.GUIDED, status: RunStatus.COMPLETED, outcome: RunOutcome.FAILED, completedAt: new Date() } });
  await notifyRunFailure(run.id);
  const notification = await prisma.notification.findFirstOrThrow({ where: { runId: run.id, recipientId: owner.id } });
  return { productId: product.id, runId: run.id, notificationId: notification.id };
}

async function cleanup(productId: string) {
  const testCases = await prisma.testCase.findMany({ where: { productId }, select: { id: true } });
  const runs = await prisma.run.findMany({ where: { productId }, select: { id: true } });
  await prisma.auditEvent.deleteMany({ where: { entityId: { in: [...testCases.map((testCase) => testCase.id), ...runs.map((run) => run.id)] } } });
  await prisma.testCase.deleteMany({ where: { productId } });
  await prisma.recordingSession.deleteMany({ where: { productId } });
  await prisma.product.delete({ where: { id: productId } });
}

test("shows an authorized health drill-down and lets the tester read a failure notification", async ({ page }) => {
  const fixture = await createHealthFixture();
  try {
    await page.goto(baseUrl);
    await page.getByLabel("Email").fill("ava.tester@example.test");
    await page.getByLabel("Password").fill("sentinel-dev");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByLabel("Product drill-down")).toHaveValue("");
    await expect(page.getByRole("heading", { name: "All accessible Products", exact: true })).toBeVisible();
    await page.getByLabel("Product drill-down").selectOption(fixture.productId);
    await expect(page.getByText("Failed Runs", { exact: true })).toBeVisible();
    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Dashboard failed journey", { exact: true })).toBeVisible();
    await page.getByLabel("Product drill-down").selectOption("");
    await expect(page.getByLabel("Product drill-down")).toHaveValue("");
    await expect(page.getByRole("heading", { name: "All accessible Products", exact: true })).toBeVisible();

    await page.locator(".sidebar").getByRole("link", { name: "Notifications" }).click();
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    const failureNotification = page.locator("article").filter({ hasText: "Run failed · Dashboard failed journey" });
    await expect(failureNotification).toBeVisible();
    await expect(failureNotification.getByText("sent", { exact: true })).toBeVisible();
    await failureNotification.getByRole("button", { name: "Mark read" }).click();
    await expect(failureNotification).toHaveCount(0);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.getByText("Run failed · Dashboard failed journey", { exact: true })).toBeVisible();
  } finally {
    await cleanup(fixture.productId);
  }
});
