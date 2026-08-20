import { afterEach, describe, expect, it } from "vitest";
import { RecordingStatus, RunOutcome, RunStatus, StepKind } from "@prisma/client";
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

async function failedRun(productId: string, suffix: number) {
  const ava = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const recording = await prisma.recordingSession.create({ data: { productId, ownerId: ava.id, testName: `Change source ${suffix}`, targetUrl: "http://demo-target", tokenHash: `change-${suffix}`, status: RecordingStatus.SAVED } });
  const testCase = await prisma.testCase.create({ data: { productId, ownerId: ava.id, recordingSessionId: recording.id, name: `Change source ${suffix}`, versions: { create: { version: 1, steps: { create: [{ order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" }, description: "Open the customer workspace", expectedOutcome: "The sign-in page appears" }] } } } }, include: { versions: { include: { steps: true } } } });
  const version = testCase.versions[0];
  const run = await prisma.run.create({ data: { productId, testCaseId: testCase.id, testCaseVersionId: version.id, initiatedById: ava.id, targetUrl: "http://demo-target", status: RunStatus.COMPLETED, outcome: RunOutcome.FAILED, completedAt: new Date() } });
  return { testCase, version, step: version.steps[0], run };
}

afterEach(async () => {
  for (const productId of productIds.splice(0)) {
    await prisma.testCase.deleteMany({ where: { productId } });
    await prisma.recordingSession.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
  }
});

describe("Phase 9 change-aware approval", () => {
  it("keeps the failed baseline immutable, requires the owner decision, and blocks a stale proposal", async () => {
    const ava = await login("ava.tester@example.test");
    const ben = await login("ben.tester@example.test");
    const suffix = Date.now();
    const productResponse = await request(ava, "products", "POST", { name: `Change proposal product ${suffix}` });
    const product = await productResponse.json() as { id: string };
    productIds.push(product.id);
    const benUser = await prisma.user.findUniqueOrThrow({ where: { email: "ben.tester@example.test" } });
    await prisma.productMembership.create({ data: { productId: product.id, userId: benUser.id } });
    const source = await failedRun(product.id, suffix);

    const created = await request(ben, `runs/${source.run.id}/change-proposals`, "POST", { context: "QA deployment changes the first landing expectation.", changes: [{ stepId: source.step.id, description: "Open the updated customer workspace", expectedOutcome: "The revised sign-in page appears" }] });
    expect(created.status).toBe(201);
    const proposal = await created.json() as { id: string };
    expect((await request(ben, `change-proposals/${proposal.id}/submit`, "POST")).status).toBe(200);
    expect((await request(ben, `change-proposals/${proposal.id}/approve`, "POST")).status).toBe(403);
    expect((await request(ava, `change-proposals/${proposal.id}/approve`, "POST", { note: "Expected deployment change." })).status).toBe(200);

    const preserved = await prisma.testCase.findUniqueOrThrow({ where: { id: source.testCase.id }, include: { versions: { include: { steps: true }, orderBy: { version: "asc" } } } });
    expect(preserved.currentVersion).toBe(2);
    expect(preserved.versions[0].steps[0].description).toBe("Open the customer workspace");
    expect(preserved.versions[1].steps[0].description).toBe("Open the updated customer workspace");

    const nextRun = await prisma.run.create({ data: { productId: product.id, testCaseId: source.testCase.id, testCaseVersionId: preserved.versions[1].id, initiatedById: benUser.id, targetUrl: "http://demo-target", status: RunStatus.COMPLETED, outcome: RunOutcome.FAILED, completedAt: new Date() } });
    const staleCreate = await request(ben, `runs/${nextRun.id}/change-proposals`, "POST", { context: "A later deployment is under review.", changes: [{ stepId: preserved.versions[1].steps[0].id, expectedOutcome: "A different page appears" }] });
    const stale = await staleCreate.json() as { id: string };
    await request(ben, `change-proposals/${stale.id}/submit`, "POST");
    await prisma.testCase.update({ where: { id: source.testCase.id }, data: { currentVersion: 3 } });
    const staleDecision = await request(ava, `change-proposals/${stale.id}/approve`, "POST");
    expect(staleDecision.status).toBe(409);
    expect((await staleDecision.json() as { status: string }).status).toBe("STALE");
  });

  it("creates an editable Jira draft, but never files it, when the owner rejects a proposal", async () => {
    const ava = await login("ava.tester@example.test");
    const suffix = Date.now();
    const productResponse = await request(ava, "products", "POST", { name: `Rejected change product ${suffix}` });
    const product = await productResponse.json() as { id: string };
    productIds.push(product.id);
    await prisma.jiraProjectConfig.create({ data: { productId: product.id, projectKey: "SENTINEL" } });
    const source = await failedRun(product.id, suffix);
    const created = await request(ava, `runs/${source.run.id}/change-proposals`, "POST", { context: "The observed failure needs a defect review.", changes: [{ stepId: source.step.id, expectedOutcome: "A corrected page appears" }] });
    const proposal = await created.json() as { id: string };
    await request(ava, `change-proposals/${proposal.id}/submit`, "POST");
    expect((await request(ava, `change-proposals/${proposal.id}/reject`, "POST", { note: "This is not an intended baseline change." })).status).toBe(200);
    const filing = await prisma.jiraFiling.findUniqueOrThrow({ where: { runId: source.run.id } });
    expect(filing.status).toBe("DRAFT");
    expect(filing.queuedAt).toBeNull();
    expect(filing.filedAt).toBeNull();
  });
});
