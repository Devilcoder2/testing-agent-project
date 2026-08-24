import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { branchIsAllowed, githubCommitUrl, githubIsConfigured, normalizeBranches, parseGitHubPushDelivery, validCommitSha, verifyGitHubSignature } from "../lib/github";
import { isAllowedSourcePath, isSensitiveSourceText, selectSourcePaths, sourceAnalysisExpiresAt, sourceAnalysisIsConfigured } from "../lib/source-analysis";

const githubEnvironment = ["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY", "GITHUB_WEBHOOK_SECRET", "GITHUB_APP_SLUG", "SENTINEL_PUBLIC_WEBHOOK_URL"] as const;
const sourceEnvironment = ["OPENAI_API_KEY", "OPENAI_MODEL"] as const;
const originalEnvironment = Object.fromEntries([...githubEnvironment, ...sourceEnvironment].map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of [...githubEnvironment, ...sourceEnvironment]) {
    const value = originalEnvironment[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
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
});
