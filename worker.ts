import { RunAttemptStatus, RunFailureReason, RunMode, RunOutcome, RunStatus, RunStepStatus, TestDataStatus } from "@prisma/client";
import { Worker, type Job } from "bullmq";
import { chromium, type Page, type Request } from "playwright";
import { persistRunSnapshot, recordCaptureFailure } from "./lib/evidence";
import { prisma } from "./lib/prisma";
import { AUTO_RUN_QUEUE, createRedisConnection, enqueueAutoRun, type AutoRunJobData } from "./lib/queue";
import { canRetryAutoRun, initialReplayState, ReplayError, replayStep, type ReplayStep } from "./lib/replay";
import { decryptVariableValue } from "./lib/variables";

const CHECKPOINT_TIMEOUT_MS = 10 * 60 * 1000;

type EvidenceCollector = {
  snapshot: () => Promise<{ screenshot: Buffer; network: unknown[]; console: unknown[]; storage: unknown }>;
};

function now() {
  return new Date();
}

function pause(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function targetOrigin() {
  return new URL(process.env.DEMO_TARGET_URL ?? "http://demo-target").origin;
}

function attachEvidence(page: Page): EvidenceCollector {
  const network: unknown[] = [];
  const consoleEntries: unknown[] = [];
  const startedAt = new WeakMap<Request, number>();

  page.on("request", (request) => startedAt.set(request, Date.now()));
  page.on("response", (response) => {
    void (async () => {
      const request = response.request();
      if (!response.url().startsWith(targetOrigin())) return;
      const contentType = response.headers()["content-type"] ?? "";
      const responseBody = /(?:application\/json|text\/plain)/i.test(contentType) ? (await response.text().catch(() => "")).slice(0, 4096) : undefined;
      network.push({
        url: response.url(),
        method: request.method(),
        status: response.status(),
        durationMs: Math.max(0, Date.now() - (startedAt.get(request) ?? Date.now())),
        requestBody: request.postData() ?? undefined,
        responseBody
      });
    })();
  });
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") consoleEntries.push({ level: message.type(), message: message.text() });
  });

  let networkOffset = 0;
  let consoleOffset = 0;
  return {
    snapshot: async () => {
      const storage = await page.evaluate(`(() => {
        const values = (source) => Object.keys(source).map((key) => ({ key, value: source.getItem(key) }));
        return {
          cookies: document.cookie.split(";").map((value) => value.trim()).filter(Boolean).map((value) => ({ name: value.split("=")[0], value: value.slice(value.indexOf("=") + 1) })),
          localStorage: values(window.localStorage),
          sessionStorage: values(window.sessionStorage)
        };
      })()`);
      const snapshot = {
        screenshot: await page.screenshot({ type: "png" }),
        network: network.slice(networkOffset),
        console: consoleEntries.slice(consoleOffset),
        storage
      };
      networkOffset = network.length;
      consoleOffset = consoleEntries.length;
      return snapshot;
    }
  };
}

async function captureEvidence(collector: EvidenceCollector, runId: string, attemptId: string, label: "START" | "END" | "FAILURE" | "STEP" | "CHECKPOINT", runStepResultId?: string) {
  try {
    await persistRunSnapshot({ ...(await collector.snapshot()), runId, runAttemptId: attemptId, runStepResultId, label, includeScreenshot: label !== "STEP" });
  } catch (error) {
    console.error("Sentinel Auto Run evidence capture failed", error instanceof Error ? error.message : error);
    await recordCaptureFailure(runId, "AUTO_EVIDENCE_CAPTURE_FAILED", runStepResultId, attemptId).catch(() => undefined);
  }
}

async function interruptionRequested(runId: string) {
  const run = await prisma.run.findUnique({ where: { id: runId }, select: { status: true } });
  return run?.status === RunStatus.CANCELLING;
}

