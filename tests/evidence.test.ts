import { describe, expect, it } from "vitest";
import { redactedBodySnippet, redactEvidenceValue, redactedStorageSnapshot } from "../lib/evidence";

describe("Phase 2 evidence redaction", () => {
  it("redacts sensitive object fields and bearer values", () => {
    const redacted = redactEvidenceValue({ password: "do-not-store", profile: { token: "abc", note: "safe" }, authorization: "Bearer example" });
    expect(redacted).toEqual({ password: "[REDACTED]", profile: { token: "[REDACTED]", note: "safe" }, authorization: "[REDACTED]" });
    expect(redactedBodySnippet("Authorization: Bearer secret-token")).toBe("Authorization: [REDACTED]");
  });

  it("redacts JSON body snippets and limits text bodies to four KiB", () => {
    expect(redactedBodySnippet('{"email":"qa@example.test","apiKey":"private"}')).toEqual({ email: "qa@example.test", apiKey: "[REDACTED]" });
    const snippet = redactedBodySnippet("x".repeat(5000));
    expect(typeof snippet).toBe("string");
    expect(Buffer.byteLength(snippet as string)).toBeLessThanOrEqual(4112);
    expect(snippet).toContain("[TRUNCATED]");
  });

  it("retains storage names and lengths but never storage values", () => {
    const storage = redactedStorageSnapshot({
      cookies: [{ name: "session", value: "cookie-value" }],
      localStorage: [{ key: "accessToken", value: "local-secret" }],
      sessionStorage: [{ key: "draft", value: "temporary-value" }]
    });
    expect(storage).toEqual({
      cookies: [{ key: "session", value: "[REDACTED]", valueLength: 12 }],
      localStorage: [{ key: "accessToken", value: "[REDACTED]", valueLength: 12 }],
      sessionStorage: [{ key: "draft", value: "[REDACTED]", valueLength: 15 }]
    });
    expect(JSON.stringify(storage)).not.toContain("cookie-value");
    expect(JSON.stringify(storage)).not.toContain("local-secret");
  });
});
