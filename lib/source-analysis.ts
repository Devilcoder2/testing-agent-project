import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import OpenAI from "openai";
import { Prisma, SourceAnalysisConfidence, SourceAnalysisStatus } from "@prisma/client";
import { githubError, installationAccessToken, validCommitSha } from "./github";
import { prisma } from "./prisma";

const execFile = promisify(execFileCallback);
const CONTEXT_MAX_FILES = 40;
const CONTEXT_MAX_FILE_BYTES = 80 * 1024;
const CONTEXT_MAX_BYTES = 1024 * 1024;
const CONTEXT_MAX_TOKENS = 120_000;
const ANALYSIS_RETENTION_DAYS = 30;
const COMMAND_TIMEOUT_MS = 60_000;
const MAX_ANALYSIS_TEXT = 4_000;
const MAX_PATCH_TEXT = 12_000;

const blockedPath = /(^|\/)(?:\.env(?:\..*)?|credentials?|secrets?|keys?|certificates?|certs?|node_modules|vendor|dist|build|coverage|\.next|\.git)(?:\/|$)|(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i;
const sourceExtension = /\.(?:[cm]?[jt]sx?|json|ya?ml|py|java|go|rb|php|cs|rs|sql|css|html?|md)$/i;
const privateKeyPattern = /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/i;
const credentialPattern = /(?:\b(?:api[-_ ]?key|access[-_ ]?token|auth(?:orization)?|client[-_ ]?secret|password|cookie)\b\s*[:=]\s*["'`]?(?!process\.env\b|env\.|\$\{|<|\[|REDACTED)(?:[A-Za-z0-9_\-/+=]{12,}))/i;
const awsKeyPattern = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/;

type SourceReference = { path: string; startLine: number; endLine: number; rationale: string };
type AnalysisPayload = {
  observations: string[];
  hypotheses: string[];
  likelyCause: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  remediation: string | null;
  suggestedPatch: string | null;
  sourceReferences: SourceReference[];
  limitations: string[];
};

export class SourceAnalysisError extends Error {
  constructor(public readonly code: string, message: string, public readonly transient = false) {
    super(message);
  }
}

export function sourceAnalysisExpiresAt(now = new Date()) {
  return new Date(now.getTime() + ANALYSIS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function sourceAnalysisIsConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_MODEL?.trim());
}

export function isSensitiveSourceText(value: string) {
  return privateKeyPattern.test(value) || awsKeyPattern.test(value) || credentialPattern.test(value);
}

export function isAllowedSourcePath(value: string) {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");
  return Boolean(normalized) && !normalized.includes("..") && !blockedPath.test(normalized) && sourceExtension.test(normalized);
}

export function selectSourcePaths(paths: string[]) {
  const selected: string[] = [];
  for (const value of paths) {
    const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");
    if (isAllowedSourcePath(normalized) && !selected.includes(normalized)) selected.push(normalized);
    if (selected.length === CONTEXT_MAX_FILES) break;
  }
  return selected;
}

function safeString(value: unknown, maximum = MAX_ANALYSIS_TEXT) {
  const text = typeof value === "string" ? value.trim().split(String.fromCharCode(0)).join("") : "";
  if (!text) return "";
  if (isSensitiveSourceText(text)) throw new SourceAnalysisError("ANALYSIS_SENSITIVE_OUTPUT", "The generated diagnosis contained sensitive-looking text.");
  return text.slice(0, maximum);
}

function safeNarrative(value: unknown, maximum = 500) {
  try {
    return safeString(value, maximum);
  } catch {
    return "[REDACTED]";
  }
}

function safeJson(value: unknown, maximum = 1_200) {
  try {
    return safeNarrative(JSON.stringify(value), maximum);
  } catch {
    return "";
  }
}

function targetSummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Recorded target";
  const target = value as Record<string, unknown>;
  return ["tag", "role", "name", "text", "url"].flatMap((key) => typeof target[key] === "string" ? [`${key}: ${safeNarrative(target[key], 180)}`] : []).join(" · ") || "Recorded target";
}

async function runCommand(command: string, args: string[], cwd: string, env?: Record<string, string | undefined>) {
  try {
    return await execFile(command, args, { cwd, env: { ...process.env, ...env }, timeout: COMMAND_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
  } catch (error) {
    const timedOut = typeof error === "object" && error && "killed" in error && Boolean((error as { killed?: unknown }).killed);
    throw new SourceAnalysisError("ANALYSIS_WORKSPACE_FAILED", timedOut ? "The bounded source-analysis workspace timed out." : "Sentinel could not prepare the selected source checkout.", true);
  }
}

async function checkoutCommit(input: { temporaryDirectory: string; repositoryFullName: string; installationId: string; commitSha: string; parentSha: string | null }) {
  const checkout = path.join(input.temporaryDirectory, "repository");
  const token = await installationAccessToken(input.installationId).catch((error) => {
    const github = githubError(error, "GITHUB_CHECKOUT_AUTH_FAILED", "Sentinel could not obtain temporary GitHub repository access.");
    throw new SourceAnalysisError(github.code, github.message, github.transient);
  });
  const authorization = Buffer.from(`x-access-token:${token}`).toString("base64");
  const gitEnvironment = {
    GIT_CONFIG_COUNT: "2",
    GIT_CONFIG_KEY_0: "http.extraheader",
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${authorization}`,
    GIT_CONFIG_KEY_1: "protocol.file.allow",
    GIT_CONFIG_VALUE_1: "never"
  };
  await runCommand("git", ["init", "--quiet", checkout], input.temporaryDirectory, gitEnvironment);
  await runCommand("git", ["-C", checkout, "remote", "add", "origin", `https://github.com/${input.repositoryFullName}.git`], input.temporaryDirectory, gitEnvironment);
  const references = [input.commitSha, input.parentSha].filter((value): value is string => Boolean(value && validCommitSha(value)));
  await runCommand("git", ["-C", checkout, "fetch", "--quiet", "--no-tags", "--depth=2", "origin", ...references], input.temporaryDirectory, gitEnvironment);
  await runCommand("git", ["-C", checkout, "-c", "core.hooksPath=/dev/null", "checkout", "--quiet", "--detach", input.commitSha], input.temporaryDirectory, gitEnvironment);
  return checkout;
}

async function changedPaths(checkout: string, commitSha: string, parentSha: string | null) {
  if (parentSha && validCommitSha(parentSha)) {
    try {
      const { stdout } = await runCommand("git", ["-C", checkout, "diff", "--name-only", "--diff-filter=ACMRT", parentSha, commitSha], checkout);
      return stdout.split("\n").filter(Boolean);
    } catch {
      // A force-push or shallow history may omit the parent; use the pinned tree instead.
    }
  }
  const { stdout } = await runCommand("git", ["-C", checkout, "ls-tree", "-r", "--name-only", commitSha], checkout);
  return stdout.split("\n").filter(Boolean);
}

async function inspectSelectedFiles(checkout: string, selectedPaths: string[]) {
  let totalBytes = 0;
  const linesByPath = new Map<string, number>();
  for (const relativePath of selectedPaths) {
    const absolutePath = path.resolve(checkout, relativePath);
    if (!absolutePath.startsWith(`${checkout}${path.sep}`)) throw new SourceAnalysisError("ANALYSIS_PATH_INVALID", "The selected source path was unsafe.");
    const file = await stat(absolutePath);
    if (!file.isFile() || file.size > CONTEXT_MAX_FILE_BYTES) throw new SourceAnalysisError("ANALYSIS_CONTEXT_TOO_LARGE", "A selected source file exceeds the safe analysis limit.");
    totalBytes += file.size;
    if (totalBytes > CONTEXT_MAX_BYTES) throw new SourceAnalysisError("ANALYSIS_CONTEXT_TOO_LARGE", "The selected source context exceeds the safe byte limit.");
    const contents = await readFile(absolutePath);
    if (contents.includes(0) || isSensitiveSourceText(contents.toString("utf8"))) throw new SourceAnalysisError("ANALYSIS_SENSITIVE_CONTEXT", "Sensitive or binary source context was detected.");
    linesByPath.set(relativePath, contents.toString("utf8").split("\n").length);
  }
  return linesByPath;
}

async function packSource(checkout: string, temporaryDirectory: string, selectedPaths: string[]) {
  const configPath = path.join(temporaryDirectory, "repomix-safe.config.json");
  await writeFile(configPath, "{}", { mode: 0o600 });
  const binary = path.join(process.cwd(), "node_modules", ".bin", "repomix");
  const { stdout } = await runCommand(binary, [checkout, "--config", configPath, "--stdout", "--quiet", "--compress", "--output-show-line-numbers", "--no-directory-structure", "--no-file-summary", "--include", selectedPaths.join(","), "--token-budget", String(CONTEXT_MAX_TOKENS)], temporaryDirectory);
  if (!stdout.trim()) throw new SourceAnalysisError("ANALYSIS_CONTEXT_EMPTY", "No safe source files were available for analysis.");
  if (isSensitiveSourceText(stdout)) throw new SourceAnalysisError("ANALYSIS_SENSITIVE_CONTEXT", "Repomix detected sensitive-looking context.");
  return stdout;
}

function responseSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["observations", "hypotheses", "likelyCause", "confidence", "remediation", "suggestedPatch", "sourceReferences", "limitations"],
    properties: {
      observations: { type: "array", items: { type: "string" }, maxItems: 10 },
      hypotheses: { type: "array", items: { type: "string" }, maxItems: 8 },
      likelyCause: { anyOf: [{ type: "string" }, { type: "null" }] },
      confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
      remediation: { anyOf: [{ type: "string" }, { type: "null" }] },
      suggestedPatch: { anyOf: [{ type: "string" }, { type: "null" }] },
      sourceReferences: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["path", "startLine", "endLine", "rationale"],
          properties: {
            path: { type: "string" },
            startLine: { type: "integer", minimum: 1 },
            endLine: { type: "integer", minimum: 1 },
            rationale: { type: "string" }
          }
        }
      },
      limitations: { type: "array", items: { type: "string" }, maxItems: 10 }
    }
  } as const;
}

function parseAnalysisPayload(value: unknown, linesByPath: Map<string, number>): AnalysisPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SourceAnalysisError("ANALYSIS_RESPONSE_INVALID", "The analysis provider returned an invalid structured result.");
  const payload = value as Record<string, unknown>;
  const confidence = payload.confidence;
  if (confidence !== "HIGH" && confidence !== "MEDIUM" && confidence !== "LOW") throw new SourceAnalysisError("ANALYSIS_RESPONSE_INVALID", "The analysis provider returned an invalid confidence level.");
  const strings = (value: unknown, maximum: number) => Array.isArray(value) ? value.slice(0, maximum).map((item) => safeString(item, 1_000)).filter(Boolean) : [];
  const references = Array.isArray(payload.sourceReferences) ? payload.sourceReferences.slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const reference = item as Record<string, unknown>;
    const sourcePath = safeString(reference.path, 300);
    const startLine = Number(reference.startLine);
    const endLine = Number(reference.endLine);
    const maximumLine = linesByPath.get(sourcePath);
    if (!maximumLine || !Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine || endLine > maximumLine) return [];
    return [{ path: sourcePath, startLine, endLine, rationale: safeString(reference.rationale, 800) }];
  }) : [];
  return {
    observations: strings(payload.observations, 10),
    hypotheses: strings(payload.hypotheses, 8),
    likelyCause: payload.likelyCause === null ? null : safeString(payload.likelyCause),
    confidence,
    remediation: payload.remediation === null ? null : safeString(payload.remediation),
    suggestedPatch: payload.suggestedPatch === null ? null : safeString(payload.suggestedPatch, MAX_PATCH_TEXT),
    sourceReferences: references,
    limitations: strings(payload.limitations, 10)
  };
}

