export type SuggestionKind = "REQUIRED_MISSING" | "INVALID_EMAIL" | "BOUNDARY_TOO_SHORT" | "BOUNDARY_TOO_LONG";

export type SuggestionTarget = {
  tag?: unknown;
  name?: unknown;
  inputType?: unknown;
  required?: unknown;
  minLength?: unknown;
  maxLength?: unknown;
};

export type SuggestionSourceStep = {
  id: string;
  order: number;
  kind: string;
  target: unknown;
  value: string | null;
  isRedacted: boolean;
  variableName: string | null;
};

export type SuggestionCandidate = {
  sourceStepId: string;
  kind: SuggestionKind;
  title: string;
  rationale: string;
  expectedOutcome: string;
  proposedValue: string;
};

export type SuggestionSkip = {
  sourceStepId: string;
  order: number;
  reason: string;
};

const outcome = "Validation state appears and the success confirmation or navigation does not occur.";

function targetFor(value: unknown): SuggestionTarget {
  return value && typeof value === "object" && !Array.isArray(value) ? value as SuggestionTarget : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function label(target: SuggestionTarget, order: number) {
  return text(target.name) || `field in step ${order}`;
}

function alpha(length: number) {
  return "A".repeat(length);
}

export function suggestionsForStep(step: SuggestionSourceStep): { candidates: SuggestionCandidate[]; skipped?: SuggestionSkip } {
  if (step.kind !== "TEXT_ENTRY") {
    return { candidates: [], skipped: { sourceStepId: step.id, order: step.order, reason: "Only text-entry steps can receive negative-Test suggestions." } };
  }
  if (step.isRedacted) {
    return { candidates: [], skipped: { sourceStepId: step.id, order: step.order, reason: "Redacted password or secret fields are never suggested." } };
  }
  if (step.variableName) {
    return { candidates: [], skipped: { sourceStepId: step.id, order: step.order, reason: "Variable-backed fields are configured at Run time and are not suggested." } };
  }
  const target = targetFor(step.target);
  const inputType = text(target.inputType).toLowerCase();
  const tag = text(target.tag).toLowerCase();
  if (tag !== "input" && tag !== "textarea") {
    return { candidates: [], skipped: { sourceStepId: step.id, order: step.order, reason: "This control has no supported text-field validation metadata." } };
  }
  if (inputType === "password" || /password|token|secret|cookie|authorization|api[_-]?key/i.test(text(target.name))) {
    return { candidates: [], skipped: { sourceStepId: step.id, order: step.order, reason: "Secret-like fields are never suggested." } };
  }

  const field = label(target, step.order);
  const candidates: SuggestionCandidate[] = [];
  if (target.required === true) {
    candidates.push({
      sourceStepId: step.id,
      kind: "REQUIRED_MISSING",
      title: `Reject missing ${field}`,
      rationale: `${field} is required, so submitting it blank should be rejected.`,
      expectedOutcome: outcome,
      proposedValue: ""
    });
  }
  if (inputType === "email") {
    candidates.push({
      sourceStepId: step.id,
      kind: "INVALID_EMAIL",
      title: `Reject invalid ${field}`,
      rationale: `${field} is an email field, so a malformed address should be rejected.`,
      expectedOutcome: outcome,
      proposedValue: "not-an-email"
    });
  }
  const minLength = number(target.minLength);
  const maxLength = number(target.maxLength);
  if (minLength !== null && minLength > 1) {
    candidates.push({
      sourceStepId: step.id,
      kind: "BOUNDARY_TOO_SHORT",
      title: `Reject ${field} below its minimum length`,
      rationale: `${field} requires at least ${minLength} characters, so ${minLength - 1} characters should be rejected.`,
      expectedOutcome: outcome,
      proposedValue: alpha(minLength - 1)
    });
  }
  if (maxLength !== null) {
    candidates.push({
      sourceStepId: step.id,
      kind: "BOUNDARY_TOO_LONG",
      title: `Reject ${field} above its maximum length`,
      rationale: `${field} allows at most ${maxLength} characters, so ${maxLength + 1} characters should be rejected.`,
      expectedOutcome: outcome,
      proposedValue: alpha(maxLength + 1)
    });
  }
  if (!candidates.length) {
    return { candidates, skipped: { sourceStepId: step.id, order: step.order, reason: "No supported required, email, or length validation metadata was captured for this field." } };
  }
  return { candidates };
}

export function suggestionsForSteps(steps: SuggestionSourceStep[]) {
  const candidates: SuggestionCandidate[] = [];
  const skipped: SuggestionSkip[] = [];
  for (const step of steps) {
    const result = suggestionsForStep(step);
    candidates.push(...result.candidates);
    if (result.skipped) skipped.push(result.skipped);
  }
  return { candidates, skipped };
}

export function proposedValueIsSafe(kind: SuggestionKind, value: unknown) {
  if (typeof value !== "string" || value.length > 256) return false;
  return kind === "REQUIRED_MISSING" ? value === "" : Boolean(value.trim());
}
