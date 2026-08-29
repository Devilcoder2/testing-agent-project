import { afterEach, describe, expect, it } from "vitest";
import { ChangeProposalStatus, NotificationType, OrganizationRole, RecordingStatus, RunMode, RunOutcome, RunStatus, StepKind, TestDataReusePolicy, TestSuggestionKind } from "@prisma/client";
import { normalizeSearchQuery, orderedSearchSections } from "../lib/global-search";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";
const productIds: string[] = [];
const releaseIds: string[] = [];
const userIds: string[] = [];
type Session = { cookie: string };

async function login(email: string): Promise<Session> {
  const response = await fetch(`${baseUrl}/api/auth/dev-login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "sentinel-dev" }) });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Development login did not return a session cookie.");
  return { cookie };
}

async function request(session: Session | null, path: string) {
  return fetch(`${baseUrl}/api/${path}`, { headers: session ? { cookie: session.cookie } : undefined });
}

afterEach(async () => {
  if (releaseIds.length) await prisma.release.deleteMany({ where: { id: { in: releaseIds.splice(0) } } });
  for (const productId of productIds.splice(0)) await prisma.product.delete({ where: { id: productId } }).catch(() => undefined);
  for (const userId of userIds.splice(0)) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
});

describe("Phase 17 global authorized search", () => {
  it("normalizes input and places the current section first", () => {
    expect(normalizeSearchQuery("  Demo   customer  ")).toBe("Demo customer");
    expect(normalizeSearchQuery("x".repeat(100))).toHaveLength(80);
    expect(orderedSearchSections("runs").slice(0, 3)).toEqual(["runs", "products", "test-cases"]);
  });

  it("returns capped safe prefix results in current-section order without crossing access boundaries", async () => {
    const ava = await login("ava.tester@example.test");
    const ben = await login("ben.tester@example.test");
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
    const ownerMembership = await prisma.organizationMember.findFirstOrThrow({ where: { userId: owner.id } });
    expect(ownerMembership.role).toBe(OrganizationRole.ADMIN);
    const suffix = Date.now();
    const prefix = `Demo Search ${suffix}`;

    const products = [];
    for (let index = 0; index < 7; index += 1) {
      const product = await prisma.product.create({ data: { name: `${prefix} Product ${index}`, createdById: owner.id, organizationId: ownerMembership.organizationId, memberships: { create: { userId: owner.id } } } });
      productIds.push(product.id);
      products.push(product);
    }
    const product = products[0];
    const recording = await prisma.recordingSession.create({ data: { productId: product.id, ownerId: owner.id, testName: `${prefix} Test`, targetUrl: "http://demo-target", tokenHash: `global-search-${suffix}`, status: RecordingStatus.SAVED } });
    const testCase = await prisma.testCase.create({
      data: { productId: product.id, ownerId: owner.id, recordingSessionId: recording.id, name: `${prefix} Test`, versions: { create: { version: 1, steps: { create: { order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" } } } } } },
      include: { versions: { include: { steps: true } } }
    });
    const version = testCase.versions[0];
    const run = await prisma.run.create({ data: { testCaseId: testCase.id, testCaseVersionId: version.id, productId: product.id, initiatedById: owner.id, targetUrl: "http://demo-target", mode: RunMode.AUTO, status: RunStatus.COMPLETED, outcome: RunOutcome.PASSED, completedAt: new Date() } });
    await prisma.testDataSet.create({ data: { productId: product.id, ownerId: owner.id, name: `${prefix} Data`, fieldNames: ["customer_email"], reusePolicy: TestDataReusePolicy.REUSABLE, rows: { create: { order: 1, encryptedFields: "NEVER_RETURN_THIS_SEARCH_SECRET" } } } });
    const release = await prisma.release.create({ data: { name: `${prefix} Release`, ownerId: owner.id, tests: { create: { testCaseId: testCase.id } } } });
    releaseIds.push(release.id);
    await prisma.testSuggestion.create({ data: { productId: product.id, sourceTestCaseId: testCase.id, sourceVersionId: version.id, sourceStepId: version.steps[0].id, kind: TestSuggestionKind.REQUIRED_MISSING, title: `${prefix} Suggestion`, rationale: "Safe search fixture", expectedOutcome: "Validation is shown", proposedValue: "" } });
    const proposal = await prisma.changeProposal.create({ data: { runId: run.id, productId: product.id, testCaseId: testCase.id, sourceVersionId: version.id, createdById: owner.id, ownerId: owner.id, status: ChangeProposalStatus.DRAFT, context: "Safe search fixture" } });
    await prisma.notification.create({ data: { recipientId: owner.id, productId: product.id, runId: run.id, changeProposalId: proposal.id, type: NotificationType.CHANGE_PROPOSAL_REQUESTED } });
    const member = await prisma.user.create({ data: { email: `demo.search.${suffix}@example.test`, displayName: `${prefix} Member` } });
    userIds.push(member.id);
    await prisma.organizationMember.create({ data: { organizationId: ownerMembership.organizationId, userId: member.id, role: OrganizationRole.TESTER } });

    const response = await request(ava, `search?q=${encodeURIComponent(prefix)}&section=runs`);
    expect(response.status).toBe(200);
    const payload = await response.json() as { query: string; total: number; groups: Array<{ section: string; results: Array<{ title: string; context: string; href: string }> }> };
    expect(payload.query).toBe(prefix);
    expect(payload.groups[0].section).toBe("runs");
    expect(payload.groups.map((group) => group.section)).toEqual(expect.arrayContaining(["products", "test-cases", "test-data", "runs", "releases", "review", "notifications", "admin"]));
    expect(payload.groups.find((group) => group.section === "products")?.results).toHaveLength(5);
    expect(payload.groups.flatMap((group) => group.results).every((result) => result.title.toLowerCase().startsWith(prefix.toLowerCase()))).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("NEVER_RETURN_THIS_SEARCH_SECRET");
    expect(JSON.stringify(payload)).not.toContain("encryptedFields");

    const inaccessible = await request(ben, `search?q=${encodeURIComponent(prefix)}&section=products`);
    expect(inaccessible.status).toBe(200);
    expect(await inaccessible.json()).toMatchObject({ total: 0, groups: [] });
    expect((await request(null, `search?q=${encodeURIComponent(prefix)}`)).status).toBe(401);
    expect((await request(ava, "search?q=%20%20")).status).toBe(400);
    expect((await request(ava, `search?q=${"x".repeat(81)}`)).status).toBe(400);
  });
});
