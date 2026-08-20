import { afterEach, describe, expect, it } from "vitest";
import { RecordingStatus, StepKind } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { suggestionsForSteps } from "../lib/suggestions";

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

async function createSourceTest(productId: string, suffix: number) {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const label = await prisma.featureLabel.create({ data: { productId, name: `negative-${suffix}` } });
  const recording = await prisma.recordingSession.create({ data: { productId, ownerId: owner.id, testName: `Happy customer ${suffix}`, targetUrl: "http://demo-target", tokenHash: `suggestion-${suffix}`, status: RecordingStatus.SAVED } });
  return prisma.testCase.create({
    data: {
      productId,
      ownerId: owner.id,
      recordingSessionId: recording.id,
      name: `Happy customer ${suffix}`,
      featureLabels: { create: { featureLabelId: label.id } },
      versions: {
        create: {
          version: 1,
          steps: {
            create: [
              { order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" } },
              { order: 2, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "email", inputType: "email", required: true }, value: "customer@example.test" },
              { order: 3, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "firstName", inputType: "text", required: true, minLength: 2, maxLength: 50 }, value: "Ada" },
              { order: 4, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "password", inputType: "password", required: true }, value: "[REDACTED]", isRedacted: true },
              { order: 5, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "customerId", inputType: "text", required: true }, value: "[VARIABLE:customer_id]", variableName: "customer_id" }
            ]
          }
        }
      }
    },
    include: { versions: { include: { steps: { orderBy: { order: "asc" } } } } }
  });
}

afterEach(async () => {
  for (const productId of productIds.splice(0)) {
    const [testCases, suggestions] = await Promise.all([
      prisma.testCase.findMany({ where: { productId }, select: { id: true } }),
      prisma.testSuggestion.findMany({ where: { productId }, select: { id: true } })
    ]);
    await prisma.auditEvent.deleteMany({ where: { OR: [{ entityType: "TestCase", entityId: { in: testCases.map((testCase) => testCase.id) } }, { entityType: "TestSuggestion", entityId: { in: suggestions.map((suggestion) => suggestion.id) } }] } });
    await prisma.testCase.deleteMany({ where: { productId } });
    await prisma.recordingSession.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
  }
});

