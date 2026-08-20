import { afterEach, describe, expect, it } from "vitest";
import { RecordingStatus, RunOutcome, RunStatus, StepKind } from "@prisma/client";
import { customerEmailForDiagnostic, customerLookupByEmail, verifyQaReadOnlyAccess } from "../lib/database-diagnostics";
import { encryptVariableValue } from "../lib/variables";
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

afterEach(async () => {
  for (const productId of productIds.splice(0)) {
    await prisma.testCase.deleteMany({ where: { productId } });
    await prisma.recordingSession.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
  }
});

describe("Phase 10 database diagnostics", () => {
  it("uses the final non-secret email field and resolves a bound variable without returning it", () => {
    const email = customerEmailForDiagnostic([
      { kind: "TEXT_ENTRY", target: { inputType: "email" }, value: "login@example.test", isRedacted: false, variableName: null },
      { kind: "TEXT_ENTRY", target: { inputType: "password" }, value: "[REDACTED]", isRedacted: true, variableName: null },
      { kind: "TEXT_ENTRY", target: { inputType: "email" }, value: "{{customer_email}}", isRedacted: false, variableName: "customer_email" }
    ], [{ name: "customer_email", valueEncrypted: encryptVariableValue("customer.lookup@example.test") }]);

    expect(email).toBe("customer.lookup@example.test");
    expect(customerEmailForDiagnostic([{ kind: "TEXT_ENTRY", target: { inputType: "email" }, value: "[REDACTED]", isRedacted: true, variableName: null }], [])).toBeNull();
  });

  it("queries the isolated fixture with the read-only role and returns only safe customer metadata", async () => {
    const fixture = await fetch("http://qa-fixture:8081/customers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "phase10.diagnostic@example.test", firstName: "Phase", lastName: "Ten" })
    });
    expect(fixture.status).toBe(201);

    await expect(verifyQaReadOnlyAccess()).resolves.toEqual({ ok: true, errorCode: "QA_DATABASE_ACCESS_DENIED" });
    const result = await customerLookupByEmail("phase10.diagnostic@example.test");
    expect(result).toMatchObject({ status: "COMPLETE", safeMetadata: { result: "FOUND", customerStatus: "ACTIVE" } });
    expect(JSON.stringify(result)).not.toContain("phase10.diagnostic@example.test");
    await expect(customerLookupByEmail("missing.phase10@example.test")).resolves.toEqual({ status: "COMPLETE", safeMetadata: { result: "NOT_FOUND" } });
  });

  it("persists authorized failed-Run diagnostic evidence without serializing the lookup value", async () => {
    const ava = await login("ava.tester@example.test");
    const ben = await login("ben.tester@example.test");
    const suffix = Date.now();
    const customerEmail = `phase10.run.${suffix}@example.test`;
    await fetch("http://qa-fixture:8081/customers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: customerEmail, firstName: "Phase", lastName: "Ten" }) });
    const productResponse = await request(ava, "products", "POST", { name: `Phase 10 diagnostic ${suffix}` });
    expect(productResponse.status).toBe(201);
    const product = await productResponse.json() as { id: string };
    productIds.push(product.id);
    const avaUser = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
    const recording = await prisma.recordingSession.create({ data: { productId: product.id, ownerId: avaUser.id, testName: "Database diagnostic", targetUrl: "http://demo-target", tokenHash: `diagnostic-${suffix}`, status: RecordingStatus.SAVED } });
    const testCase = await prisma.testCase.create({ data: { productId: product.id, ownerId: avaUser.id, recordingSessionId: recording.id, name: "Database diagnostic", versions: { create: { version: 1, steps: { create: [{ order: 1, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", inputType: "email" }, value: customerEmail }] } } } }, include: { versions: true } });
    const run = await prisma.run.create({ data: { productId: product.id, testCaseId: testCase.id, testCaseVersionId: testCase.versions[0].id, initiatedById: avaUser.id, targetUrl: "http://demo-target", status: RunStatus.COMPLETED, outcome: RunOutcome.FAILED, completedAt: new Date() } });

    expect((await request(ben, `runs/${run.id}/diagnostics/customer-lookup`, "POST")).status).toBe(403);
    const diagnosed = await request(ava, `runs/${run.id}/diagnostics/customer-lookup`, "POST");
    expect(diagnosed.status).toBe(201);
    expect(JSON.stringify(await diagnosed.json())).not.toContain(customerEmail);
    expect((await request(ava, `runs/${run.id}/diagnostics/customer-lookup`, "POST")).status).toBe(200);
    const detail = await request(ava, `runs/${run.id}`);
    expect(detail.status).toBe(200);
    const serialized = JSON.stringify(await detail.json());
    expect(serialized).toContain("DATABASE");
    expect(serialized).toContain("FOUND");
    expect(serialized).not.toContain(customerEmail);
  });
});