async function waitForCheckpoint(runId: string, deadline: Date) {
  while (Date.now() < deadline.getTime()) {
    const run = await prisma.run.findUnique({ where: { id: runId }, select: { status: true } });
    if (!run || run.status === RunStatus.CANCELLING) throw new ReplayError("CANCELLED", "Auto Run cancellation was requested.");
    if (run.status === RunStatus.RUNNING) return;
    await pause(1_000);
  }
  throw new ReplayError("CHECKPOINT_TIMEOUT", "The checkpoint review window expired.");
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

async function durationBenchmark(runId: string, activeDurationMs: number) {
  const run = await prisma.run.findUnique({ where: { id: runId }, select: { testCaseVersionId: true } });
  if (!run) return {};
  const guidedRuns = await prisma.run.findMany({
    where: { testCaseVersionId: run.testCaseVersionId, mode: RunMode.GUIDED, outcome: RunOutcome.PASSED, startedAt: { not: null }, completedAt: { not: null } },
    select: { startedAt: true, completedAt: true },
    orderBy: { completedAt: "desc" },
    take: 3
  });
  const durations = guidedRuns.flatMap((guided) => guided.startedAt && guided.completedAt ? [guided.completedAt.getTime() - guided.startedAt.getTime()] : []);
  if (durations.length < 3) return {};
  const benchmarkMedianMs = median(durations);
  return { benchmarkMedianMs, durationDeltaMs: activeDurationMs - benchmarkMedianMs };
}

async function completeRun(runId: string, attemptId: string, outcome: RunOutcome, reason: RunFailureReason | null, activeDurationMs: number) {
  const completedAt = now();
  const comparison = outcome === RunOutcome.PASSED ? await durationBenchmark(runId, activeDurationMs) : {};
  const run = await prisma.run.update({
    where: { id: runId },
    data: { status: RunStatus.COMPLETED, outcome, failureReason: reason, activeStepOrder: null, pausedAt: null, cancellingAt: null, checkpointDeadline: null, completedAt, activeDurationMs, ...comparison }
  });
  await prisma.runAttempt.update({ where: { id: attemptId }, data: { status: RunAttemptStatus.COMPLETED, failureReason: reason, completedAt, activeDurationMs } });
  await prisma.testDataSet.updateMany({ where: { reservedByRunId: runId, status: TestDataStatus.RESERVED }, data: { status: outcome === RunOutcome.PASSED ? TestDataStatus.CONSUMED : TestDataStatus.SAFE, reservedByRunId: null } });
  await prisma.auditEvent.create({ data: { actorId: run.initiatedById, action: outcome === RunOutcome.PASSED ? "AUTO_RUN_PASSED" : outcome === RunOutcome.FAILED ? "AUTO_RUN_FAILED" : "AUTO_RUN_INTERRUPTED", entityType: "Run", entityId: run.id, details: reason ? { reason } : undefined } });
}

async function retryRun(runId: string, attemptId: string, activeDurationMs: number, reason: RunFailureReason) {
  const completedAt = now();
  const next = await prisma.$transaction(async (tx) => {
    const current = await tx.runAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { run: true } });
    await tx.runAttempt.update({ where: { id: attemptId }, data: { status: RunAttemptStatus.COMPLETED, failureReason: reason, completedAt, activeDurationMs } });
    const created = await tx.runAttempt.create({ data: { runId, attemptNumber: current.attemptNumber + 1 } });
    await tx.run.update({ where: { id: runId }, data: { status: RunStatus.QUEUED, failureReason: reason, activeStepOrder: current.run.activeStepOrder, queuedAt: completedAt } });
    await tx.auditEvent.create({ data: { actorId: current.run.initiatedById, action: "AUTO_RUN_RETRY_QUEUED", entityType: "Run", entityId: runId, details: { reason, attemptNumber: created.attemptNumber } } });
    return created;
  });
  const jobId = await enqueueAutoRun({ runId, attemptId: next.id });
  await prisma.runAttempt.update({ where: { id: next.id }, data: { jobId } });
}

