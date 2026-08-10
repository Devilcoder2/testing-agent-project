import { RunFailureReason, StepKind } from "@prisma/client";
import type { Locator, Page } from "playwright";

const ACTION_TIMEOUT_MS = 10_000;

export type ReplayStep = {
  id: string;
  order: number;
  kind: StepKind;
  target: unknown;
  value: string | null;
  isRedacted: boolean;
  variableName: string | null;
  isCheckpoint: boolean;
};

type Target = {
  tag?: string;
  name?: string;
  text?: string;
  testId?: string;
  url?: string;
};

export class ReplayError extends Error {
  constructor(public readonly reason: RunFailureReason, message: string, public readonly transient = false) {
    super(message);
  }
}

const retryableReasons = new Set<RunFailureReason>([
  "BROWSER_STARTUP",
  "NAVIGATION_TIMEOUT"
]);

export function canRetryAutoRun(error: ReplayError, attemptNumber: number) {
  return attemptNumber === 1 && error.transient && retryableReasons.has(error.reason);
}

function targetOf(value: unknown): Target {
  return value && typeof value === "object" ? value as Target : {};
}

function exactText(value: string) {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
}

function attributeSelector(attribute: string, value: string) {
  return `[${attribute}=${JSON.stringify(value)}]`;
}

function roleForTag(tag?: string) {
  if (tag === "button") return "button" as const;
  if (tag === "a") return "link" as const;
  if (tag === "input" || tag === "textarea") return "textbox" as const;
  if (tag === "select") return "combobox" as const;
  return undefined;
}

export function unsupportedVariableStep(steps: ReplayStep[]) {
  return steps.find((step) => Boolean(step.variableName) && !step.isRedacted);
}

async function resolveUnique(page: Page, step: ReplayStep): Promise<Locator> {
  const target = targetOf(step.target);
  const candidates: Array<{ label: string; locator: Locator }> = [];
  const testId = target.testId?.trim();
  const name = target.name?.trim();
  const text = target.text?.trim();
  const tag = target.tag?.trim();

  if (testId) candidates.push({ label: "data-testid", locator: page.getByTestId(testId) });
  if (name) {
    candidates.push({ label: "field name", locator: page.locator(attributeSelector("name", name)) });
    candidates.push({ label: "field label", locator: page.getByLabel(exactText(name)) });
  }
  const role = roleForTag(tag);
  if (role && (text || name)) candidates.push({ label: "accessible role and name", locator: page.getByRole(role, { name: exactText(text || name || ""), exact: true }) });
  if (tag && text && text !== "[REDACTED]") candidates.push({ label: "tag and text", locator: page.locator(tag).filter({ hasText: exactText(text) }) });

  for (const candidate of candidates) {
    const count = await candidate.locator.count();
    if (count === 1) return candidate.locator;
    if (count > 1) throw new ReplayError("SELECTOR_AMBIGUOUS", `Step ${step.order} has more than one ${candidate.label} match.`);
  }
  throw new ReplayError("SELECTOR_NOT_FOUND", `Step ${step.order} has no exact recorded selector match.`);
}

export type ReplayState = {
  initialNavigationComplete: boolean;
  loginEmailUsed: boolean;
};

export function initialReplayState(): ReplayState {
  return { initialNavigationComplete: false, loginEmailUsed: false };
}

function configuredCredential(name: "AUTO_RUN_DEMO_EMAIL" | "AUTO_RUN_DEMO_PASSWORD") {
  const value = process.env[name];
  if (!value) throw new ReplayError("INFRASTRUCTURE_ERROR", `The worker is missing ${name}.`);
  return value;
}

function valueForStep(step: ReplayStep, state: ReplayState) {
  const target = targetOf(step.target);
  const fieldName = target.name?.toLowerCase() ?? "";
  if (step.isRedacted || fieldName.includes("password")) return configuredCredential("AUTO_RUN_DEMO_PASSWORD");
  if (!state.loginEmailUsed && fieldName === "email") {
    state.loginEmailUsed = true;
    return configuredCredential("AUTO_RUN_DEMO_EMAIL");
  }
  if (step.value === null) throw new ReplayError("ACTION_FAILED", `Step ${step.order} has no recorded text value.`);
  return step.value;
}

function navigationUrl(step: ReplayStep) {
  const url = targetOf(step.target).url;
  if (!url || typeof url !== "string") throw new ReplayError("NAVIGATION_TIMEOUT", `Step ${step.order} has no recorded navigation URL.`);
  return url;
}

export async function replayStep(page: Page, step: ReplayStep, state: ReplayState, approvedInitialUrl?: string) {
  try {
    if (step.kind === StepKind.NAVIGATION) {
      const url = navigationUrl(step);
      if (!state.initialNavigationComplete) {
        // The Run target comes from an allowlisted recording. Recorded navigation
        // data is useful evidence, but must never choose the first destination.
        await page.goto(approvedInitialUrl ?? url, { waitUntil: "domcontentloaded", timeout: ACTION_TIMEOUT_MS });
        state.initialNavigationComplete = true;
      } else {
        await page.waitForURL(url, { waitUntil: "domcontentloaded", timeout: ACTION_TIMEOUT_MS });
      }
      return;
    }

    const locator = await resolveUnique(page, step);
    if (step.kind === StepKind.CLICK) {
      await locator.click({ timeout: ACTION_TIMEOUT_MS });
      return;
    }
    if (step.kind === StepKind.TEXT_ENTRY) {
      await locator.fill(valueForStep(step, state), { timeout: ACTION_TIMEOUT_MS });
      return;
    }
    throw new ReplayError("ACTION_FAILED", `Step ${step.order} has an unsupported action type.`);
  } catch (error) {
    if (error instanceof ReplayError) throw error;
    const message = error instanceof Error ? error.message : "Unknown browser action failure.";
    const timedOut = /timeout|navigation/i.test(message);
    throw new ReplayError(timedOut ? "NAVIGATION_TIMEOUT" : "ACTION_FAILED", `Step ${step.order} could not be replayed.`, timedOut);
  }
}
