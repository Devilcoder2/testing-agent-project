import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { GitHubDeliveryStatus, GitHubDeliveryTargetStatus, GitHubRepositoryConnectionStatus, RecordingStatus, RunMode, RunOutcome, RunStatus, SourceAnalysisConfidence, SourceAnalysisStatus, SourceAnalysisTrigger, StepKind } from "@prisma/client";
import { branchIsAllowed, githubCommitUrl, githubIsConfigured, normalizeBranches, parseGitHubPushDelivery, validCommitSha, verifyGitHubSignature } from "../lib/github";
import { processGitHubDelivery } from "../lib/github-runs";
import { prisma } from "../lib/prisma";
import { isAllowedSourcePath, isSensitiveSourceText, selectSourcePaths, sourceAnalysisExpiresAt, sourceAnalysisIsConfigured } from "../lib/source-analysis";

const githubEnvironment = ["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY", "GITHUB_WEBHOOK_SECRET", "GITHUB_APP_SLUG", "SENTINEL_PUBLIC_WEBHOOK_URL"] as const;
const sourceEnvironment = ["OPENAI_API_KEY", "OPENAI_MODEL"] as const;
const originalEnvironment = Object.fromEntries([...githubEnvironment, ...sourceEnvironment].map((name) => [name, process.env[name]]));
const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";
const createdProductIds: string[] = [];
const createdInstallationIds: string[] = [];
const createdDeliveryIds: string[] = [];

type Session = { cookie: string };

