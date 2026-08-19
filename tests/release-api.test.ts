import { afterEach, describe, expect, it } from "vitest";
import { RecordingStatus, StepKind } from "@prisma/client";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";
const productIds: string[] = [];
const releaseIds: string[] = [];
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

async function createTestCase(productId: string, name: string, checkpoint = true) {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const recording = await prisma.recordingSession.create({ data: { productId, ownerId: owner.id, testName: name, targetUrl: "http://demo-target", tokenHash: `${name}-${Date.now()}`, status: RecordingStatus.SAVED } });
  return prisma.testCase.create({
    data: {
      productId,
      ownerId: owner.id,
      recordingSessionId: recording.id,
      name,
      versions: { create: { version: 1, steps: { create: [
        { order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" }, isCheckpoint: checkpoint },
        { order: 2, kind: StepKind.CLICK, timestamp: new Date(), target: { tag: "button", text: "Sign in" }, description: "Sign in", expectedOutcome: "Dashboard opens" }
      ] } } }
    }
  });
}

afterEach(async () => {
  for (const releaseId of releaseIds.splice(0)) await prisma.release.delete({ where: { id: releaseId } }).catch(() => undefined);
  for (const productId of productIds.splice(0)) {
    const testCases = await prisma.testCase.findMany({ where: { productId }, select: { id: true } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: testCases.map((testCase) => testCase.id) } } });
    await prisma.testCase.deleteMany({ where: { productId } });
    await prisma.recordingSession.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
  }
});

describe("Phase 5 versioning and Release API", () => {
  it("allows a labels-only version save when the Test Case contains a redacted password step", async () => {
    const ava = await login("ava.tester@example.test");
    const suffix = Date.now();
    const product = await (await request(ava, "products", "POST", { name: `Redacted version save ${suffix}` })).json() as { id: string };
    productIds.push(product.id);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
    const recording = await prisma.recordingSession.create({ data: { productId: product.id, ownerId: owner.id, testName: `Redacted version ${suffix}`, targetUrl: "http://demo-target", tokenHash: `redacted-${suffix}`, status: RecordingStatus.SAVED } });
    const testCase = await prisma.testCase.create({
      data: {
        productId: product.id,
        ownerId: owner.id,
        recordingSessionId: recording.id,
        name: `Redacted version ${suffix}`,
        versions: { create: { version: 1, steps: { create: [
          { order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" } },
          { order: 2, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { name: "password", type: "password" }, value: "[REDACTED]", isRedacted: true }
        ] } } }
      }
    });

    const detail = await (await request(ava, `test-cases/${testCase.id}`)).json() as { versions: Array<{ version: number; steps: Array<{ id: string; target: object; value: string | null; description: string | null; expectedOutcome: string | null; variableName: string | null; isCheckpoint: boolean }> }> };
    const current = detail.versions.find((version) => version.version === 1)!;
    const response = await request(ava, `test-cases/${testCase.id}/versions`, "POST", { featureLabels: ["auth"], steps: current.steps });

    expect(response.status).toBe(201);
    expect((await response.json()).version.version).toBe(2);
  });

  it("creates immutable versions with labels and snapshots excluded Release items safely", async () => {
    const ava = await login("ava.tester@example.test");
    const ben = await login("ben.tester@example.test");
    const suffix = Date.now();
    const firstProduct = await (await request(ava, "products", "POST", { name: `Release API A ${suffix}` })).json() as { id: string };
    const secondProduct = await (await request(ava, "products", "POST", { name: `Release API B ${suffix}` })).json() as { id: string };
    productIds.push(firstProduct.id, secondProduct.id);
    const first = await createTestCase(firstProduct.id, `Release customer ${suffix}`);
    const second = await createTestCase(secondProduct.id, `Release sign in ${suffix}`);

    const detailResponse = await request(ava, `test-cases/${first.id}`);
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json() as { currentVersion: number; versions: Array<{ version: number; steps: Array<{ id: string; target: object; value: string | null; description: string | null; expectedOutcome: string | null; variableName: string | null; isCheckpoint: boolean }> }> };
    const current = detail.versions.find((version) => version.version === 1)!;
    const versionResponse = await request(ava, `test-cases/${first.id}/versions`, "POST", {
      featureLabels: ["authentication", "customer management"],
      steps: current.steps.map((step, index) => ({ ...step, description: index === 1 ? "Open the signed-in dashboard" : step.description }))
    });
    expect(versionResponse.status).toBe(201);
    expect((await versionResponse.json()).version.version).toBe(2);
    const versioned = await request(ava, `test-cases/${first.id}`);
    const versionedPayload = await versioned.json() as { currentVersion: number; featureLabels: Array<{ featureLabel: { name: string } }>; versions: Array<{ version: number; steps: Array<{ description: string | null }> }> };
    expect(versionedPayload.currentVersion).toBe(2);
    expect(versionedPayload.versions).toHaveLength(2);
    expect(versionedPayload.versions.find((version) => version.version === 1)?.steps[1]?.description).toBe("Sign in");
    expect(versionedPayload.featureLabels.map((item) => item.featureLabel.name).sort()).toEqual(["authentication", "customer management"]);

    const releaseResponse = await request(ava, "releases", "POST", { name: `Release ${suffix}`, testCaseIds: [first.id, second.id] });
    expect(releaseResponse.status).toBe(201);
    const release = await releaseResponse.json() as { id: string };
    releaseIds.push(release.id);
    expect((await request(ben, `releases/${release.id}`)).status).toBe(403);
    const start = await request(ava, `releases/${release.id}/runs`, "POST");
    expect(start.status).toBe(201);
    const releaseDetail = await request(ava, `releases/${release.id}`);
    const payload = await releaseDetail.json() as { runs: Array<{ readiness: string; items: Array<{ status: string; exclusionReason: string | null; testCaseVersion: { version: number } }> }> };
    expect(payload.runs[0]?.readiness).toBe("NOT_READY");
    expect(payload.runs[0]?.items).toHaveLength(2);
    expect(payload.runs[0]?.items.every((item) => item.status === "EXCLUDED" && item.exclusionReason === "CHECKPOINT_REQUIRES_INDIVIDUAL_RUN")).toBe(true);
    expect(payload.runs[0]?.items.find((item) => item.testCaseVersion.version === 2)).toBeTruthy();

    const eligible = await createTestCase(firstProduct.id, `Release eligible ${suffix}`, false);
    const eligibleReleaseResponse = await request(ava, "releases", "POST", { name: `Eligible Release ${suffix}`, testCaseIds: [eligible.id] });
    expect(eligibleReleaseResponse.status).toBe(201);
    const eligibleRelease = await eligibleReleaseResponse.json() as { id: string };
    releaseIds.push(eligibleRelease.id);
    const eligibleStart = await request(ava, `releases/${eligibleRelease.id}/runs`, "POST");
    expect(eligibleStart.status).toBe(201);
    const eligibleRunId = (await eligibleStart.json() as { releaseRunId: string }).releaseRunId;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const releaseRun = await prisma.releaseRun.findUnique({ where: { id: eligibleRunId }, include: { items: { include: { run: true } } } });
      if (releaseRun?.readiness === "READY") break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const completed = await prisma.releaseRun.findUniqueOrThrow({ where: { id: eligibleRunId }, include: { items: { include: { run: true } } } });
    expect(completed.readiness).toBe("READY");
    expect(completed.items[0]).toMatchObject({ status: "PASSED", run: { mode: "AUTO", outcome: "PASSED" } });
  }, 20_000);
});