function buildPrompt(input: { run: { testCase: { name: string }; failureReason: string | null; targetUrl: string; stepResults: Array<{ order: number; status: string; testStep: { kind: string; target: unknown; description: string | null; expectedOutcome: string | null } }>; evidence: Array<{ kind: string; metadata: unknown; captureError: string | null }> }; repositoryFullName: string; commitSha: string; changedPaths: string[]; packedSource: string }) {
  const steps = input.run.stepResults.map((step) => ({ order: step.order, state: step.status, kind: step.testStep.kind, target: targetSummary(step.testStep.target), description: safeNarrative(step.testStep.description, 400), expectedOutcome: safeNarrative(step.testStep.expectedOutcome, 400) }));
  const evidence = input.run.evidence.slice(0, 40).map((item) => ({ kind: item.kind, metadata: safeJson(item.metadata), captureError: safeNarrative(item.captureError, 300) }));
  return [
    "You are Sentinel's advisory software-test failure analyst.",
    "Use only the supplied redacted Run context and source package. Do not invent facts, copy large source fragments, reveal secrets, or propose automatic changes.",
    "Separate evidence-backed observations from hypotheses. If the evidence is insufficient, say so with low confidence.",
    "A suggested patch is an optional small review-only fragment. It must never include secrets or instructions to apply it automatically.",
    "Return only the requested JSON schema.",
    JSON.stringify({ repository: input.repositoryFullName, commit: input.commitSha, failedRun: { testCase: input.run.testCase.name, failureReason: input.run.failureReason, targetOrigin: new URL(input.run.targetUrl).origin, steps, evidence }, changedPaths: input.changedPaths }),
    "Bounded source package follows:",
    input.packedSource
  ].join("\n\n");
}

