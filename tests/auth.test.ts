import { describe, expect, it } from "vitest";
import { readSession, signSession } from "../lib/auth";

describe("development sessions", () => {
  it("round-trips a named user through a signed session", () => {
    process.env.SESSION_SECRET = "test-secret";
    const user = { id: "user-1", email: "ava@example.test", displayName: "Ava" };
    expect(readSession(signSession(user))).toEqual(user);
  });

  it("rejects a modified session token", () => {
    process.env.SESSION_SECRET = "test-secret";
    expect(readSession(`${signSession({ id: "user-1", email: "ava@example.test", displayName: "Ava" })}x`)).toBeNull();
  });
});
