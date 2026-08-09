import { afterEach, describe, expect, it } from "vitest";
import { RecordingStatus, StepKind } from "@prisma/client";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";
const createdProductIds: string[] = [];

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
              { order: 2, kind: StepKind.CLICK, timestamp: new Date(), target: { tag: "button", text: "Sign in" }, expectedOutcome: "The dashboard opens" }
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
    expect(detail.stepResults.map((step) => step.status)).toEqual(["PENDING", "PENDING"]);
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

    const interrupt = await request(ava, `runs/${started.run.id}/interrupt`, "POST");
    expect(interrupt.status).toBe(200);
    const completed = await interrupt.json() as { status: string; outcome: string; evidenceStatus: string };
    expect(completed).toMatchObject({ status: "COMPLETED", outcome: "INTERRUPTED" });
    expect(["COMPLETE", "PARTIAL"]).toContain(completed.evidenceStatus);

    const persisted = await prisma.run.findUniqueOrThrow({ where: { id: started.run.id }, include: { stepResults: true } });
    expect(persisted.testCaseVersionId).toBe(started.run.testCaseVersionId);
    expect(persisted.stepResults.map((step) => step.status)).toEqual(["PASSED", "PENDING"]);
  }, 30_000);
});
