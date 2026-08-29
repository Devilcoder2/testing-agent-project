import { afterEach, describe, expect, it } from "vitest";
import { RecordingStatus, StepKind } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { decryptVariableValue, encryptVariableValue } from "../lib/variables";

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

async function createProduct(session: Session) {
  const response = await request(session, "products", "POST", { name: `Test Data tables ${Date.now()}` });
  expect(response.status).toBe(201);
  const product = await response.json() as { id: string; name: string };
  productIds.push(product.id);
  return product;
}

async function createVariableTestCase(productId: string) {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
  const recording = await prisma.recordingSession.create({ data: { productId, ownerId: owner.id, testName: `Table Run ${Date.now()}`, targetUrl: "http://demo-target", tokenHash: `table-run-${Date.now()}`, status: RecordingStatus.SAVED } });
  return prisma.testCase.create({
    data: {
      productId,
      ownerId: owner.id,
      recordingSessionId: recording.id,
      name: recording.testName,
      versions: {
        create: {
          version: 1,
          steps: { create: [
            { order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" } },
            { order: 2, kind: StepKind.TEXT_ENTRY, timestamp: new Date(), target: { tag: "input", name: "email" }, value: "[VARIABLE:customer_email]", variableName: "customer_email", isCheckpoint: true }
          ] },
          variables: { create: { name: "customer_email", staticValueEncrypted: encryptVariableValue("fallback@example.test") } }
        }
      }
    }
  });
}

async function cancelRun(session: Session, runId: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
    if (run.status === "PAUSED" || run.status === "COMPLETED") break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
  if (run.status !== "COMPLETED") expect([200, 202]).toContain((await request(session, `runs/${runId}/cancel`, "POST")).status);
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

describe("tabular Test Data API", () => {
  it("creates, masks, lists, and edits multiple rows without exposing stored values", async () => {
    const ava = await login("ava.tester@example.test");
    const ben = await login("ben.tester@example.test");
    const product = await createProduct(ava);
    const benUser = await prisma.user.findUniqueOrThrow({ where: { email: "ben.tester@example.test" } });
    await prisma.productMembership.create({ data: { productId: product.id, userId: benUser.id } });

    const createdResponse = await request(ava, `products/${product.id}/test-data`, "POST", {
      name: "Customer matrix",
      reusePolicy: "REUSABLE",
      fieldNames: ["customer_email", "region"],
      rows: [
        { values: { customer_email: "north@example.test", region: "north" } },
        { values: { customer_email: "south@example.test", region: "south" } }
      ]
    });
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json() as { id: string; rowCount: number; fieldNames: string[] };
    expect(created).toMatchObject({ rowCount: 2, fieldNames: ["customer_email", "region"] });
    expect(JSON.stringify(created)).not.toContain("north@example.test");

    const allResponse = await request(ava, "test-data");
    expect(allResponse.status).toBe(200);
    const all = await allResponse.json() as Array<{ id: string; product: { id: string } }>;
    expect(all).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.id, product: { id: product.id, name: product.name } })]));

    const detailResponse = await request(ava, `products/${product.id}/test-data/${created.id}`);
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json() as { rows: Array<{ id: string; maskedFields: string[] }> };
    expect(detail.rows).toHaveLength(2);
    expect(detail.rows[0]?.maskedFields).toEqual(["customer_email", "region"]);
    expect(JSON.stringify(detail)).not.toContain("north@example.test");

    const benDetail = await request(ben, `products/${product.id}/test-data/${created.id}`);
    expect(benDetail.status).toBe(200);
    expect(await benDetail.json()).toMatchObject({ canEdit: false });
    expect((await request(ben, `products/${product.id}/test-data/${created.id}`, "PATCH", { name: "Not allowed", fieldNames: ["customer_email"], rows: [{ id: detail.rows[0]?.id, values: { customer_email: null } }] })).status).toBe(404);

    const updatedResponse = await request(ava, `products/${product.id}/test-data/${created.id}`, "PATCH", {
      name: "Updated customer matrix",
      reusePolicy: "SINGLE_USE",
      fieldNames: ["customer_email", "region"],
      rows: [
        { id: detail.rows[0]?.id, values: { customer_email: null, region: "north-east" } },
        { id: detail.rows[1]?.id, values: { customer_email: "updated-south@example.test", region: null } }
      ]
    });
    expect(updatedResponse.status).toBe(200);
    expect(await updatedResponse.json()).toMatchObject({ name: "Updated customer matrix", reusePolicy: "SINGLE_USE", rowCount: 2 });
    const storedRows = await prisma.testDataRow.findMany({ where: { dataSetId: created.id }, orderBy: { order: "asc" } });
    expect(storedRows.map((row) => JSON.parse(decryptVariableValue(row.encryptedFields)))).toEqual([
      { customer_email: "north@example.test", region: "north-east" },
      { customer_email: "updated-south@example.test", region: "south" }
    ]);
  });

  it("queues one Auto Run per safe table row and binds each Run to its own row", async () => {
    const ava = await login("ava.tester@example.test");
    const product = await createProduct(ava);
    const testCase = await createVariableTestCase(product.id);
    const dataResponse = await request(ava, `products/${product.id}/test-data`, "POST", {
      name: "Batch customers",
      fieldNames: ["customer_email"],
      rows: [
        { values: { customer_email: "row-one@example.test" } },
        { values: { customer_email: "row-two@example.test" } }
      ]
    });
    const dataSet = await dataResponse.json() as { id: string };

    const started = await request(ava, `test-cases/${testCase.id}/auto-runs`, "POST", { useAllRows: true, bindings: { customer_email: { source: "POOL", dataSetId: dataSet.id } } });
    expect(started.status).toBe(201);
    const payload = await started.json() as { runs: Array<{ id: string }>; queueFailures: number };
    expect(payload).toMatchObject({ queueFailures: 0 });
    expect(payload.runs).toHaveLength(2);

    const bindings = await prisma.runVariableBinding.findMany({ where: { runId: { in: payload.runs.map((run) => run.id) } }, orderBy: { runId: "asc" } });
    expect(bindings).toHaveLength(2);
    expect(new Set(bindings.map((binding) => binding.dataSetRowId)).size).toBe(2);
    expect(new Set(bindings.map((binding) => decryptVariableValue(binding.valueEncrypted)))).toEqual(new Set(["row-one@example.test", "row-two@example.test"]));
    await Promise.all(payload.runs.map((run) => cancelRun(ava, run.id)));
  }, 35_000);
});
