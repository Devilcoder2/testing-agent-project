import { afterEach, describe, expect, it } from "vitest";
import { RecordingStatus, StepKind } from "@prisma/client";
import { encryptVariableValue, variablePlaceholder } from "../lib/variables";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";
const createdProductIds: string[] = [];

type Session = { cookie: string };
type SeleniumStatus = { value?: { nodes?: Array<{ slots?: Array<{ session?: { sessionId?: string } }> }> } };

async function login(email: string): Promise<Session> {
  const response = await fetch(`${baseUrl}/api/auth/dev-login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "sentinel-dev" })
  });
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Development login did not return a session cookie.");
  return { cookie };
}

async function request(session: Session, path: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}/api/${path}`, {
    method,
    headers: { cookie: session.cookie, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
}

async function runInActiveBrowser(script: string, asynchronous = false) {
  const status = await (await fetch("http://browser:4444/status")).json() as SeleniumStatus;
  const sessionId = status.value?.nodes?.flatMap((node) => node.slots ?? []).flatMap((slot) => slot.session?.sessionId ? [slot.session.sessionId] : [])[0];
  if (!sessionId) throw new Error("The test could not find the active guided Run browser session.");
  const response = await fetch(`http://browser:4444/session/${sessionId}/execute/${asynchronous ? "async" : "sync"}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ script, args: [] })
  });
  expect(response.status).toBe(200);
  return response.json();
}

async function createSavedTest(session: Session, name: string) {
  const productResponse = await request(session, "products", "POST", { name: `Run API ${Date.now()}` });
  expect(productResponse.status).toBe(201);
  const product = await productResponse.json() as { id: string };
  createdProductIds.push(product.id);
  const ava = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const recording = await prisma.recordingSession.create({
    data: { productId: product.id, ownerId: ava.id, testName: name, targetUrl: "http://demo-target", tokenHash: `run-${Date.now()}`, status: RecordingStatus.SAVED }
  });
  return prisma.testCase.create({
    data: {
      productId: product.id,
      ownerId: ava.id,
      recordingSessionId: recording.id,
      name,
      versions: {
        create: {
          version: 1,
          steps: {
            create: [
              { order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" }, description: "Open the Demo CRM" },
              { order: 2, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "email" }, value: "qa.tester@example.test" },
              { order: 3, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "password" }, value: "[REDACTED]", isRedacted: true },
              { order: 4, kind: StepKind.CLICK, timestamp: new Date(), target: { tag: "button", text: "Sign in" }, expectedOutcome: "The dashboard opens" },
              { order: 5, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target/#dashboard" } },
              { order: 6, kind: StepKind.CLICK, timestamp: new Date(), target: { tag: "button", text: "New customer" } },
              { order: 7, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target/#customer-new" } },
              { order: 8, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "firstName" }, value: "Guided" },
              { order: 9, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "lastName" }, value: "Runner" },
              { order: 10, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "email" }, value: "guided.runner@example.test" },
              { order: 11, kind: StepKind.CLICK, timestamp: new Date(), target: { tag: "button", text: "Create customer" } },
              { order: 12, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target/#customer-saved" } }
            ]
          }
        }
      }
    }
  });
}

afterEach(async () => {
  for (const productId of createdProductIds.splice(0)) {
    const runs = await prisma.run.findMany({ where: { productId }, select: { id: true } });
    const testCases = await prisma.testCase.findMany({ where: { productId }, select: { id: true } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: [...runs.map((run) => run.id), ...testCases.map((testCase) => testCase.id)] } } });
    await prisma.testCase.deleteMany({ where: { productId } });
    await prisma.recordingSession.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
  }
});

describe("Phase 2 guided Run API", () => {
  it("creates a version-bound strict Run, captures redacted evidence, and blocks unauthorized access", async () => {
    const ava = await login("ava.tester@example.test");
    const ben = await login("ben.tester@example.test");
    const testCase = await createSavedTest(ava, `Guided Run ${Date.now()}`);

    const startResponse = await request(ava, `test-cases/${testCase.id}/runs`, "POST");
    expect(startResponse.status).toBe(201);
    const started = await startResponse.json() as { run: { id: string; status: string; testCaseVersionId: string }; viewerUrl: string };
    expect(started.run.status).toBe("RUNNING");
    expect(started.viewerUrl).toContain("7900");

    const detailResponse = await request(ava, `runs/${started.run.id}`);
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json() as { stepResults: Array<{ id: string; order: number; status: string }>; evidence: Array<{ id: string; kind: string; metadata?: unknown }> };
    expect(detail.stepResults.map((step) => step.status)).toEqual(Array(12).fill("PENDING"));
    expect(detail.evidence.some((item) => item.kind === "SCREENSHOT")).toBe(true);
    expect(detail.evidence.some((item) => item.kind === "STORAGE")).toBe(true);
    expect(JSON.stringify(detail.evidence)).not.toContain("sentinel-dev");

    const outOfOrder = await request(ava, `runs/${started.run.id}/steps/${detail.stepResults[1].id}/complete`, "POST", { status: "PASSED" });
    expect(outOfOrder.status).toBe(409);
    const firstStep = await request(ava, `runs/${started.run.id}/steps/${detail.stepResults[0].id}/complete`, "POST", { status: "PASSED" });
    expect(firstStep.status).toBe(200);

    expect((await request(ben, `runs/${started.run.id}`)).status).toBe(403);
    const screenshot = detail.evidence.find((item) => item.kind === "SCREENSHOT");
    if (!screenshot) throw new Error("Run did not create a screenshot evidence item.");
    expect((await request(ben, `evidence/${screenshot.id}/access`)).status).toBe(403);
    const evidenceAccess = await request(ava, `evidence/${screenshot.id}/access`);
    expect(evidenceAccess.status).toBe(200);
    expect((await evidenceAccess.json() as { url: string }).url).toMatch(/^http:\/\/localhost:9000\/sentinel-evidence\//);

    await runInActiveBrowser("console.warn('Sentinel Run integration warning'); sessionStorage.setItem('demo-run-marker', 'must-not-be-stored'); return true;");
    await runInActiveBrowser("const done = arguments[arguments.length - 1]; fetch('/events.json?event=integration').then(() => done(true)).catch((error) => done(String(error)));", true);

    for (const step of detail.stepResults.slice(1)) {
      const completed = await request(ava, `runs/${started.run.id}/steps/${step.id}/complete`, "POST", { status: "PASSED" });
      expect(completed.status).toBe(200);
    }

    const persisted = await prisma.run.findUniqueOrThrow({ where: { id: started.run.id }, include: { stepResults: { orderBy: { order: "asc" } }, evidence: true } });
    expect(persisted.testCaseVersionId).toBe(started.run.testCaseVersionId);
    expect(persisted).toMatchObject({ status: "COMPLETED", outcome: "PASSED" });
    expect(persisted.stepResults.map((step) => step.status)).toEqual(Array(12).fill("PASSED"));
    expect(persisted.evidence.filter((item) => item.kind === "SCREENSHOT").map((item) => (item.metadata as { label?: string }).label)).toEqual(expect.arrayContaining(["START", "END"]));
    expect(persisted.evidence.some((item) => item.kind === "CAPTURE_ERROR")).toBe(false);
    expect(JSON.stringify(persisted.evidence.filter((item) => item.kind === "NETWORK"))).toContain("/events.json?event=integration");
    const storageEvidence = JSON.stringify(persisted.evidence.filter((item) => item.kind === "STORAGE"));
    expect(storageEvidence).toContain("demo-run-marker");
    expect(storageEvidence).not.toContain("must-not-be-stored");
    expect(JSON.stringify(persisted.evidence.filter((item) => item.kind === "CONSOLE"))).toContain("Sentinel Run integration warning");
  }, 30_000);

  it("replays a manually bound Phase 4 variable without exposing its value in Run Detail", async () => {
    const ava = await login("ava.tester@example.test");
    const testCase = await createSavedTest(ava, `Guided variable Run ${Date.now()}`);
    const version = await prisma.testCaseVersion.findFirstOrThrow({ where: { testCaseId: testCase.id } });
    const customerEmail = "guided.variable@example.test";
    await prisma.$transaction([
      prisma.testVariable.create({ data: { testCaseVersionId: version.id, name: "customer_email", staticValueEncrypted: encryptVariableValue("static.variable@example.test") } }),
      prisma.testStep.updateMany({ where: { testCaseVersionId: version.id, order: 10 }, data: { variableName: "customer_email", value: variablePlaceholder("customer_email") } })
    ]);

    const started = await request(ava, `test-cases/${testCase.id}/runs`, "POST", { bindings: { customer_email: { source: "MANUAL", value: customerEmail } } });
    expect(started.status).toBe(201);
    const { run } = await started.json() as { run: { id: string } };
    const detail = await request(ava, `runs/${run.id}`);
    expect(detail.status).toBe(200);
    expect(JSON.stringify(await detail.json())).not.toContain(customerEmail);

    const stepResults = (await prisma.run.findUniqueOrThrow({ where: { id: run.id }, include: { stepResults: { orderBy: { order: "asc" } } } })).stepResults;
    for (const step of stepResults.slice(0, 10)) {
      expect((await request(ava, `runs/${run.id}/steps/${step.id}/complete`, "POST", { status: "PASSED" })).status).toBe(200);
    }
    const browserValue = await runInActiveBrowser("return document.querySelector('input[name=\"email\"]')?.value;");
    expect(browserValue).toMatchObject({ value: customerEmail });
    expect((await request(ava, `runs/${run.id}/interrupt`, "POST")).status).toBe(200);
  }, 30_000);
});
