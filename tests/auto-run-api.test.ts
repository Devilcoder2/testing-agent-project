import { afterEach, describe, expect, it } from "vitest";
import { RecordingStatus, RunMode, StepKind } from "@prisma/client";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";
const productIds: string[] = [];

type Session = { cookie: string };

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

async function waitForCompletion(runId: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const run = await prisma.run.findUniqueOrThrow({ where: { id: runId }, include: { attempts: true, evidence: true, stepResults: { orderBy: { order: "asc" } } } });
    if (run.status === "COMPLETED") return run;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Auto Run did not complete in 20 seconds.");
}

async function createSavedDemoTest(session: Session, name: string) {
  const productResponse = await request(session, "products", "POST", { name: `Auto Run ${Date.now()}` });
  expect(productResponse.status).toBe(201);
  const product = await productResponse.json() as { id: string };
  productIds.push(product.id);
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const recording = await prisma.recordingSession.create({
    data: { productId: product.id, ownerId: owner.id, testName: name, targetUrl: "http://demo-target", tokenHash: `auto-${Date.now()}`, status: RecordingStatus.SAVED }
  });
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
  return prisma.testCase.create({
    data: {
      productId: product.id,
      ownerId: owner.id,
      recordingSessionId: recording.id,
      name,
      versions: { create: { version: 1, steps: { create: steps.map((step) => ({ ...step, timestamp: new Date(), isRedacted: step.isRedacted ?? false })) } } }
    }
  });
}

afterEach(async () => {
  for (const productId of productIds.splice(0)) {
    const runs = await prisma.run.findMany({ where: { productId }, select: { id: true } });
    const testCases = await prisma.testCase.findMany({ where: { productId }, select: { id: true } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: [...runs.map((run) => run.id), ...testCases.map((testCase) => testCase.id)] } } });
    await prisma.testCase.deleteMany({ where: { productId } });
    await prisma.recordingSession.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
  }
});

describe("Phase 3 Auto Run API", () => {
  it("replays the Demo CRM in a worker, retains evidence, and preserves product authorization", async () => {
    const ava = await login("ava.tester@example.test");
    const ben = await login("ben.tester@example.test");
    const testCase = await createSavedDemoTest(ava, `Auto Run journey ${Date.now()}`);

    const start = await request(ava, `test-cases/${testCase.id}/auto-runs`, "POST");
    expect(start.status).toBe(201);
    const queued = await start.json() as { run: { id: string; mode: string; status: string } };
    expect(queued.run).toMatchObject({ mode: RunMode.AUTO, status: "QUEUED" });
    expect((await request(ben, `runs/${queued.run.id}`)).status).toBe(403);

    const completed = await waitForCompletion(queued.run.id);
    expect(completed).toMatchObject({ mode: RunMode.AUTO, status: "COMPLETED", outcome: "PASSED" });
    expect(completed.attempts).toHaveLength(1);
    expect(completed.stepResults.every((step) => step.status === "PASSED")).toBe(true);
    expect(completed.evidence.some((item) => item.kind === "SCREENSHOT" && (item.metadata as { label?: string } | null)?.label === "START")).toBe(true);
    expect(completed.evidence.some((item) => item.kind === "SCREENSHOT" && (item.metadata as { label?: string } | null)?.label === "END")).toBe(true);
    expect(completed.evidence.some((item) => item.kind === "NETWORK")).toBe(true);
    expect(JSON.stringify(completed.evidence)).not.toContain("TestPassword!");
  }, 30_000);
});
