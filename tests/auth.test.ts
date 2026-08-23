import { describe, expect, it } from "vitest";
import { tokenHash, validPassword } from "../lib/auth";

describe("account credential helpers", () => {
  it("requires a reasonably strong password for account setup", () => {
    expect(validPassword("short")).toBe(false);
    expect(validPassword("a-safe-local-password")).toBe(true);
  });

  it("creates a stable non-reversible token lookup hash", () => {
    expect(tokenHash("one-time-token")).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash("one-time-token")).toBe(tokenHash("one-time-token"));
    expect(tokenHash("one-time-token")).not.toBe("one-time-token");
  });
});
