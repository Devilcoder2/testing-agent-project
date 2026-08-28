import { afterEach, describe, expect, it } from "vitest";
import { ChangeProposalStatus, NotificationType, RecordingStatus, ReleaseReadiness, ReleaseRunItemStatus, ReleaseRunStatus, RunMode, RunOutcome, RunStatus, StepKind } from "@prisma/client";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3001";
const productIds: string[] = [];
const releaseIds: string[] = [];
const deletionIds: string[] = [];

async function login(email: string) {
  const response = await fetch(`${baseUrl}/api/auth/dev-login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "sentinel-dev" }) });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Development login did not return a session cookie.");
  return cookie;
}

async function request(cookie: string, path: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}/api/${path}`, { method, headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
}

async function createTestCase(productId: string, ownerId: string, name: string) {
  const recording = await prisma.recordingSession.create({ data: { productId, ownerId, testName: name, targetUrl: "http://demo-target", tokenHash: `${name}-${Date.now()}-${Math.random()}`, status: RecordingStatus.SAVED } });
  return prisma.testCase.create({ data: { productId, ownerId, recordingSessionId: recording.id, name, versions: { create: { version: 1, steps: { create: { order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" } } } } } }, include: { versions: true } });
}

afterEach(async () => {
  for (const releaseId of releaseIds.splice(0)) await prisma.release.delete({ where: { id: releaseId } }).catch(() => undefined);
  for (const productId of productIds.splice(0)) {
    await prisma.notification.deleteMany({ where: { productId } });
    await prisma.run.deleteMany({ where: { productId } });
    await prisma.testCase.deleteMany({ where: { productId } });
    await prisma.recordingSession.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } }).catch(() => undefined);
    await prisma.auditEvent.deleteMany({ where: { entityId: productId } });
  }
  for (const deletionId of deletionIds.splice(0)) await prisma.productDeletionRequest.delete({ where: { id: deletionId } }).catch(() => undefined);
});

describe("administrative Product deletion", () => {
  it("queues an Admin-only cascade, preserves the Release, and removes only the deleted Product items", async () => {
    const admin = await login("ava.tester@example.test");
    const tester = await login("ben.tester@example.test");
    const suffix = Date.now();
    const deletingProduct = await (await request(admin, "products", "POST", { name: `Delete cascade ${suffix}` })).json() as { id: string };
    const retainedProduct = await (await request(admin, "products", "POST", { name: `Retain release ${suffix}` })).json() as { id: string };
    productIds.push(deletingProduct.id, retainedProduct.id);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
    const deletingTest = await createTestCase(deletingProduct.id, owner.id, `Delete test ${suffix}`);
    const retainedTest = await createTestCase(retainedProduct.id, owner.id, `Retained test ${suffix}`);
    const deletingVersion = deletingTest.versions[0]!;
    const retainedVersion = retainedTest.versions[0]!;
    const run = await prisma.run.create({ data: { testCaseId: deletingTest.id, testCaseVersionId: deletingVersion.id, productId: deletingProduct.id, initiatedById: owner.id, targetUrl: "http://demo-target", mode: RunMode.GUIDED, status: RunStatus.COMPLETED, outcome: RunOutcome.FAILED, completedAt: new Date() } });
    await prisma.changeProposal.create({ data: { runId: run.id, productId: deletingProduct.id, testCaseId: deletingTest.id, sourceVersionId: deletingVersion.id, createdById: owner.id, ownerId: owner.id, status: ChangeProposalStatus.DRAFT, context: "Deletion cascade fixture" } });
    await prisma.notification.create({ data: { recipientId: owner.id, productId: deletingProduct.id, runId: run.id, type: NotificationType.RUN_FAILED } });
    await prisma.testDataSet.create({ data: { productId: deletingProduct.id, ownerId: owner.id, name: `Delete data ${suffix}`, fieldNames: ["email"], encryptedFields: "fixture" } });
    const release = await prisma.release.create({ data: { name: `Preserved release ${suffix}`, ownerId: owner.id, tests: { create: [{ testCaseId: deletingTest.id }, { testCaseId: retainedTest.id }] }, runs: { create: { initiatedById: owner.id, status: ReleaseRunStatus.COMPLETED, readiness: ReleaseReadiness.NOT_READY, completedAt: new Date(), items: { create: [
      { testCaseId: deletingTest.id, testCaseVersionId: deletingVersion.id, productId: deletingProduct.id, status: ReleaseRunItemStatus.EXCLUDED },
      { testCaseId: retainedTest.id, testCaseVersionId: retainedVersion.id, productId: retainedProduct.id, status: ReleaseRunItemStatus.EXCLUDED }
    ] } } } }, include: { runs: true } });
    releaseIds.push(release.id);

    expect((await request(tester, `products/${deletingProduct.id}`, "DELETE", { confirmation: "DELETE" })).status).toBe(403);
    expect((await request(admin, `products/${deletingProduct.id}`, "DELETE", { confirmation: "delete" })).status).toBe(400);

    const impactResponse = await request(admin, `products/${deletingProduct.id}/deletion-impact`);
    expect(impactResponse.status).toBe(200);
    expect((await impactResponse.json()).impact).toMatchObject({ testCases: 1, runs: 1, testDataSets: 1, reviewItems: 1, notifications: 1, releasesAffected: 1 });

    const queuedResponse = await request(admin, `products/${deletingProduct.id}`, "DELETE", { confirmation: "DELETE" });
    expect(queuedResponse.status).toBe(202);
    const queued = await queuedResponse.json() as { id: string; status: string };
    deletionIds.push(queued.id);
    expect(["QUEUED", "PROCESSING"]).toContain(queued.status);

    let status = queued.status;
    for (let attempt = 0; attempt < 40 && status !== "COMPLETED"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const statusResponse = await request(admin, `product-deletions/${queued.id}`);
      expect(statusResponse.status).toBe(200);
      status = (await statusResponse.json() as { status: string }).status;
    }
    expect(status).toBe("COMPLETED");
    expect(await prisma.product.findUnique({ where: { id: deletingProduct.id } })).toBeNull();
    productIds.splice(productIds.indexOf(deletingProduct.id), 1);
    const preservedRelease = await prisma.release.findUniqueOrThrow({ where: { id: release.id }, include: { tests: true, runs: { include: { items: true } } } });
    expect(preservedRelease.tests.map((item) => item.testCaseId)).toEqual([retainedTest.id]);
    expect(preservedRelease.runs[0]?.items.map((item) => item.productId)).toEqual([retainedProduct.id]);
    expect(await prisma.run.count({ where: { productId: deletingProduct.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { productId: deletingProduct.id } })).toBe(0);
    expect(await prisma.changeProposal.count({ where: { productId: deletingProduct.id } })).toBe(0);
    expect(await prisma.testDataSet.count({ where: { productId: deletingProduct.id } })).toBe(0);
    expect(await prisma.productDeletionRequest.findUnique({ where: { id: queued.id } })).toMatchObject({ productId: null, status: "COMPLETED" });
  }, 20_000);
});