async function processAutoRun(job: Job<AutoRunJobData>) {
  const { runId, attemptId } = job.data;
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { testCaseVersion: { include: { steps: { orderBy: { order: "asc" } } } }, stepResults: { orderBy: { order: "asc" } }, attempts: { where: { id: attemptId } }, variableBindings: true }
  });
  if (!run || run.mode !== RunMode.AUTO || run.status === RunStatus.COMPLETED || run.attempts.length !== 1) return;
  const attempt = run.attempts[0];
  await prisma.$transaction([
    prisma.run.update({ where: { id: runId }, data: { status: RunStatus.RUNNING, startedAt: run.startedAt ?? now(), failureReason: null } }),
    prisma.runAttempt.update({ where: { id: attemptId }, data: { status: RunAttemptStatus.RUNNING, startedAt: now() } }),
    prisma.auditEvent.create({ data: { actorId: run.initiatedById, action: "AUTO_RUN_STARTED", entityType: "Run", entityId: runId, details: { attemptNumber: attempt.attemptNumber } } })
  ]);

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let collector: EvidenceCollector | undefined;
  let activeDurationMs = 0;
  let activeStepResultId: string | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    collector = attachEvidence(page);
    const state = initialReplayState();
    let variableValues: Map<string, string>;
    try {
      variableValues = new Map(run.variableBindings.map((binding) => [binding.name, decryptVariableValue(binding.valueEncrypted)]));
    } catch {
      throw new ReplayError("INFRASTRUCTURE_ERROR", "Run variable bindings cannot be decrypted safely.");
    }
    let startCaptured = false;

    for (const step of run.testCaseVersion.steps) {
      if (await interruptionRequested(runId)) throw new ReplayError("CANCELLED", "Auto Run cancellation was requested.");
      const result = run.stepResults.find((candidate) => candidate.order === step.order);
      if (!result) throw new ReplayError("INFRASTRUCTURE_ERROR", `Run result is missing for step ${step.order}.`);
      activeStepResultId = result.id;
      await prisma.runStepResult.update({ where: { id: result.id }, data: { status: RunStepStatus.RUNNING, startedAt: now() } });
      const actionStartedAt = Date.now();
      await replayStep(page, step as ReplayStep, state, run.targetUrl, variableValues);
      activeDurationMs += Date.now() - actionStartedAt;

      if (step.isCheckpoint) {
        const deadline = new Date(Date.now() + CHECKPOINT_TIMEOUT_MS);
        await prisma.$transaction([
          prisma.runStepResult.update({ where: { id: result.id }, data: { status: RunStepStatus.WAITING_FOR_CONFIRMATION, completedAt: now() } }),
          prisma.run.update({ where: { id: runId }, data: { status: RunStatus.PAUSED, activeStepOrder: step.order, pausedAt: now(), checkpointDeadline: deadline } }),
          prisma.auditEvent.create({ data: { actorId: run.initiatedById, action: "AUTO_RUN_CHECKPOINT_PAUSED", entityType: "Run", entityId: runId, details: { stepOrder: step.order } } })
        ]);
        await captureEvidence(collector, runId, attemptId, "CHECKPOINT", result.id);
        await waitForCheckpoint(runId, deadline);
        await prisma.runStepResult.update({ where: { id: result.id }, data: { status: RunStepStatus.PASSED } });
      } else {
        await prisma.runStepResult.update({ where: { id: result.id }, data: { status: RunStepStatus.PASSED, completedAt: now() } });
      }

      const next = run.stepResults.find((candidate) => candidate.order > step.order);
      if (!startCaptured) {
        startCaptured = true;
        await captureEvidence(collector, runId, attemptId, "START", result.id);
      } else if (next) {
        await captureEvidence(collector, runId, attemptId, "STEP", result.id);
      }
      if (next) await prisma.run.update({ where: { id: runId }, data: { status: RunStatus.RUNNING, activeStepOrder: next.order, pausedAt: null, checkpointDeadline: null } });
    }

    if (collector) await captureEvidence(collector, runId, attemptId, "END");
    await completeRun(runId, attemptId, RunOutcome.PASSED, null, activeDurationMs);
  } catch (error) {
    const replayError = error instanceof ReplayError ? error : new ReplayError("BROWSER_STARTUP", "The headless browser could not start.", true);
    if (activeStepResultId && replayError.reason !== "CANCELLED" && replayError.reason !== "CHECKPOINT_TIMEOUT") {
      await prisma.runStepResult.update({ where: { id: activeStepResultId }, data: { status: RunStepStatus.FAILED, completedAt: now() } }).catch(() => undefined);
    }
    if (collector) await captureEvidence(collector, runId, attemptId, replayError.reason === "CANCELLED" ? "END" : "FAILURE");
    else await recordCaptureFailure(runId, "AUTO_BROWSER_UNAVAILABLE", undefined, attemptId).catch(() => undefined);
    if (canRetryAutoRun(replayError, attempt.attemptNumber)) await retryRun(runId, attemptId, activeDurationMs, replayError.reason);
    else await completeRun(runId, attemptId, replayError.reason === "CANCELLED" || replayError.reason === "CHECKPOINT_TIMEOUT" ? RunOutcome.INTERRUPTED : RunOutcome.FAILED, replayError.reason, activeDurationMs);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

const worker = new Worker<AutoRunJobData>(AUTO_RUN_QUEUE, processAutoRun, { connection: createRedisConnection(), concurrency: 2 });

worker.on("failed", (job, error) => console.error("Sentinel Auto Run worker job failed", job?.id, error));
worker.on("error", (error) => console.error("Sentinel Auto Run worker error", error));

async function shutdown() {
  await worker.close();
  await prisma.$disconnect();
}

process.on("SIGINT", () => void shutdown().then(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown().then(() => process.exit(0)));
