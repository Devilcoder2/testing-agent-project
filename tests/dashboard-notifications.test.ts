import { RunFailureReason, RunOutcome } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { dailyRunTrend, deriveProductHealth, type CompletedRun, type SavedTestCase } from "../lib/dashboard";
import { isTransientDeliveryError, renderSafeNotificationEmail, safeFailureReason } from "../lib/notifications";

const now = new Date("2026-08-20T12:00:00.000Z");
const testCases: SavedTestCase[] = [
  { id: "test-a", productId: "product-a", createdAt: new Date("2026-08-10T00:00:00.000Z") },
  { id: "test-b", productId: "product-a", createdAt: new Date("2026-07-30T00:00:00.000Z") },
  { id: "test-old", productId: "product-a", createdAt: new Date("2026-07-01T00:00:00.000Z") }
];
const runs: CompletedRun[] = [
  { id: "run-pass", productId: "product-a", testCaseId: "test-a", completedAt: new Date("2026-08-01T08:00:00.000Z"), outcome: RunOutcome.PASSED, testCase: { id: "test-a", name: "Sign in", currentVersion: 2 }, testCaseVersion: { version: 2 } },
  { id: "run-fail", productId: "product-a", testCaseId: "test-a", completedAt: new Date("2026-08-02T08:00:00.000Z"), outcome: RunOutcome.FAILED, testCase: { id: "test-a", name: "Sign in", currentVersion: 2 }, testCaseVersion: { version: 2 } },
  { id: "run-interrupted", productId: "product-a", testCaseId: "test-b", completedAt: new Date("2026-08-03T08:00:00.000Z"), outcome: RunOutcome.INTERRUPTED, testCase: { id: "test-b", name: "Create customer", currentVersion: 1 }, testCaseVersion: { version: 1 } },
  { id: "run-prior-version", productId: "product-a", testCaseId: "test-b", completedAt: new Date("2026-08-04T08:00:00.000Z"), outcome: RunOutcome.FAILED, testCase: { id: "test-b", name: "Create customer", currentVersion: 2 }, testCaseVersion: { version: 1 } },
  { id: "run-before-window", productId: "product-a", testCaseId: "test-a", completedAt: new Date("2026-07-21T23:59:59.000Z"), outcome: RunOutcome.FAILED, testCase: { id: "test-a", name: "Sign in", currentVersion: 2 }, testCaseVersion: { version: 2 } }
];

describe("Phase 6 dashboard health definitions", () => {
  it("uses UTC 30-day boundaries, excludes interrupted Runs from pass rate, and finds only flaky current versions", () => {
    const health = deriveProductHealth("product-a", testCases, runs, now);
    expect(health.totalSavedTestCases).toBe(3);
    expect(health.completedRuns).toBe(4);
    expect(health.passRate).toBe(1 / 3);
    expect(health.failedRuns).toBe(2);
    expect(health.flakyTestCases).toEqual([{ id: "test-a", name: "Sign in" }]);
    expect(health.coverage).toEqual({ current: 2, previous: 1, change: 1 });
    expect(health.latestCompletedRun?.id).toBe("run-prior-version");
  });

  it("builds daily UTC pass/fail buckets without putting interrupted Runs on the trend", () => {
    const trend = dailyRunTrend("product-a", runs, now);
    expect(trend).toHaveLength(30);
    expect(trend.find((day) => day.date === "2026-08-01")).toMatchObject({ passed: 1, failed: 0 });
    expect(trend.find((day) => day.date === "2026-08-02")).toMatchObject({ passed: 0, failed: 1 });
    expect(trend.find((day) => day.date === "2026-08-03")).toMatchObject({ passed: 0, failed: 0 });
  });
});

describe("Phase 6 safe notification delivery", () => {
  it("renders a safe failure email without evidence, variables, or credentials", () => {
    const email = renderSafeNotificationEmail({
      type: "RUN_FAILED",
      createdAt: now,
      product: { name: "CRM" },
      run: { id: "run-1", outcome: RunOutcome.FAILED, failureReason: RunFailureReason.SELECTOR_AMBIGUOUS, testCase: { name: "Create customer" } },
      releaseRun: null
    });
    expect(email.subject).toContain("failed");
    expect(email.text).toContain("A required page element was ambiguous.");
    expect(email.text).toContain("http://localhost:3001/runs/run-1");
    expect(email.text).not.toContain("password");
    expect(email.text).not.toContain("token");
    expect(safeFailureReason(RunFailureReason.ACTION_FAILED)).toBe("A recorded browser action could not be completed.");
  });

  it("retries only known transient SMTP failures", () => {
    expect(isTransientDeliveryError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientDeliveryError({ code: "ESOCKET" })).toBe(true);
    expect(isTransientDeliveryError({ code: "EINVAL" })).toBe(false);
    expect(isTransientDeliveryError(new Error("mailbox rejected"))).toBe(false);
  });
});
