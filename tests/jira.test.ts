import { describe, expect, it, vi } from "vitest";
import { buildJiraDraft, isAllowedJiraPriority, normalizeJiraProjectKey, validateJiraProject } from "../lib/jira";

describe("Phase 8 Jira safety", () => {
  it("creates safe reproduction text without recorded values or evidence artifacts", () => {
    const draft = buildJiraDraft({
      id: "run-safe",
      failureReason: "ACTION_FAILED",
      product: { name: "CRM" },
      testCase: { name: "Create customer" },
      testCaseVersion: { version: 3, steps: [{ order: 1, kind: "NAVIGATION" }, { order: 2, kind: "TEXT_ENTRY" }] }
    });
    expect(draft.summary).toContain("Create customer");
    expect(draft.description).toContain("Complete the recorded text entry action.");
    expect(draft.description).toContain("protected Sentinel Run Detail");
    expect(draft.description).not.toContain("qa.tester@example.test");
    expect(draft.description).not.toContain("[REDACTED]");
  });

  it("validates project keys, priority choices, and the configured Jira project", async () => {
    expect(normalizeJiraProjectKey(" crm_qa ")).toBe("CRM_QA");
    expect(() => normalizeJiraProjectKey("bad key")).toThrow("Jira project key");
    expect(isAllowedJiraPriority("High")).toBe(true);
    expect(isAllowedJiraPriority("Urgent")).toBe(false);
    const original = global.fetch;
    const previous = { url: process.env.JIRA_CLOUD_URL, email: process.env.JIRA_SERVICE_EMAIL, token: process.env.JIRA_API_TOKEN };
    process.env.JIRA_CLOUD_URL = "https://sentinel-test.atlassian.net";
    process.env.JIRA_SERVICE_EMAIL = "bot@example.test";
    process.env.JIRA_API_TOKEN = "safe-test-token";
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ key: "CRM" }), { status: 200 })) as typeof fetch;
    try {
      await expect(validateJiraProject("crm")).resolves.toBe("CRM");
      expect(global.fetch).toHaveBeenCalledWith("https://sentinel-test.atlassian.net/rest/api/3/project/CRM", expect.objectContaining({ headers: expect.objectContaining({ authorization: expect.stringContaining("Basic ") }) }));
    } finally {
      global.fetch = original;
      process.env.JIRA_CLOUD_URL = previous.url;
      process.env.JIRA_SERVICE_EMAIL = previous.email;
      process.env.JIRA_API_TOKEN = previous.token;
    }
  });
});