describe("Phase 7 deterministic suggestion rules", () => {
  it("produces only supported missing, invalid, and boundary candidates while explaining sensitive skips", () => {
    const result = suggestionsForSteps([
      { id: "email", order: 1, kind: "TEXT_ENTRY", target: { tag: "input", name: "email", inputType: "email", required: true }, value: "person@example.test", isRedacted: false, variableName: null },
      { id: "name", order: 2, kind: "TEXT_ENTRY", target: { tag: "input", name: "firstName", inputType: "text", required: true, minLength: 2, maxLength: 50 }, value: "Ada", isRedacted: false, variableName: null },
      { id: "password", order: 3, kind: "TEXT_ENTRY", target: { tag: "input", name: "password", inputType: "password" }, value: "[REDACTED]", isRedacted: true, variableName: null },
      { id: "variable", order: 4, kind: "TEXT_ENTRY", target: { tag: "input", name: "customerId", inputType: "text" }, value: "[VARIABLE:customer_id]", isRedacted: false, variableName: "customer_id" }
    ]);
    expect(result.candidates.map((candidate) => candidate.kind)).toEqual(["REQUIRED_MISSING", "INVALID_EMAIL", "REQUIRED_MISSING", "BOUNDARY_TOO_SHORT", "BOUNDARY_TOO_LONG"]);
    expect(result.candidates.find((candidate) => candidate.kind === "BOUNDARY_TOO_SHORT")?.proposedValue).toBe("A");
    expect(result.candidates.find((candidate) => candidate.kind === "BOUNDARY_TOO_LONG")?.proposedValue).toHaveLength(51);
    expect(result.skipped.map((skip) => skip.reason).join(" ")).toContain("Redacted password");
    expect(result.skipped.map((skip) => skip.reason).join(" ")).toContain("Variable-backed");
  });

  it("creates reviewable drafts idempotently, protects them by Product, and approves an independent Version 1", async () => {
    const ava = await login("ava.tester@example.test");
    const ben = await login("ben.tester@example.test");
    const suffix = Date.now();
    const productResponse = await request(ava, "products", "POST", { name: `Suggestion product ${suffix}` });
    expect(productResponse.status).toBe(201);
    const product = await productResponse.json() as { id: string };
    productIds.push(product.id);
    const source = await createSourceTest(product.id, suffix);

    const generated = await request(ava, `test-cases/${source.id}/suggestions`, "POST");
    expect(generated.status).toBe(201);
    expect(await generated.json()).toMatchObject({ created: 5, existing: 0, sourceVersion: 1 });
    const repeated = await request(ava, `test-cases/${source.id}/suggestions`, "POST");
    expect(await repeated.json()).toMatchObject({ created: 0, existing: 5 });
    expect((await request(ben, `test-cases/${source.id}/suggestions`, "POST")).status).toBe(403);

    const list = await request(ava, `suggestions?testCaseId=${source.id}`);
    const suggestions = await list.json() as Array<{ id: string; kind: string; status: string; proposedValue: string }>;
    expect(suggestions).toHaveLength(5);
    expect(JSON.stringify(suggestions)).not.toContain("[REDACTED]");
    const emailSuggestion = suggestions.find((suggestion) => suggestion.kind === "INVALID_EMAIL")!;
    const requiredSuggestion = suggestions.find((suggestion) => suggestion.kind === "REQUIRED_MISSING")!;

    const unsafeEdit = await request(ava, `suggestions/${emailSuggestion.id}`, "PATCH", { proposedValue: "token=not-safe" });
    expect(unsafeEdit.status).toBe(400);
    const invalidRequired = await request(ava, `suggestions/${requiredSuggestion.id}`, "PATCH", { proposedValue: "not blank" });
    expect(invalidRequired.status).toBe(400);
    const edit = await request(ava, `suggestions/${emailSuggestion.id}`, "PATCH", { title: "Reject malformed customer email", rationale: "The Demo CRM must reject a malformed address.", proposedValue: "wrong-email" });
    expect(edit.status).toBe(200);

    const dismissed = await request(ava, `suggestions/${requiredSuggestion.id}/dismiss`, "POST");
    expect(dismissed.status).toBe(200);
    expect((await request(ava, `suggestions/${requiredSuggestion.id}/reopen`, "POST")).status).toBe(200);
    const approved = await request(ava, `suggestions/${emailSuggestion.id}/approve`, "POST");
    expect(approved.status).toBe(201);
    const approvedTestCase = (await approved.json() as { testCase: { id: string } }).testCase;
    expect(await prisma.run.count({ where: { testCaseId: approvedTestCase.id } })).toBe(0);
    const derived = await prisma.testCase.findUniqueOrThrow({ where: { id: approvedTestCase.id }, include: { owner: true, featureLabels: { include: { featureLabel: true } }, versions: { include: { steps: { orderBy: { order: "asc" } } } } } });
    expect(derived.owner.email).toBe("ava.tester@example.test");
    expect(derived.currentVersion).toBe(1);
    expect(derived.featureLabels.map((item) => item.featureLabel.name)).toEqual([`negative-${suffix}`]);
    expect(derived.versions[0].steps.find((step) => step.order === 2)?.value).toBe("wrong-email");
    expect((await prisma.testCaseVersion.findUniqueOrThrow({ where: { testCaseId_version: { testCaseId: source.id, version: 1 } }, include: { steps: true } })).steps.find((step) => step.order === 2)?.value).toBe("customer@example.test");
    expect(await prisma.auditEvent.count({ where: { action: "TEST_SUGGESTION_APPROVED", entityId: emailSuggestion.id } })).toBe(1);
    expect((await request(ben, `suggestions?testCaseId=${source.id}`)).status).toBe(403);
  });
});