async function login(email: string): Promise<Session> {
  const response = await fetch(`${baseUrl}/api/auth/dev-login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "sentinel-dev" }) });
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Development login did not return a session cookie.");
  return { cookie };
}

async function request(session: Session, path: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}/api/${path}`, { method, headers: { cookie: session.cookie, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
}

afterEach(async () => {
  for (const name of [...githubEnvironment, ...sourceEnvironment]) {
    const value = originalEnvironment[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  if (createdDeliveryIds.length) await prisma.gitHubDelivery.deleteMany({ where: { id: { in: createdDeliveryIds.splice(0) } } });
  if (createdInstallationIds.length) await prisma.gitHubInstallation.deleteMany({ where: { id: { in: createdInstallationIds.splice(0) } } });
  for (const productId of createdProductIds.splice(0)) {
    await prisma.testCase.deleteMany({ where: { productId } });
    await prisma.recordingSession.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }
});

describe("Phase 13 GitHub routing and source-analysis boundaries", () => {
  it("accepts only literal allowlisted branches or the explicit all-branch wildcard", () => {
    expect(normalizeBranches([" main ", "release-2026", "main"])).toEqual(["main", "release-2026"]);
    expect(branchIsAllowed("main", ["main", "release-2026"])).toBe(true);
    expect(branchIsAllowed("feature/new-checkout", ["main", "release-2026"])).toBe(false);
    expect(branchIsAllowed("feature/new-checkout", ["*"])).toBe(true);
    expect(() => normalizeBranches(["release/*"])).toThrow("branch names are invalid");
  });

  it("verifies a signed push and pins routing to a full immutable commit", () => {
    Object.assign(process.env, {
      GITHUB_APP_ID: "1234",
      GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nlocal-test\\n-----END PRIVATE KEY-----",
      GITHUB_WEBHOOK_SECRET: "webhook-test-secret",
      GITHUB_APP_SLUG: "sentinel-local",
      SENTINEL_PUBLIC_WEBHOOK_URL: "https://example.test/api/internal/github/webhooks"
    });
    const after = "a".repeat(40);
    const before = "b".repeat(40);
    const body = JSON.stringify({ ref: "refs/heads/main", before, after, installation: { id: 42 }, repository: { id: 99, full_name: "acme/web-client" } });
    const signature = `sha256=${crypto.createHmac("sha256", "webhook-test-secret").update(body).digest("hex")}`;

    expect(githubIsConfigured()).toBe(true);
    expect(verifyGitHubSignature(body, signature)).toBe(true);
    expect(verifyGitHubSignature(body, `${signature}0`)).toBe(false);
    expect(parseGitHubPushDelivery(body, "delivery-42", "push")).toMatchObject({ deliveryId: "delivery-42", repositoryFullName: "acme/web-client", branch: "main", beforeSha: before, afterSha: after });
    expect(validCommitSha(after)).toBe(true);
    expect(validCommitSha("main")).toBe(false);
    expect(githubCommitUrl("acme/web-client", after)).toBe(`https://github.com/acme/web-client/commit/${after}`);
    expect(() => parseGitHubPushDelivery(body, "delivery-42", "pull_request")).toThrow("Only GitHub push deliveries");
  });

  it("selects only bounded safe source paths and blocks secret-like context", () => {
    expect(isAllowedSourcePath("src/customer-form.tsx")).toBe(true);
    expect(isAllowedSourcePath("config/app.yaml")).toBe(true);
    expect(isAllowedSourcePath(".env.production")).toBe(false);
    expect(isAllowedSourcePath("node_modules/package/index.js")).toBe(false);
    expect(isAllowedSourcePath("../outside.ts")).toBe(false);
    expect(isAllowedSourcePath("package-lock.json")).toBe(false);
    expect(selectSourcePaths(["src/a.ts", "src/a.ts", ".env", "build/output.js", "docs/runbook.md"])).toEqual(["src/a.ts", "docs/runbook.md"]);
    expect(isSensitiveSourceText("api_key=abcdefghijklmnopqrstuvwxyz")).toBe(true);
    expect(isSensitiveSourceText("-----BEGIN PRIVATE KEY-----")).toBe(true);
    expect(isSensitiveSourceText("const apiKey = process.env.API_KEY;")).toBe(false);
  });

  it("uses an explicit provider configuration and retains only safe diagnosis metadata for thirty days", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    expect(sourceAnalysisIsConfigured()).toBe(false);
    process.env.OPENAI_API_KEY = "local-test-key";
    process.env.OPENAI_MODEL = "gpt-5";
    expect(sourceAnalysisIsConfigured()).toBe(true);
    const start = new Date("2026-08-24T00:00:00.000Z");
    expect(sourceAnalysisExpiresAt(start).toISOString()).toBe("2026-09-23T00:00:00.000Z");
  });

  it("routes only explicitly linked Tests, records safe exclusions, and keeps Run diagnosis access product-authorized", async () => {
    const ava = await login("ava.tester@example.test");
    const ben = await login("ben.tester@example.test");
    const suffix = Date.now();
    const productResponse = await request(ava, "products", "POST", { name: `Phase 13 routing ${suffix}` });
    expect(productResponse.status).toBe(201);
    const product = await productResponse.json() as { id: string };
    createdProductIds.push(product.id);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
    const storedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    const recording = await prisma.recordingSession.create({ data: { productId: product.id, ownerId: owner.id, testName: "Phase 13 routing", targetUrl: "http://demo-target", tokenHash: `phase13-${suffix}`, status: RecordingStatus.SAVED } });
    const testCase = await prisma.testCase.create({ data: { productId: product.id, ownerId: owner.id, recordingSessionId: recording.id, name: "Phase 13 linked checkpoint", versions: { create: { version: 1, steps: { create: [{ order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" }, isCheckpoint: true }] } } } }, include: { versions: true } });
    const installation = await prisma.gitHubInstallation.create({ data: { organizationId: storedProduct.organizationId!, installationId: String(suffix), accountLogin: "phase13-sandbox", status: "ACTIVE" } });
    createdInstallationIds.push(installation.id);
    const connection = await prisma.productRepositoryConnection.create({ data: { productId: product.id, installationId: installation.id, repositoryId: `phase13-repository-${suffix}`, repositoryFullName: "sentinel-sandbox/frontend", label: "Frontend", defaultBranch: "main", branchAllowlist: ["main"], status: GitHubRepositoryConnectionStatus.ACTIVE, analysisEnabled: true } });

    const beforeLink = await request(ava, `test-cases/${testCase.id}/github`);
    expect(beforeLink.status).toBe(200);
    expect(await beforeLink.json()).toMatchObject({ canEdit: true, connections: [expect.objectContaining({ id: connection.id, linked: false })] });
    expect((await request(ben, `test-cases/${testCase.id}/github`)).status).toBe(403);
    expect((await request(ava, `test-cases/${testCase.id}/github`, "PATCH", { connectionIds: [connection.id] })).status).toBe(200);
    const afterLink = await request(ava, `test-cases/${testCase.id}/github`);
    expect(await afterLink.json()).toMatchObject({ connections: [expect.objectContaining({ id: connection.id, linked: true })] });

    const failedRun = await prisma.run.create({ data: { productId: product.id, testCaseId: testCase.id, testCaseVersionId: testCase.versions[0].id, initiatedById: owner.id, targetUrl: "http://demo-target", mode: RunMode.AUTO, status: RunStatus.COMPLETED, outcome: RunOutcome.FAILED, completedAt: new Date() } });
    const fullSha = "c".repeat(40);
    await prisma.sourceAnalysis.create({ data: { runId: failedRun.id, connectionId: connection.id, requestedById: owner.id, trigger: SourceAnalysisTrigger.MANUAL_REQUEST, commitSha: fullSha, status: SourceAnalysisStatus.COMPLETED, confidence: SourceAnalysisConfidence.LOW, observations: ["The Run reached the saved navigation checkpoint."], hypotheses: ["The client validation may differ at this commit."], likelyCause: "A validation-path change is plausible but not proven.", remediation: "Review the cited validation code before changing the Test.", sourceReferences: [{ path: "src/validation.ts", startLine: 8, endLine: 16, rationale: "Contains the relevant validation branch." }], limitations: "No raw source is retained.", expiresAt: sourceAnalysisExpiresAt() } });
    expect((await request(ben, `runs/${failedRun.id}`)).status).toBe(403);
    expect((await request(ava, `runs/${failedRun.id}/source-analysis`, "POST", { connectionId: connection.id, commitSha: "main" })).status).toBe(400);
    const detail = await request(ava, `runs/${failedRun.id}`);
    expect(detail.status).toBe(200);
    const detailBody = await detail.json() as { sourceAnalyses: Array<{ commitSha: string; sourceReferences: unknown[]; suggestedPatch?: string | null }> };
    expect(detailBody.sourceAnalyses[0]).toMatchObject({ commitSha: fullSha, sourceReferences: [expect.objectContaining({ path: "src/validation.ts", startLine: 8, endLine: 16 })] });
    expect(JSON.stringify(detailBody.sourceAnalyses[0])).not.toContain("checkout");

    const blockedDelivery = await prisma.gitHubDelivery.create({ data: { deliveryId: `phase13-blocked-${suffix}`, event: "push", installationNumber: installation.installationId, repositoryId: connection.repositoryId, repositoryFullName: connection.repositoryFullName, ref: "refs/heads/feature/new", branch: "feature/new", beforeSha: "a".repeat(40), afterSha: "b".repeat(40), status: GitHubDeliveryStatus.RECEIVED } });
    const checkpointDelivery = await prisma.gitHubDelivery.create({ data: { deliveryId: `phase13-checkpoint-${suffix}`, event: "push", installationNumber: installation.installationId, repositoryId: connection.repositoryId, repositoryFullName: connection.repositoryFullName, ref: "refs/heads/main", branch: "main", beforeSha: "a".repeat(40), afterSha: "b".repeat(40), status: GitHubDeliveryStatus.RECEIVED } });
    createdDeliveryIds.push(blockedDelivery.id, checkpointDelivery.id);
    await processGitHubDelivery(blockedDelivery.id);
    await processGitHubDelivery(checkpointDelivery.id);
    await processGitHubDelivery(checkpointDelivery.id);
    const [blockedTarget, checkpointTarget] = await Promise.all([
      prisma.gitHubDeliveryTarget.findUniqueOrThrow({ where: { deliveryId_connectionId: { deliveryId: blockedDelivery.id, connectionId: connection.id } } }),
      prisma.gitHubDeliveryTarget.findUniqueOrThrow({ where: { deliveryId_connectionId: { deliveryId: checkpointDelivery.id, connectionId: connection.id } } })
    ]);
    expect(blockedTarget).toMatchObject({ status: GitHubDeliveryTargetStatus.IGNORED, decisionReason: "BRANCH_NOT_ALLOWLISTED" });
    expect(checkpointTarget.status).toBe(GitHubDeliveryTargetStatus.PROCESSED);
    expect(checkpointTarget.queuedRunCount).toBe(0);
    expect(checkpointTarget.excludedTests).toEqual([expect.objectContaining({ testCaseId: testCase.id, reason: "CHECKPOINT_REQUIRES_INDIVIDUAL_RUN" })]);
    expect(await prisma.gitHubDeliveryTarget.count({ where: { deliveryId: checkpointDelivery.id, connectionId: connection.id } })).toBe(1);
    expect(await prisma.gitHubRunLink.count({ where: { deliveryTargetId: checkpointTarget.id } })).toBe(0);
  }, 30_000);
});
