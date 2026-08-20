import { afterEach, describe, expect, it } from "vitest";
import { ChangeProposalStatus, DatabaseDiagnosticKind, DatabaseDiagnosticStatus, RecordingStatus, RunOutcome, RunStatus, StepKind } from "@prisma/client";
import { persistRunSnapshot } from "../lib/evidence";
import { jiraRetryAfterMs } from "../lib/jira";
import { runEvidenceRetention } from "../lib/maintenance";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";
const productIds: string[] = [];
const maintenanceIds: string[] = [];
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

async function fixture(owner: Awaited<ReturnType<typeof login>>, suffix: number) {
  const productResponse = await request(owner, "products", "POST", { name: `Pilot hardening ${suffix}` });
  const product = await productResponse.json() as { id: string };
  productIds.push(product.id);
  const ava = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const recording = await prisma.recordingSession.create({ data: { productId: product.id, ownerId: ava.id, testName: "Pilot source", targetUrl: "http://demo-target", tokenHash: `pilot-${suffix}`, status: RecordingStatus.SAVED } });
  const testCase = await prisma.testCase.create({ data: { productId: product.id, ownerId: ava.id, recordingSessionId: recording.id, name: "Pilot source", versions: { create: { version: 1, steps: { create: [{ order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" } }] } } } }, include: { versions: { include: { steps: true } } } });
  const run = await prisma.run.create({ data: { productId: product.id, testCaseId: testCase.id, testCaseVersionId: testCase.versions[0].id, initiatedById: ava.id, targetUrl: "http://demo-target", status: RunStatus.COMPLETED, outcome: RunOutcome.FAILED, completedAt: new Date() } });
  return { product, testCase, version: testCase.versions[0], run, ava };
}

afterEach(async () => {
  await prisma.maintenanceRun.deleteMany({ where: { id: { in: maintenanceIds.splice(0) } } });
  for (const productId of productIds.splice(0)) {
    await prisma.release.deleteMany({ where: { tests: { some: { testCase: { productId } } } } });
    await prisma.testCase.deleteMany({ where: { productId } });
    await prisma.recordingSession.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
  }
});

describe("Phase 11 pilot hardening", () => {
  it("transfers ownership only to eligible members and reroutes submitted Test Case reviews", async () => {
    const ava = await login("ava.tester@example.test");
    const ben = await login("ben.tester@example.test");
    const source = await fixture(ava, Date.now());
    const benUser = await prisma.user.findUniqueOrThrow({ where: { email: "ben.tester@example.test" } });
    await prisma.productMembership.create({ data: { productId: source.product.id, userId: benUser.id } });
    const proposal = await prisma.changeProposal.create({ data: { runId: source.run.id, productId: source.product.id, testCaseId: source.testCase.id, sourceVersionId: source.version.id, createdById: benUser.id, ownerId: source.ava.id, status: ChangeProposalStatus.SUBMITTED, context: "Pilot review", submittedAt: new Date() } });

    expect((await request(ben, `test-cases/${source.testCase.id}/owner`, "PATCH", { ownerId: benUser.id })).status).toBe(403);
    const transferred = await request(ava, `test-cases/${source.testCase.id}/owner`, "PATCH", { ownerId: benUser.id });
    expect(transferred.status).toBe(200);
    expect(await prisma.testCase.findUniqueOrThrow({ where: { id: source.testCase.id }, select: { ownerId: true } })).toEqual({ ownerId: benUser.id });
    expect(await prisma.changeProposal.findUniqueOrThrow({ where: { id: proposal.id }, select: { ownerId: true } })).toEqual({ ownerId: benUser.id });

    const release = await prisma.release.create({ data: { name: "Pilot release", ownerId: source.ava.id, tests: { create: { testCaseId: source.testCase.id } } } });
    expect((await request(ava, `releases/${release.id}/owner`, "PATCH", { ownerId: benUser.id })).status).toBe(200);
    expect(await prisma.release.findUniqueOrThrow({ where: { id: release.id }, select: { ownerId: true } })).toEqual({ ownerId: benUser.id });
  });

  it("purges only completed expired evidence and completed diagnostics", async () => {
    const ava = await login("ava.tester@example.test");
    const source = await fixture(ava, Date.now());
    await persistRunSnapshot({ runId: source.run.id, label: "END", screenshot: Buffer.from("pilot-screenshot"), network: [], console: [], storage: {}, includeScreenshot: true });
    const expiredAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await prisma.evidenceItem.updateMany({ where: { runId: source.run.id }, data: { capturedAt: expiredAt } });
    await prisma.databaseDiagnostic.create({ data: { runId: source.run.id, kind: DatabaseDiagnosticKind.CUSTOMER_LOOKUP_BY_EMAIL, status: DatabaseDiagnosticStatus.COMPLETE, requestedById: source.ava.id, safeMetadata: { result: "FOUND" }, completedAt: expiredAt } });

    const maintenance = await runEvidenceRetention();
    maintenanceIds.push(maintenance.id);
    expect(maintenance.status).toBe("COMPLETED");
    expect(maintenance.deletedEvidenceCount).toBeGreaterThan(0);
    expect(maintenance.deletedDiagnosticCount).toBe(1);
    expect(await prisma.evidenceItem.count({ where: { runId: source.run.id } })).toBe(0);
    expect(await prisma.databaseDiagnostic.count({ where: { runId: source.run.id } })).toBe(0);
  });

  it("keeps readiness authenticated and parses capped Jira Retry-After delays", async () => {
    const ava = await login("ava.tester@example.test");
    const readiness = await request(ava, "pilot-readiness");
    expect(readiness.status).toBe(200);
    expect((await readiness.json() as { localOnly: boolean; items: Array<{ key: string }> }).items.map((item) => item.key)).toContain("worker");
    expect(jiraRetryAfterMs("2")).toBe(2_000);
    expect(jiraRetryAfterMs("120")).toBe(60_000);
    expect(jiraRetryAfterMs("invalid")).toBeUndefined();
  });
});
