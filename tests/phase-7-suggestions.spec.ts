import { expect, test } from "@playwright/test";
import { RecordingStatus, StepKind } from "@prisma/client";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

async function createSuggestionFixture() {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const suffix = Date.now();
  const product = await prisma.product.create({ data: { name: `Suggestion UI ${suffix}`, createdById: owner.id, memberships: { create: { userId: owner.id } } } });
  const recording = await prisma.recordingSession.create({ data: { productId: product.id, ownerId: owner.id, testName: `Suggestion source ${suffix}`, targetUrl: "http://demo-target", tokenHash: `suggestion-ui-${suffix}`, status: RecordingStatus.SAVED } });
  const testCase = await prisma.testCase.create({
    data: {
      productId: product.id,
      ownerId: owner.id,
      recordingSessionId: recording.id,
      name: `Suggestion source ${suffix}`,
      versions: {
        create: {
          version: 1,
          steps: {
            create: [
              { order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" } },
              { order: 2, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "email", inputType: "email", required: true }, value: "customer@example.test" },
              { order: 3, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "firstName", inputType: "text", required: true, minLength: 2, maxLength: 50 }, value: "Ada" },
              { order: 4, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "password", inputType: "password", required: true }, value: "[REDACTED]", isRedacted: true }
            ]
          }
        }
      }
    }
  });
  return { productId: product.id, testCaseId: testCase.id, name: testCase.name };
}

async function cleanup(productId: string) {
  const [testCases, suggestions] = await Promise.all([
    prisma.testCase.findMany({ where: { productId }, select: { id: true } }),
    prisma.testSuggestion.findMany({ where: { productId }, select: { id: true } })
  ]);
  await prisma.auditEvent.deleteMany({ where: { OR: [{ entityType: "TestCase", entityId: { in: testCases.map((testCase) => testCase.id) } }, { entityType: "TestSuggestion", entityId: { in: suggestions.map((suggestion) => suggestion.id) } }] } });
  await prisma.testCase.deleteMany({ where: { productId } });
  await prisma.recordingSession.deleteMany({ where: { productId } });
  await prisma.product.delete({ where: { id: productId } });
}

test("generates, edits, approves, dismisses, and reopens a reviewable negative-Test draft", async ({ page }) => {
  const fixture = await createSuggestionFixture();
  try {
    await page.goto(baseUrl);
    await page.getByLabel("Email").fill("ava.tester@example.test");
    await page.getByLabel("Password").fill("sentinel-dev");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`${baseUrl}/test-cases/${fixture.testCaseId}`);
    await page.getByText("More actions", { exact: true }).click();
    await page.getByRole("button", { name: "Generate suggestions" }).click();
    await expect(page.getByText(/Suggestions generated: 5 new, 0 already known/)).toBeVisible();
    await page.locator(".app-main").getByRole("link", { name: "Review" }).click();
    await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
    const invalidEmail = page.locator(".review-item").filter({ hasText: "invalid email" });
    await invalidEmail.getByRole("button", { name: "Edit draft" }).click();
    await page.getByLabel("Suggestion name").fill("Reject malformed CRM email");
    await page.getByLabel("Rationale").fill("A malformed customer email must be rejected before success.");
    await page.getByLabel("Proposed safe value").fill("wrong-email");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Suggestion draft updated.")).toBeVisible();
    const editedEmail = page.locator(".review-item").filter({ hasText: "Reject malformed CRM email" });
    await editedEmail.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText(/Suggestion approved/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Open approved Test Case" })).toBeVisible();

    const required = page.locator(".review-item").filter({ hasText: "Reject missing email" });
    page.once("dialog", (dialog) => dialog.accept());
    await required.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByText("Suggestion dismissed. It remains available in history.")).toBeVisible();
    await page.getByLabel("Filter by review state").selectOption("DISMISSED");
    await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
    await page.getByRole("button", { name: "Reopen" }).click();
    await expect(page.getByText("Suggestion reopened as a Draft.")).toBeVisible();
  } finally {
    await cleanup(fixture.productId);
  }
});
