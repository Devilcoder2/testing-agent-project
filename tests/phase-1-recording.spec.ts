import { expect, test, type Page } from "@playwright/test";
import { RecordingStatus } from "@prisma/client";
import { launchBrowser } from "../lib/browser";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";
const demoUrl = "http://demo-target";

type RecordingResponse = { recording: { id: string }; token: string };
type Step = { id: string; kind: string; value: string | null; isRedacted: boolean; description: string | null; expectedOutcome: string | null; variableName: string | null };

async function signIn(page: Page, email = "ava.tester@example.test", navigate = true) {
  if (navigate) await page.goto(baseUrl);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("sentinel-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Saved Test Cases" })).toBeVisible();
}

async function readSteps(page: Page, recordingId: string): Promise<Step[]> {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/recordings/${id}/steps`);
    return response.json();
  }, recordingId) as Promise<Step[]>;
}

async function cleanup(testName: string) {
  const recording = await prisma.recordingSession.findFirst({ where: { testName } });
  if (!recording) return;
  const testCase = await prisma.testCase.findFirst({ where: { recordingSessionId: recording.id } });
  if (testCase) {
    await prisma.auditEvent.deleteMany({ where: { entityType: "TestCase", entityId: testCase.id } });
    await prisma.testCase.delete({ where: { id: testCase.id } });
  }
  await prisma.recordingSession.delete({ where: { id: recording.id } });
}

test("records the remote demo journey and preserves saved annotations after refresh", async ({ page }) => {
  const testName = `Remote journey ${Date.now()}`;
  let remoteDriver: Awaited<ReturnType<typeof launchBrowser>> | undefined;

  try {
    await signIn(page);
    await page.getByLabel("Test Name").fill(testName);
    const createResponse = page.waitForResponse((response) => response.url().endsWith("/api/recordings") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Create recording workspace" }).click();
    const created = await (await createResponse).json() as RecordingResponse;

    await prisma.recordingSession.update({ where: { id: created.recording.id }, data: { status: RecordingStatus.ACTIVE } });
    remoteDriver = await launchBrowser(demoUrl, created.token);
    await remoteDriver.executeScript(`
      const update = (selector, value) => {
        const element = document.querySelector(selector);
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      update('input[name="email"]', 'qa.tester@example.test');
      update('input[name="password"]', 'TestPassword!');
    `);
    await page.waitForTimeout(350);
    await remoteDriver.executeScript(`document.querySelector('#sign-in-form button').click();`);
    await page.waitForTimeout(350);
    await remoteDriver.executeScript(`document.querySelector('#new-customer').click();`);
    await page.waitForTimeout(350);
    await remoteDriver.executeScript(`document.querySelector('#customer-form button').click();`);
    await page.waitForTimeout(350);
    await remoteDriver.executeScript(`
      const update = (selector, value) => {
        const element = document.querySelector(selector);
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      update('input[name="firstName"]', 'Avery');
      update('input[name="lastName"]', 'Tester');
      update('input[name="email"]', 'avery.tester@example.test');
    `);
    await page.waitForTimeout(350);
    await remoteDriver.executeScript(`document.querySelector('#customer-form button').click();`);

    await expect.poll(async () => (await readSteps(page, created.recording.id)).length).toBeGreaterThanOrEqual(10);
    const captured = await readSteps(page, created.recording.id);
    expect(captured.some((step) => step.kind === "NAVIGATION")).toBe(true);
    expect(captured.some((step) => step.kind === "CLICK")).toBe(true);
    expect(captured.some((step) => step.value === "[REDACTED]" && step.isRedacted)).toBe(true);
    expect(JSON.stringify(captured)).not.toContain("TestPassword!");

    const passwordStep = page.locator(".step").filter({ hasText: "[REDACTED]" }).first();
    await expect(passwordStep).toBeVisible();
    await passwordStep.getByLabel("Description").fill("Enter the secret test password");
    await passwordStep.getByLabel("Description").blur();
    await expect.poll(async () => (await readSteps(page, created.recording.id)).find((step) => step.isRedacted)?.description).toBe("Enter the secret test password");
    await passwordStep.getByLabel("Expected outcome").fill("The password stays redacted");
    await passwordStep.getByLabel("Expected outcome").blur();
    await passwordStep.getByLabel("Variable name").fill("demoPassword");
    await passwordStep.getByLabel("Variable name").blur();
    await expect.poll(async () => (await readSteps(page, created.recording.id)).find((step) => step.isRedacted)?.variableName).toBe("demoPassword");

    await page.getByRole("button", { name: "Save Test" }).click();
    await expect(page.getByRole("heading", { name: testName })).toBeVisible();
    await expect(page.getByText("Description: Enter the secret test password")).toBeVisible();
    await expect(page.getByText("Expected outcome: The password stays redacted")).toBeVisible();
    await expect(page.getByText("Variable: demoPassword")).toBeVisible();

    await page.getByRole("button", { name: "Back to dashboard" }).click();
    const savedTest = page.locator(".step").filter({ hasText: testName }).first();
    await savedTest.getByRole("button", { name: "Open" }).click();
    await expect(page.getByText("Variable: demoPassword")).toBeVisible();

    await page.reload();
    await signIn(page, "ava.tester@example.test", false);
    const reopenedTest = page.locator(".step").filter({ hasText: testName }).first();
    await reopenedTest.getByRole("button", { name: "Open" }).click();
    await expect(page.getByText("Description: Enter the secret test password")).toBeVisible();
    await expect(page.getByText("Expected outcome: The password stays redacted")).toBeVisible();
    await expect(page.getByText("Variable: demoPassword")).toBeVisible();
    await expect(page.getByText("Value: [REDACTED]")).toBeVisible();
    await expect(page.getByText("TestPassword!")).toHaveCount(0);
  } finally {
    await remoteDriver?.quit();
    await cleanup(testName);
  }
});
