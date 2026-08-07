import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";
const createdProductIds: string[] = [];

type Session = { cookie: string };
type RecordingResponse = { recording: { id: string }; token: string };

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

async function createProduct(session: Session, name: string) {
  const response = await request(session, "products", "POST", { name });
  expect(response.status).toBe(201);
  const product = await response.json() as { id: string; name: string };
  createdProductIds.push(product.id);
  return product;
}

async function createRecording(session: Session, productId: string, testName: string) {
  const response = await request(session, "recordings", "POST", { productId, testName, targetUrl: "http://demo-target" });
  expect(response.status).toBe(201);
  return response.json() as Promise<RecordingResponse>;
}

async function activateRecording(session: Session, recording: RecordingResponse) {
  const response = await request(session, `recordings/${recording.recording.id}/launch`, "POST", { token: recording.token });
  expect(response.status).toBe(200);
}

async function postEvent(token: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}/api/internal/events`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-recording-token": token },
    body: JSON.stringify(body)
  });
}

afterEach(async () => {
  for (const productId of createdProductIds.splice(0)) {
    const testCases = await prisma.testCase.findMany({ where: { productId }, select: { id: true } });
    await prisma.auditEvent.deleteMany({ where: { entityType: "TestCase", entityId: { in: testCases.map((testCase) => testCase.id) } } });
    await prisma.testCase.deleteMany({ where: { productId } });
    await prisma.recordingSession.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
  }
});

describe("recording API and database persistence", () => {
  it("records ordered events, redacts passwords, saves immutable steps, and enforces access", async () => {
    const ava = await login("ava.tester@example.test");
    const ben = await login("ben.tester@example.test");
    const product = await createProduct(ava, `API verification ${Date.now()}`);
    const created = await createRecording(ava, product.id, `Save verification ${Date.now()}`);
    await activateRecording(ava, created);

    await expect(postEvent(created.token, { kind: "NAVIGATION", target: { url: "http://demo-target", title: "Demo CRM" } })).resolves.toMatchObject({ status: 200 });
    await expect(postEvent(created.token, { kind: "CLICK", target: { tag: "button", text: "Sign in" } })).resolves.toMatchObject({ status: 200 });
    await expect(postEvent(created.token, { kind: "TEXT_ENTRY", target: { tag: "input", name: "email" }, value: "qa.tester@example.test", isRedacted: false })).resolves.toMatchObject({ status: 200 });
    await expect(postEvent(created.token, { kind: "TEXT_ENTRY", target: { tag: "input", name: "password" }, value: "[REDACTED]", isRedacted: true })).resolves.toMatchObject({ status: 200 });

    const stepsResponse = await request(ava, `recordings/${created.recording.id}/steps`);
    expect(stepsResponse.status).toBe(200);
    const steps = await stepsResponse.json() as Array<{ id: string; order: number; kind: string; value: string | null; isRedacted: boolean }>;
    expect(steps.map((step) => step.order)).toEqual([1, 2, 3, 4]);
    expect(steps.at(-1)).toMatchObject({ kind: "TEXT_ENTRY", value: "[REDACTED]", isRedacted: true });
    expect(JSON.stringify(steps)).not.toContain("TestPassword!");

    const editedStep = steps[2];
    const editResponse = await request(ava, `recordings/${created.recording.id}/steps/${editedStep.id}`, "PATCH", {
      description: "Enter the QA email",
      expectedOutcome: "The email field accepts the account",
      variableName: "qaEmail"
    });
    expect(editResponse.status).toBe(200);

    const saveResponse = await request(ava, `recordings/${created.recording.id}/save`, "POST");
    expect(saveResponse.status).toBe(201);
    const saved = await saveResponse.json() as { id: string };

    expect((await request(ben, `recordings/${created.recording.id}/steps`)).status).toBe(403);
    expect((await request(ben, `test-cases/${saved.id}`)).status).toBe(403);

    const testCase = await prisma.testCase.findUnique({
      where: { id: saved.id },
      include: { versions: { include: { steps: { orderBy: { order: "asc" } } } }, owner: true }
    });
    expect(testCase?.owner.email).toBe("ava.tester@example.test");
    expect(testCase?.currentVersion).toBe(1);
    expect(testCase?.versions[0].steps).toHaveLength(4);
    expect(testCase?.versions[0].steps[2]).toMatchObject({ description: "Enter the QA email", expectedOutcome: "The email field accepts the account", variableName: "qaEmail" });
    expect(testCase?.versions[0].steps[3]).toMatchObject({ value: "[REDACTED]", isRedacted: true });
    expect(await prisma.auditEvent.count({ where: { action: "TEST_CASE_SAVED", entityId: saved.id } })).toBe(1);
  });

  it("discards a draft without creating a Test Case", async () => {
    const ava = await login("ava.tester@example.test");
    const product = await createProduct(ava, `Discard verification ${Date.now()}`);
    const created = await createRecording(ava, product.id, `Discarded draft ${Date.now()}`);
    await activateRecording(ava, created);
    await expect(postEvent(created.token, { kind: "CLICK", target: { tag: "button", text: "New customer" } })).resolves.toMatchObject({ status: 200 });

    const discardResponse = await request(ava, `recordings/${created.recording.id}`, "DELETE");
    expect(discardResponse.status).toBe(204);
    expect(await prisma.recordingSession.findUnique({ where: { id: created.recording.id } })).toBeNull();
    expect(await prisma.testCase.findFirst({ where: { recordingSessionId: created.recording.id } })).toBeNull();
  });
});
