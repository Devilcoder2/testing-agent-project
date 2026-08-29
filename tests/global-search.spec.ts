import { expect, test, type Page } from "@playwright/test";
import { ChangeProposalStatus, RecordingStatus, RunMode, RunOutcome, RunStatus, StepKind, TestDataReusePolicy } from "@prisma/client";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

async function signIn(page: Page) {
  await page.goto(baseUrl);
  await page.getByLabel("Email").fill("ava.tester@example.test");
  await page.getByLabel("Password").fill("sentinel-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 });
}

test("searches the authorized workspace with debounce, current-section priority, and keyboard navigation", async ({ page }) => {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const membership = await prisma.organizationMember.findFirstOrThrow({ where: { userId: owner.id } });
  const suffix = Date.now();
  const prefix = `Command Search ${suffix}`;
  const productName = `${prefix} Product`;
  const testName = `${prefix} Test`;
  const dataName = `${prefix} Data`;
  const product = await prisma.product.create({ data: { name: productName, createdById: owner.id, organizationId: membership.organizationId, memberships: { create: { userId: owner.id } } } });
  const recording = await prisma.recordingSession.create({ data: { productId: product.id, ownerId: owner.id, testName, targetUrl: "http://demo-target", tokenHash: `command-search-${suffix}`, status: RecordingStatus.SAVED } });
  const testCase = await prisma.testCase.create({ data: { productId: product.id, ownerId: owner.id, recordingSessionId: recording.id, name: testName, versions: { create: { version: 1, steps: { create: { order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" } } } } } }, include: { versions: true } });
  const run = await prisma.run.create({ data: { testCaseId: testCase.id, testCaseVersionId: testCase.versions[0].id, productId: product.id, initiatedById: owner.id, targetUrl: "http://demo-target", mode: RunMode.AUTO, status: RunStatus.COMPLETED, outcome: RunOutcome.PASSED, completedAt: new Date() } });
  const dataSet = await prisma.testDataSet.create({ data: { productId: product.id, ownerId: owner.id, name: dataName, fieldNames: ["customer_email"], reusePolicy: TestDataReusePolicy.REUSABLE, rows: { create: { order: 1, encryptedFields: "safe-browser-search-fixture" } } } });
  const proposal = await prisma.changeProposal.create({ data: { runId: run.id, productId: product.id, testCaseId: testCase.id, sourceVersionId: testCase.versions[0].id, createdById: owner.id, ownerId: owner.id, status: ChangeProposalStatus.DRAFT, context: "Search destination fixture" } });

  try {
    await signIn(page);
    await page.getByRole("navigation", { name: "Workspace sections" }).getByRole("link", { name: "Products" }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
    const search = page.getByRole("combobox", { name: "Search workspace" });
    const requests: string[] = [];
    page.on("request", (request) => { if (request.url().includes("/api/search?")) requests.push(request.url()); });

    await search.fill(prefix);
    await page.waitForTimeout(150);
    expect(requests).toHaveLength(0);
    const panel = page.getByRole("listbox", { name: "Workspace search results" });
    await expect(panel).toBeVisible();
    const firstGroup = panel.getByRole("group").first();
    await expect(firstGroup.getByRole("heading")).toContainText("Products");
    await expect(firstGroup.getByRole("option", { name: new RegExp(productName) })).toBeVisible();
    await expect(panel.getByRole("option", { name: new RegExp(testName) })).toHaveCount(3);
    expect(requests).toHaveLength(1);

    await search.press("ArrowDown");
    await expect(panel.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
    await search.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/products\\?focus=${product.id}$`));
    await expect(panel).toHaveCount(0);

    await search.fill(`No match ${suffix}`);
    await expect(panel.getByText(/No matches beginning with/)).toBeVisible();
    await search.press("Escape");
    await expect(panel).toHaveCount(0);

    await search.fill(prefix);
    await panel.getByRole("option", { name: new RegExp(`${dataName}.*Test Data`) }).click();
    await expect(page).toHaveURL(new RegExp(`/test-data\\?productId=${product.id}&focus=${dataSet.id}$`));
    await expect(page.getByRole("main").getByRole("combobox", { name: "Product" })).toHaveValue(product.id);

    await search.fill(prefix);
    await panel.getByRole("option", { name: new RegExp(`${testName}.*Change proposal`) }).click();
    await expect(page).toHaveURL(new RegExp(`/review\\?queue=changes&focus=${proposal.id}$`));
    await expect(page.getByRole("tab", { name: "Change proposals" })).toHaveAttribute("aria-selected", "true");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open workspace navigation" }).click();
    await page.getByRole("complementary", { name: "Workspace navigation" }).getByRole("link", { name: "Products" }).click();
    await expect(search).toBeVisible();
    await search.fill(prefix);
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    await search.press("Escape");
    await search.fill("");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("navigation", { name: "Workspace sections" }).getByRole("link", { name: "Runs" }).click();
    await expect(page).toHaveURL(/\/runs$/);
    await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
    await expect(search).toBeFocused();
    await search.fill(prefix);
    await expect(panel.getByRole("group").first().getByRole("heading")).toContainText("Runs");
    await search.press("ArrowDown");
    await search.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/runs/${run.id}$`));
  } finally {
    await prisma.changeProposal.delete({ where: { id: proposal.id } }).catch(() => undefined);
    await prisma.testDataSet.delete({ where: { id: dataSet.id } }).catch(() => undefined);
    await prisma.testCase.delete({ where: { id: testCase.id } }).catch(() => undefined);
    await prisma.recordingSession.delete({ where: { id: recording.id } }).catch(() => undefined);
    await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined);
  }
});
