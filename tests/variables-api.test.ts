import { afterEach, describe, expect, it } from "vitest";
import { RecordingStatus, StepKind } from "@prisma/client";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";
const productIds: string[] = [];
type Session = { cookie: string };

async function login(email: string): Promise<Session> {
  const response = await fetch(`${baseUrl}/api/auth/dev-login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "sentinel-dev" }) });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Development login did not return a session cookie.");
  return { cookie };
}

async function request(session: Session, path: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}/api/${path}`, { method, headers: { cookie: session.cookie, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
}

async function variableTestCase(session: Session) {
  const productResponse = await request(session, "products", "POST", { name: `Variable API ${Date.now()}` });
  expect(productResponse.status).toBe(201);
  const product = await productResponse.json() as { id: string };
  productIds.push(product.id);
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const recording = await prisma.recordingSession.create({ data: { productId: product.id, ownerId: owner.id, testName: `Variable Test ${Date.now()}`, targetUrl: "http://demo-target", tokenHash: `variable-${Date.now()}`, status: RecordingStatus.DRAFT } });
  await prisma.recordedStep.create({ data: { recordingSessionId: recording.id, order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" } } });
  const step = await prisma.recordedStep.create({ data: { recordingSessionId: recording.id, order: 2, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "email" }, value: "customer.one@example.test", isCheckpoint: true } });
  const marked = await request(session, `recordings/${recording.id}/steps/${step.id}`, "PATCH", { variableName: "customer_email" });
  expect(marked.status).toBe(200);
  const saved = await request(session, `recordings/${recording.id}/save`, "POST");
  expect(saved.status).toBe(201);
  return { product, testCase: await saved.json() as { id: string } };
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

describe("Phase 4 variable API", () => {
  it("encrypts a static default, masks API output, and reserves/releases local Test Data", async () => {
    const ava = await login("ava.tester@example.test");
    const ben = await login("ben.tester@example.test");
    const { product, testCase } = await variableTestCase(ava);

    const testCaseDetail = await request(ava, `test-cases/${testCase.id}`);
    expect(testCaseDetail.status).toBe(200);
    expect(JSON.stringify(await testCaseDetail.json())).not.toContain("customer.one@example.test");

    const dataSetResponse = await request(ava, `products/${product.id}/test-data`, "POST", { name: "Customer one", fields: { customer_email: "customer.pool@example.test" } });
    expect(dataSetResponse.status).toBe(201);
    const dataSet = await dataSetResponse.json() as { id: string; fieldNames: string[]; status: string; reusePolicy: string };
    expect(dataSet).toMatchObject({ fieldNames: ["customer_email"], status: "SAFE", reusePolicy: "REUSABLE" });
    expect((await request(ben, `products/${product.id}/test-data`)).status).toBe(403);
    const storedDataSet = await prisma.testDataSet.findUniqueOrThrow({ where: { id: dataSet.id } });
    expect(storedDataSet.encryptedFields).not.toContain("customer.pool@example.test");

    const start = await request(ava, `test-cases/${testCase.id}/auto-runs`, "POST", { bindings: { customer_email: { source: "POOL", dataSetId: dataSet.id } } });
    expect(start.status).toBe(201);
    const queued = await start.json() as { run: { id: string } };
    const reserved = await prisma.testDataSet.findUniqueOrThrow({ where: { id: dataSet.id } });
    expect(reserved).toMatchObject({ status: "RESERVED", reservedByRunId: queued.run.id });
    const run = await prisma.run.findUniqueOrThrow({ where: { id: queued.run.id }, include: { variableBindings: true } });
    expect(run.variableBindings).toHaveLength(1);
    expect(run.variableBindings[0]?.valueEncrypted).not.toContain("customer.pool@example.test");
    const concurrentStart = await request(ava, `test-cases/${testCase.id}/auto-runs`, "POST", { bindings: { customer_email: { source: "POOL", dataSetId: dataSet.id } } });
    expect(concurrentStart.status).toBe(409);
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const current = await prisma.run.findUniqueOrThrow({ where: { id: queued.run.id } });
      if (current.status === "PAUSED") break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    expect((await prisma.run.findUniqueOrThrow({ where: { id: queued.run.id } })).status).toBe("PAUSED");
    const cancel = await request(ava, `runs/${queued.run.id}/cancel`, "POST");
    expect([200, 202]).toContain(cancel.status);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const released = await prisma.testDataSet.findUniqueOrThrow({ where: { id: dataSet.id } });
      if (released.status === "SAFE") break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const afterCancellation = await prisma.testDataSet.findUniqueOrThrow({ where: { id: dataSet.id } });
    expect(afterCancellation).toMatchObject({ status: "SAFE", reusePolicy: "REUSABLE" });

    const singleUseResponse = await request(ava, `products/${product.id}/test-data`, "POST", { name: "Customer one-time", reusePolicy: "SINGLE_USE", fields: { customer_email: "customer.once@example.test" } });
    expect(singleUseResponse.status).toBe(201);
    const singleUseDataSet = await singleUseResponse.json() as { id: string; reusePolicy: string };
    expect(singleUseDataSet.reusePolicy).toBe("SINGLE_USE");
    const singleUseRun = await request(ava, `test-cases/${testCase.id}/auto-runs`, "POST", { bindings: { customer_email: { source: "POOL", dataSetId: singleUseDataSet.id } } });
    expect(singleUseRun.status).toBe(201);
    const singleUseRunId = (await singleUseRun.json() as { run: { id: string } }).run.id;
    expect([200, 202]).toContain((await request(ava, `runs/${singleUseRunId}/cancel`, "POST")).status);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const released = await prisma.testDataSet.findUniqueOrThrow({ where: { id: singleUseDataSet.id } });
      if (released.status === "SAFE") break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    expect(await prisma.testDataSet.findUniqueOrThrow({ where: { id: singleUseDataSet.id } })).toMatchObject({ status: "SAFE", reusePolicy: "SINGLE_USE" });
  }, 30_000);

  it("accepts one-off values without serializing them and rejects secret-like inputs", async () => {
    const ava = await login("ava.tester@example.test");
    const { testCase } = await variableTestCase(ava);

    const rejected = await request(ava, `test-cases/${testCase.id}/auto-runs`, "POST", { bindings: { customer_email: { source: "MANUAL", value: "Bearer should-not-be-stored" } } });
    expect(rejected.status).toBe(400);
    expect(JSON.stringify(await rejected.json())).not.toContain("should-not-be-stored");

    const started = await request(ava, `test-cases/${testCase.id}/auto-runs`, "POST", { bindings: { customer_email: { source: "MANUAL", value: "customer.manual@example.test" } } });
    expect(started.status).toBe(201);
    const { run } = await started.json() as { run: { id: string } };
    const detail = await request(ava, `runs/${run.id}`);
    expect(detail.status).toBe(200);
    expect(JSON.stringify(await detail.json())).not.toContain("customer.manual@example.test");
    const stored = await prisma.runVariableBinding.findUniqueOrThrow({ where: { runId_name: { runId: run.id, name: "customer_email" } } });
    expect(stored.source).toBe("MANUAL");
    expect(stored.valueEncrypted).not.toContain("customer.manual@example.test");

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const current = await prisma.run.findUniqueOrThrow({ where: { id: run.id } });
      if (current.status === "PAUSED") break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    expect((await prisma.run.findUniqueOrThrow({ where: { id: run.id } })).status).toBe("PAUSED");
    expect([200, 202]).toContain((await request(ava, `runs/${run.id}/cancel`, "POST")).status);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const current = await prisma.run.findUniqueOrThrow({ where: { id: run.id } });
      if (current.status === "COMPLETED") break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    expect((await prisma.run.findUniqueOrThrow({ where: { id: run.id } })).status).toBe("COMPLETED");
  }, 30_000);
});
