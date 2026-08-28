import { expect, test } from "@playwright/test";
import { OrganizationRole, RecordingStatus, StepKind } from "@prisma/client";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

async function createFixture(name: string) {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const member = await prisma.user.findUniqueOrThrow({ where: { email: "ben.tester@example.test" } });
  const organization = await prisma.organizationMember.findFirstOrThrow({ where: { userId: owner.id } });
  await prisma.organizationMember.upsert({ where: { organizationId_userId: { organizationId: organization.organizationId, userId: member.id } }, update: { role: OrganizationRole.TESTER }, create: { organizationId: organization.organizationId, userId: member.id, role: OrganizationRole.TESTER } });
  const product = await prisma.product.create({ data: { name: `Detail UI Product ${Date.now()}`, organizationId: organization.organizationId, createdById: owner.id, memberships: { create: [{ userId: owner.id }, { userId: member.id }] } } });
  const recording = await prisma.recordingSession.create({ data: { productId: product.id, ownerId: owner.id, testName: name, targetUrl: "http://demo-target", tokenHash: `detail-ui-${Date.now()}`, status: RecordingStatus.SAVED } });
  const testCase = await prisma.testCase.create({ data: { productId: product.id, ownerId: owner.id, recordingSessionId: recording.id, name, versions: { create: { version: 1, steps: { create: [
    { order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" }, description: "Open the demo application", expectedOutcome: "The sign-in page is ready", isCheckpoint: true },
    { order: 2, kind: StepKind.CLICK, timestamp: new Date(), target: { tag: "input", name: "email" } },
    { order: 3, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "email" }, value: "tester@example.test" }
  ] } } } } });
  return { product, testCase };
}

async function cleanup(productId: string) {
  const tests = await prisma.testCase.findMany({ where: { productId }, select: { id: true } });
  await prisma.auditEvent.deleteMany({ where: { entityId: { in: tests.map((item) => item.id) } } });
  await prisma.testCase.deleteMany({ where: { productId } });
  await prisma.recordingSession.deleteMany({ where: { productId } });
  await prisma.product.delete({ where: { id: productId } });
}

test("presents focused Test Case actions and expandable checkpoint steps", async ({ page }) => {
  const name = `Focused Test Case ${Date.now()}`;
  const fixture = await createFixture(name);
  try {
    await page.goto(baseUrl);
    await page.getByLabel("Email").fill("ava.tester@example.test");
    await page.getByLabel("Password").fill("sentinel-dev");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const routingLoaded = page.waitForResponse((response) => response.url().includes(`/api/test-cases/${fixture.testCase.id}/github`));
    await page.goto(`${baseUrl}/test-cases/${fixture.testCase.id}`);
    await routingLoaded;
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText(`${fixture.product.name} · Owner: Ava Tester · 3 recorded steps`)).toBeVisible();
    await expect(page.getByText("This current version is read-only.", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Optional GitHub automation", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Descriptions, outcomes, variables, and checkpoints are persisted", { exact: false })).toHaveCount(0);

    await expect(page.getByRole("button", { name: "Start Guided Run" })).toHaveAttribute("title", "Start Guided Run");
    await expect(page.getByRole("button", { name: "Start Auto Run" })).toHaveAttribute("title", "Start Auto Run");
    const menuButton = page.getByRole("button", { name: "More Test Case actions" });
    await expect(menuButton).toHaveAttribute("title", "More Test Case actions");
    await menuButton.click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem")).toHaveCount(4);
    const leftEdges = await menu.getByRole("menuitem").evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().left)));
    expect(new Set(leftEdges).size).toBe(1);

    await page.getByRole("heading", { name }).click();
    await expect(menu).toBeHidden();
    await menuButton.click();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();

    await menuButton.click();
    await menu.getByRole("menuitem", { name: "Transfer Test Case ownership" }).click();
    await expect(menu).toBeHidden();
    await expect(page.getByRole("dialog", { name: "Transfer Test Case ownership" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    const steps = page.locator(".timeline-item");
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0).getByText("Navigation", { exact: true })).toBeVisible();
    await expect(steps.nth(0).getByText("http://demo-target", { exact: true })).toBeVisible();
    await expect(steps.nth(1).getByText("Click", { exact: true })).toBeVisible();
    await expect(steps.nth(1).getByText("email", { exact: true })).toBeVisible();
    await expect(steps.nth(2).getByText("tester@example.test", { exact: true })).toBeVisible();
    await expect(page.getByText("Description: Open the demo application")).not.toBeVisible();
    await expect(steps.nth(0).getByText("Checkpoint", { exact: true })).toBeVisible();
    expect(await steps.nth(0).locator(".timeline-item__card").evaluate((element) => getComputedStyle(element).borderStyle)).toBe("dashed");
    await steps.nth(0).locator("summary").click();
    await expect(page.getByText("Description: Open the demo application")).toBeVisible();
    await expect(page.getByText("Expected outcome: The sign-in page is ready")).toBeVisible();
    await steps.nth(1).locator("summary").click();
    await expect(steps.nth(1).getByText("No additional description or expected outcome was recorded.")).toBeVisible();
  } finally {
    await cleanup(fixture.product.id);
  }
});
