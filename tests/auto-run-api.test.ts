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

async function readRun(runId: string) {
  return prisma.run.findUniqueOrThrow({ where: { id: runId }, include: { attempts: true, evidence: true, stepResults: { orderBy: { order: "asc" } } } });
}

type StoredRun = Awaited<ReturnType<typeof readRun>>;

async function waitForRun(runId: string, matches: (run: StoredRun) => boolean, message: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const run = await readRun(runId);
    if (matches(run)) return run;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(message);
}

async function createSavedDemoTest(session: Session, name: string, checkpointOrder?: number) {
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
      versions: { create: { version: 1, steps: { create: steps.map((step) => ({ ...step, timestamp: new Date(), isRedacted: step.isRedacted ?? false, isCheckpoint: step.order === checkpointOrder })) } } }
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

    const completed = await waitForRun(queued.run.id, (run) => run.status === "COMPLETED", "Auto Run did not complete in 20 seconds.");
    expect(completed).toMatchObject({ mode: RunMode.AUTO, status: "COMPLETED", outcome: "PASSED" });
    expect(completed.attempts).toHaveLength(1);
    expect(completed.stepResults.every((step) => step.status === "PASSED")).toBe(true);
    expect(completed.evidence.some((item) => item.kind === "SCREENSHOT" && (item.metadata as { label?: string } | null)?.label === "START")).toBe(true);
    expect(completed.evidence.some((item) => item.kind === "SCREENSHOT" && (item.metadata as { label?: string } | null)?.label === "END")).toBe(true);
    expect(completed.evidence.some((item) => item.kind === "NETWORK")).toBe(true);
    expect(JSON.stringify(completed.evidence)).not.toContain("TestPassword!");
  }, 30_000);

  it("pauses at a checkpoint for Continue and can be safely cancelled", async () => {
    const ava = await login("ava.tester@example.test");
    const testCase = await createSavedDemoTest(ava, `Checkpoint journey ${Date.now()}`, 4);

    const firstStart = await request(ava, `test-cases/${testCase.id}/auto-runs`, "POST");
    const first = await firstStart.json() as { run: { id: string } };
    const paused = await waitForRun(first.run.id, (run) => run.status === "PAUSED" && run.evidence.some((item) => item.kind === "SCREENSHOT" && (item.metadata as { label?: string } | null)?.label === "CHECKPOINT"), "Auto Run did not pause with checkpoint evidence.");
    expect(paused.activeStepOrder).toBe(4);
    expect((await request(ava, `runs/${first.run.id}/resume`, "POST")).status).toBe(200);
    expect((await waitForRun(first.run.id, (run) => run.status === "COMPLETED", "Resumed Auto Run did not complete.")).outcome).toBe("PASSED");

    const secondStart = await request(ava, `test-cases/${testCase.id}/auto-runs`, "POST");
    const second = await secondStart.json() as { run: { id: string } };
    await waitForRun(second.run.id, (run) => run.status === "PAUSED", "Second Auto Run did not reach its checkpoint.");
    expect((await request(ava, `runs/${second.run.id}/cancel`, "POST")).status).toBe(202);
    const cancelled = await waitForRun(second.run.id, (run) => run.status === "COMPLETED", "Cancelled Auto Run did not complete.");
    expect(cancelled).toMatchObject({ outcome: "INTERRUPTED", failureReason: "CANCELLED" });
    expect(cancelled.evidence.some((item) => item.kind === "SCREENSHOT" && (item.metadata as { label?: string } | null)?.label === "END")).toBe(true);
  }, 45_000);

  it("keeps two isolated Auto Runs active at checkpoints concurrently", async () => {
    const ava = await login("ava.tester@example.test");
    const firstTestCase = await createSavedDemoTest(ava, `Concurrent first ${Date.now()}`, 4);
    const secondTestCase = await createSavedDemoTest(ava, `Concurrent second ${Date.now()}`, 4);

    const [firstResponse, secondResponse] = await Promise.all([
      request(ava, `test-cases/${firstTestCase.id}/auto-runs`, "POST"),
      request(ava, `test-cases/${secondTestCase.id}/auto-runs`, "POST")
    ]);
    const first = await firstResponse.json() as { run: { id: string } };
    const second = await secondResponse.json() as { run: { id: string } };

    const [firstPaused, secondPaused] = await Promise.all([
      waitForRun(first.run.id, (run) => run.status === "PAUSED", "First Auto Run did not reach its checkpoint."),
      waitForRun(second.run.id, (run) => run.status === "PAUSED", "Second Auto Run did not reach its checkpoint concurrently.")
    ]);
    expect(firstPaused.attempts[0]?.status).toBe("RUNNING");
    expect(secondPaused.attempts[0]?.status).toBe("RUNNING");

    await Promise.all([
      request(ava, `runs/${first.run.id}/resume`, "POST"),
      request(ava, `runs/${second.run.id}/resume`, "POST")
    ]);
    const completed = await Promise.all([
      waitForRun(first.run.id, (run) => run.status === "COMPLETED", "First concurrent Auto Run did not complete."),
      waitForRun(second.run.id, (run) => run.status === "COMPLETED", "Second concurrent Auto Run did not complete.")
    ]);
    expect(completed.map((run) => run.outcome)).toEqual(["PASSED", "PASSED"]);
  }, 50_000);

  it("compares a successful Auto Run with the median of three guided Runs", async () => {
    const ava = await login("ava.tester@example.test");
    const testCase = await createSavedDemoTest(ava, `Benchmark journey ${Date.now()}`);
    const version = await prisma.testCaseVersion.findFirstOrThrow({ where: { testCaseId: testCase.id, version: 1 } });
    const completedAt = Date.now() - 60_000;
    await prisma.run.createMany({
      data: [1000, 2000, 3000].map((duration, index) => ({
        testCaseId: testCase.id,
        testCaseVersionId: version.id,
        productId: testCase.productId,
        initiatedById: testCase.ownerId,
        targetUrl: "http://demo-target",
        mode: RunMode.GUIDED,
        status: "COMPLETED",
        outcome: "PASSED",
        startedAt: new Date(completedAt - duration - index),
        completedAt: new Date(completedAt - index)
      }))
    });

    const start = await request(ava, `test-cases/${testCase.id}/auto-runs`, "POST");
    expect(start.status).toBe(201);
    const queued = await start.json() as { run: { id: string } };
    const completed = await waitForRun(queued.run.id, (run) => run.status === "COMPLETED", "Benchmarked Auto Run did not complete.");
    expect(completed.outcome).toBe("PASSED");
    expect(completed.benchmarkMedianMs).toBe(2000);
    expect(completed.durationDeltaMs).toBe((completed.activeDurationMs ?? 0) - 2000);
  }, 30_000);

  it("blocks non-password variables with Phase 4 guidance", async () => {
    const ava = await login("ava.tester@example.test");
    const testCase = await createSavedDemoTest(ava, `Variable journey ${Date.now()}`);
    const version = await prisma.testCaseVersion.findFirstOrThrow({ where: { testCaseId: testCase.id, version: 1 } });
    await prisma.testStep.updateMany({ where: { testCaseVersionId: version.id, order: 8 }, data: { variableName: "customerFirstName" } });

    const response = await request(ava, `test-cases/${testCase.id}/auto-runs`, "POST");
    expect(response.status).toBe(409);
    expect((await response.json() as { error: string }).error).toContain("Phase 4");
    expect(await prisma.run.count({ where: { testCaseId: testCase.id } })).toBe(0);
  });
});