async function askOpenAI(prompt: string, linesByPath: Map<string, number>) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim();
  if (!apiKey || !model) throw new SourceAnalysisError("OPENAI_NOT_CONFIGURED", "OpenAI source analysis is not configured.");
  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model,
      store: false,
      input: prompt,
      text: { format: { type: "json_schema", name: "sentinel_source_analysis", strict: true, schema: responseSchema() } }
    });
    if (!response.output_text) throw new SourceAnalysisError("ANALYSIS_RESPONSE_EMPTY", "The analysis provider did not return a structured diagnosis.", true);
    return { payload: parseAnalysisPayload(JSON.parse(response.output_text), linesByPath), model };
  } catch (error) {
    if (error instanceof SourceAnalysisError) throw error;
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status) : 0;
    throw new SourceAnalysisError("OPENAI_REQUEST_FAILED", "The source-analysis provider is unavailable.", status === 429 || status >= 500 || status === 0);
  }
}

function safeAnalysisError(error: unknown) {
  if (error instanceof SourceAnalysisError) return error;
  return new SourceAnalysisError("ANALYSIS_FAILED", "Sentinel could not safely complete source analysis.", false);
}

export async function processSourceAnalysis(analysisId: string) {
  const analysis = await prisma.sourceAnalysis.findUnique({
    where: { id: analysisId },
    include: {
      connection: { include: { installation: true } },
      run: {
        include: {
          testCase: { select: { name: true } },
          stepResults: { orderBy: { order: "asc" }, include: { testStep: { select: { kind: true, target: true, description: true, expectedOutcome: true } } } },
          evidence: { orderBy: { capturedAt: "asc" }, select: { kind: true, metadata: true, captureError: true } }
        }
      }
    }
  });
  if (!analysis || analysis.status === SourceAnalysisStatus.COMPLETED || analysis.status === SourceAnalysisStatus.BLOCKED_SENSITIVE_CONTEXT || analysis.status === SourceAnalysisStatus.EXPIRED) return;
  if (!sourceAnalysisIsConfigured()) {
    await prisma.sourceAnalysis.update({ where: { id: analysisId }, data: { status: SourceAnalysisStatus.UNAVAILABLE, errorCode: "OPENAI_NOT_CONFIGURED", completedAt: new Date() } });
    return;
  }
  if (!validCommitSha(analysis.commitSha) || (analysis.parentSha && !validCommitSha(analysis.parentSha))) {
    await prisma.sourceAnalysis.update({ where: { id: analysisId }, data: { status: SourceAnalysisStatus.FAILED, errorCode: "COMMIT_INVALID", completedAt: new Date() } });
    return;
  }
  const claimed = await prisma.sourceAnalysis.updateMany({ where: { id: analysisId, status: { in: [SourceAnalysisStatus.QUEUED, SourceAnalysisStatus.UNAVAILABLE] } }, data: { status: SourceAnalysisStatus.ANALYZING, startedAt: new Date(), attemptCount: { increment: 1 }, errorCode: null } });
  if (claimed.count !== 1) return;
  let workspace: string | undefined;
  try {
    workspace = await mkdtemp(path.join(tmpdir(), "sentinel-source-analysis-"));
    const checkout = await checkoutCommit({ temporaryDirectory: workspace, repositoryFullName: analysis.connection.repositoryFullName, installationId: analysis.connection.installation.installationId, commitSha: analysis.commitSha, parentSha: analysis.parentSha });
    const selectedPaths = selectSourcePaths(await changedPaths(checkout, analysis.commitSha, analysis.parentSha));
    if (!selectedPaths.length) throw new SourceAnalysisError("ANALYSIS_CONTEXT_EMPTY", "The commit did not contain safe source files to analyze.");
    const linesByPath = await inspectSelectedFiles(checkout, selectedPaths);
    const packedSource = await packSource(checkout, workspace, selectedPaths);
    const prompt = buildPrompt({ run: analysis.run, repositoryFullName: analysis.connection.repositoryFullName, commitSha: analysis.commitSha, changedPaths: selectedPaths, packedSource });
    const result = await askOpenAI(prompt, linesByPath);
    await prisma.sourceAnalysis.update({
      where: { id: analysisId },
      data: {
        status: SourceAnalysisStatus.COMPLETED,
        confidence: result.payload.confidence as SourceAnalysisConfidence,
        provider: "openai",
        model: result.model,
        observations: result.payload.observations as Prisma.InputJsonValue,
        hypotheses: result.payload.hypotheses as Prisma.InputJsonValue,
        likelyCause: result.payload.likelyCause,
        remediation: result.payload.remediation,
        suggestedPatch: result.payload.suggestedPatch,
        sourceReferences: result.payload.sourceReferences as Prisma.InputJsonValue,
        limitations: result.payload.limitations.join("\n"),
        completedAt: new Date()
      }
    });
    await prisma.auditEvent.create({ data: { actorId: analysis.requestedById ?? analysis.run.initiatedById, action: "SOURCE_ANALYSIS_COMPLETED", entityType: "SourceAnalysis", entityId: analysisId, details: { runId: analysis.runId, repository: analysis.connection.repositoryFullName, commitSha: analysis.commitSha, confidence: result.payload.confidence } } });
  } catch (rawError) {
    const error = safeAnalysisError(rawError);
    const latest = await prisma.sourceAnalysis.findUnique({ where: { id: analysisId }, select: { attemptCount: true } });
    const retry = error.transient && (latest?.attemptCount ?? 0) < 2;
    const status = error.code === "ANALYSIS_SENSITIVE_CONTEXT" ? SourceAnalysisStatus.BLOCKED_SENSITIVE_CONTEXT : retry ? SourceAnalysisStatus.QUEUED : error.transient ? SourceAnalysisStatus.UNAVAILABLE : SourceAnalysisStatus.FAILED;
    await prisma.sourceAnalysis.update({ where: { id: analysisId }, data: { status, errorCode: error.code, completedAt: retry ? null : new Date() } }).catch(() => undefined);
    if (!retry) await prisma.auditEvent.create({ data: { actorId: analysis.requestedById ?? analysis.run.initiatedById, action: status === SourceAnalysisStatus.BLOCKED_SENSITIVE_CONTEXT ? "SOURCE_ANALYSIS_BLOCKED" : "SOURCE_ANALYSIS_UNAVAILABLE", entityType: "SourceAnalysis", entityId: analysisId, details: { runId: analysis.runId, reason: error.code } } }).catch(() => undefined);
    if (retry) throw error;
  } finally {
    if (workspace) await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
  }
}
