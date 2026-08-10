import { StepKind } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canRetryAutoRun, initialReplayState, ReplayError, replayStep, type ReplayStep, unsupportedVariableStep } from "../lib/replay";

function step(overrides: Partial<ReplayStep> = {}): ReplayStep {
  return {
    id: "step-1",
    order: 1,
    kind: StepKind.CLICK,
    target: { testId: "save" },
    value: null,
    isRedacted: false,
    variableName: null,
    isCheckpoint: false,
    ...overrides
  };
}

function fakePage(count: number) {
  const calls: string[] = [];
  const locator = {
    count: async () => count,
    click: async () => { calls.push("click"); },
    fill: async (value: string) => { calls.push(`fill:${value}`); }
  };
  return {
    calls,
    getByTestId: () => locator,
    locator: () => locator,
    getByLabel: () => locator,
    getByRole: () => locator,
    goto: async (url: string) => { calls.push(`goto:${url}`); },
    waitForURL: async (url: string) => { calls.push(`wait:${url}`); }
  };
}

describe("Phase 3 replay safety", () => {
  it("executes only a uniquely matched exact selector", async () => {
    const page = fakePage(1);
    await replayStep(page as never, step(), initialReplayState());
    expect(page.calls).toEqual(["click"]);
  });

  it("fails safely when a selector is ambiguous", async () => {
    const page = fakePage(2);
    await expect(replayStep(page as never, step(), initialReplayState())).rejects.toMatchObject({ reason: "SELECTOR_AMBIGUOUS" });
    expect(page.calls).toEqual([]);
  });

  it("opens the approved target first and verifies later recorded navigation", async () => {
    const page = fakePage(1);
    const state = initialReplayState();
    const navigation = step({ kind: StepKind.NAVIGATION, target: { url: "http://demo-target/#dashboard" } });
    await replayStep(page as never, navigation, state, "http://demo-target");
    await replayStep(page as never, navigation, state);
    expect(page.calls).toEqual(["goto:http://demo-target", "wait:http://demo-target/#dashboard"]);
  });

  it("rejects only non-password variable steps before an Auto Run", () => {
    expect(unsupportedVariableStep([step({ variableName: "customerEmail" })])?.order).toBe(1);
    expect(unsupportedVariableStep([step({ variableName: "password", isRedacted: true })])).toBeUndefined();
  });

  it("retries only the first allowlisted technical failure", () => {
    expect(canRetryAutoRun(new ReplayError("BROWSER_STARTUP", "Browser unavailable", true), 1)).toBe(true);
    expect(canRetryAutoRun(new ReplayError("NAVIGATION_TIMEOUT", "Navigation timed out", true), 1)).toBe(true);
    expect(canRetryAutoRun(new ReplayError("SELECTOR_AMBIGUOUS", "Selector is ambiguous", true), 1)).toBe(false);
    expect(canRetryAutoRun(new ReplayError("ACTION_FAILED", "Action failed", true), 1)).toBe(false);
    expect(canRetryAutoRun(new ReplayError("NAVIGATION_TIMEOUT", "Navigation timed out", true), 2)).toBe(false);
  });
});
