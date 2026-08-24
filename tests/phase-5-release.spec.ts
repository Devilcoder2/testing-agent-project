import { expect, test } from "@playwright/test";
import { RecordingStatus, StepKind } from "@prisma/client";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

async function createVersionableTestCase(name: string) {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const organization = await prisma.organizationMember.findFirstOrThrow({ where: { userId: owner.id } });
  const product = await prisma.product.create({ data: { name: `Release UI ${Date.now()}`, organizationId: organization.organizationId, createdById: owner.id, memberships: { create: { userId: owner.id } } } });
  const recording = await prisma.recordingSession.create({ data: { productId: product.id, ownerId: owner.id, testName: name, targetUrl: "http://demo-target", tokenHash: `release-ui-${Date.now()}`, status: RecordingStatus.SAVED } });
  const testCase = await prisma.testCase.create({ data: { productId: product.id, ownerId: owner.id, recordingSessionId: recording.id, name, versions: { create: { version: 1, steps: { create: [
    { order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" }, isCheckpoint: true },
    { order: 2, kind: StepKind.CLICK, timestamp: new Date(), target: { tag: "button", text: "Sign in" }, description: "Sign in", expectedOutcome: "Dashboard opens" }
  ] } } } } });
  return { productId: product.id, testCaseId: testCase.id };
}

async function cleanup(productId: string) {
  const testCases = await prisma.testCase.findMany({ where: { productId }, select: { id: true } });
  const releases = await prisma.release.findMany({ where: { tests: { some: { testCase: { productId } } } }, select: { id: true } });
  await prisma.release.deleteMany({ where: { id: { in: releases.map((release) => release.id) } } });
  await prisma.auditEvent.deleteMany({ where: { entityId: { in: testCases.map((testCase) => testCase.id) } } });
  await prisma.testCase.deleteMany({ where: { productId } });
  await prisma.recordingSession.deleteMany({ where: { productId } });
  await prisma.product.delete({ where: { id: productId } });
}

test("edits an immutable Test Case version and starts a visible excluded Release batch", async ({ page }) => {
  const name = `Release workflow ${Date.now()}`;
  const releaseName = `Release ${Date.now()}`;
  const created = await createVersionableTestCase(name);
  try {
    await page.goto(baseUrl);
    await page.getByLabel("Email").fill("ava.tester@example.test");
    await page.getByLabel("Password").fill("sentinel-dev");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.goto(`${baseUrl}/test-cases/${created.testCaseId}`);
    await page.getByText("More actions", { exact: true }).click();
    await page.getByRole("link", { name: "Edit Test" }).click();
    await page.getByLabel("Feature labels").fill("authentication, customer management");
    await page.locator(".step-editor > summary").nth(1).click();
    await page.getByLabel("Description").nth(1).fill("Open the signed-in dashboard");
    await page.getByRole("button", { name: "Save Version 2" }).click();
    await expect(page.getByRole("heading", { name: "Version 2" })).toBeVisible();
    await expect(page.getByText("Version history", { exact: true })).toBeVisible();
    await page.locator(".sidebar").getByRole("link", { name: "Test Cases" }).click();
    await page.getByLabel("Find a Test Case").fill(name);
    await expect(page.locator(".test-list__item").filter({ hasText: name })).toBeVisible();

    await page.getByRole("link", { name: "Releases" }).click();
    await page.getByRole("button", { name: "New Release", exact: true }).first().click();
    await page.getByLabel("Release name").fill(releaseName);
    await page.getByRole("checkbox", { name: new RegExp(name) }).check();
    await page.getByRole("button", { name: "Create Release" }).click();
    await expect(page.getByRole("heading", { name: releaseName })).toBeVisible();
    await page.getByRole("button", { name: "Start Release Run" }).click();
    await expect(page.getByText("not ready", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/checkpoint requires individual run/)).toBeVisible();
  } finally {
    await cleanup(created.productId);
  }
});
