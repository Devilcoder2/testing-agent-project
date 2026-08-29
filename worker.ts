import { RunAttemptStatus, RunFailureReason, RunMode, RunOutcome, RunStatus, RunStepStatus, TestDataReusePolicy, TestDataStatus } from "@prisma/client";
import { Worker, type Job } from "bullmq";
import { chromium, type Page, type Request } from "playwright";
import { persistRunSnapshot, recordCaptureFailure } from "./lib/evidence";
import { deliverJiraFiling, JiraAdapterError } from "./lib/jira";
import { deliverNotification, notifyAutoRunCheckpoint, notifyRunFailure } from "./lib/notifications";
import { runEvidenceRetention, runMessagingRetention } from "./lib/maintenance";
import { prisma } from "./lib/prisma";
import { GITHUB_DELIVERY_QUEUE, JIRA_FILING_QUEUE, MESSAGING_DELIVERY_QUEUE, MESSAGING_UPDATE_QUEUE, NOTIFICATION_QUEUE, PRODUCT_DELETION_QUEUE, SOURCE_ANALYSIS_QUEUE, AUTO_RUN_QUEUE, createRedisConnection, enqueueAutoRun, enqueueMessagingDelivery, type AutoRunJobData, type GitHubDeliveryJobData, type JiraFilingJobData, type MessagingDeliveryJobData, type MessagingUpdateJobData, type NotificationJobData, type ProductDeletionJobData, type SourceAnalysisJobData } from "./lib/queue";
import { canRetryAutoRun, initialReplayState, ReplayError, replayStep, type ReplayStep } from "./lib/replay";
import { decryptVariableValue } from "./lib/variables";
import { markReleaseRunItemRunning, syncReleaseRunItemForRun } from "./lib/releases";
import { processGitHubDelivery, requestAutomaticSourceAnalysis } from "./lib/github-runs";
import { processSourceAnalysis } from "./lib/source-analysis";
import { processProductDeletion } from "./lib/product-deletion";
import { deliverTelegramRunResult, processTelegramUpdate } from "./lib/messaging-service";

const CHECKPOINT_TIMEOUT_MS = 10 * 60 * 1000;
const MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const WORKER_HEARTBEAT_INTERVAL_MS = 15 * 1000;
const WORKER_HEARTBEAT_TTL_SECONDS = 45;
export const WORKER_HEARTBEAT_KEY = "sentinel:worker:heartbeat";

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

async function queueTelegramTerminalDelivery(runId: string) {
  const delivery = await prisma.messagingDelivery.findFirst({ where: { runId, status: "PENDING" }, select: { id: true } });
  if (!delivery) return;
  await prisma.messagingDelivery.update({ where: { id: delivery.id }, data: { terminalAt: now() } });
  try {
    await enqueueMessagingDelivery({ deliveryId: delivery.id });
    await prisma.auditEvent.create({ data: { actorId: (await prisma.run.findUniqueOrThrow({ where: { id: runId }, select: { initiatedById: true } })).initiatedById, action: "TELEGRAM_DELIVERY_QUEUED", entityType: "MessagingDelivery", entityId: delivery.id } });
  } catch {
    // The durable delivery remains pending and may be requeued by a later worker pass.
  }
}

async function completeRun(runId: string, attemptId: string, outcome: RunOutcome, reason: RunFailureReason | null, activeDurationMs: number) {
  const completedAt = now();
  const comparison = outcome === RunOutcome.PASSED ? await durationBenchmark(runId, activeDurationMs) : {};
  const run = await prisma.run.update({
    where: { id: runId },
    data: { status: RunStatus.COMPLETED, outcome, failureReason: reason, activeStepOrder: null, pausedAt: null, cancellingAt: null, checkpointDeadline: null, completedAt, activeDurationMs, ...comparison }
  });
  await prisma.runAttempt.update({ where: { id: attemptId }, data: { status: RunAttemptStatus.COMPLETED, failureReason: reason, completedAt, activeDurationMs } });
  if (outcome === RunOutcome.PASSED) {
    await prisma.$transaction([
      prisma.testDataRow.updateMany({ where: { reservedByRunId: runId, status: TestDataStatus.RESERVED, dataSet: { reusePolicy: TestDataReusePolicy.REUSABLE } }, data: { status: TestDataStatus.SAFE, reservedByRunId: null } }),
      prisma.testDataRow.updateMany({ where: { reservedByRunId: runId, status: TestDataStatus.RESERVED, dataSet: { reusePolicy: TestDataReusePolicy.SINGLE_USE } }, data: { status: TestDataStatus.CONSUMED, reservedByRunId: null } })
    ]);
  } else {
    await prisma.testDataRow.updateMany({ where: { reservedByRunId: runId, status: TestDataStatus.RESERVED }, data: { status: TestDataStatus.SAFE, reservedByRunId: null } });
  }
  await prisma.auditEvent.create({ data: { actorId: run.initiatedById, action: outcome === RunOutcome.PASSED ? "AUTO_RUN_PASSED" : outcome === RunOutcome.FAILED ? "AUTO_RUN_FAILED" : "AUTO_RUN_INTERRUPTED", entityType: "Run", entityId: run.id, details: reason ? { reason } : undefined } });
  await syncReleaseRunItemForRun(run.id, outcome);
  if (outcome === RunOutcome.FAILED) {
    await notifyRunFailure(run.id);
    await requestAutomaticSourceAnalysis(run.id);
  }
  await queueTelegramTerminalDelivery(run.id);
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
  const claimed = await prisma.run.updateMany({
    where: { id: runId, status: RunStatus.QUEUED },
    data: { status: RunStatus.RUNNING, startedAt: run.startedAt ?? now(), failureReason: null }
  });
  if (claimed.count !== 1) return;
  await prisma.$transaction([
    prisma.runAttempt.update({ where: { id: attemptId }, data: { status: RunAttemptStatus.RUNNING, startedAt: now() } }),
    prisma.auditEvent.create({ data: { actorId: run.initiatedById, action: "AUTO_RUN_STARTED", entityType: "Run", entityId: runId, details: { attemptNumber: attempt.attemptNumber } } })
  ]);
  await markReleaseRunItemRunning(runId);

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
        const paused = await prisma.run.updateMany({
          where: { id: runId, status: RunStatus.RUNNING },
          data: { status: RunStatus.PAUSED, activeStepOrder: step.order, pausedAt: now(), checkpointDeadline: deadline }
        });
        if (paused.count !== 1) throw new ReplayError("CANCELLED", "Auto Run cancellation was requested.");
        await prisma.$transaction([
          prisma.runStepResult.update({ where: { id: result.id }, data: { status: RunStepStatus.WAITING_FOR_CONFIRMATION, completedAt: now() } }),
          prisma.auditEvent.create({ data: { actorId: run.initiatedById, action: "AUTO_RUN_CHECKPOINT_PAUSED", entityType: "Run", entityId: runId, details: { stepOrder: step.order } } })
        ]);
        await notifyAutoRunCheckpoint(runId);
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

const autoRunWorker = new Worker<AutoRunJobData>(AUTO_RUN_QUEUE, processAutoRun, { connection: createRedisConnection(), concurrency: 2 });
const notificationWorker = new Worker<NotificationJobData>(NOTIFICATION_QUEUE, async (job) => deliverNotification(job.data.notificationId), { connection: createRedisConnection(), concurrency: 4 });
const jiraFilingWorker = new Worker<JiraFilingJobData>(JIRA_FILING_QUEUE, async (job) => deliverJiraFiling(job.data.filingId, job.attemptsMade + 1), {
  connection: createRedisConnection(),
  concurrency: 2,
  settings: {
    backoffStrategy: (_attemptsMade, type, error) => type === "sentinel-jira" && error instanceof JiraAdapterError ? error.retryAfterMs ?? 1_000 : 1_000
  }
});
const githubDeliveryWorker = new Worker<GitHubDeliveryJobData>(GITHUB_DELIVERY_QUEUE, async (job) => processGitHubDelivery(job.data.deliveryId), { connection: createRedisConnection(), concurrency: 2 });
const sourceAnalysisWorker = new Worker<SourceAnalysisJobData>(SOURCE_ANALYSIS_QUEUE, async (job) => processSourceAnalysis(job.data.analysisId), { connection: createRedisConnection(), concurrency: 1 });
const productDeletionWorker = new Worker<ProductDeletionJobData>(PRODUCT_DELETION_QUEUE, async (job) => processProductDeletion(job.data.deletionRequestId), { connection: createRedisConnection(), concurrency: 1 });
const messagingUpdateWorker = new Worker<MessagingUpdateJobData>(MESSAGING_UPDATE_QUEUE, async (job) => processTelegramUpdate(job.data.updateId), { connection: createRedisConnection(), concurrency: 2 });
const messagingDeliveryWorker = new Worker<MessagingDeliveryJobData>(MESSAGING_DELIVERY_QUEUE, async (job) => deliverTelegramRunResult(job.data.deliveryId), { connection: createRedisConnection(), concurrency: 1 });
const heartbeatConnection = createRedisConnection();

async function refreshWorkerHeartbeat() {
  await heartbeatConnection.set(WORKER_HEARTBEAT_KEY, String(Date.now()), "EX", WORKER_HEARTBEAT_TTL_SECONDS).catch((error) => console.error("Sentinel worker heartbeat failed", error));
}

async function runMaintenance() {
  await runEvidenceRetention();
  await runMessagingRetention();
  const pendingDeliveries = await prisma.messagingDelivery.findMany({ where: { status: "PENDING", terminalAt: { not: null } }, select: { id: true }, take: 100 });
  for (const delivery of pendingDeliveries) await enqueueMessagingDelivery({ deliveryId: delivery.id }).catch(() => undefined);
}

void runMaintenance();
void refreshWorkerHeartbeat();
const maintenanceTimer = setInterval(() => void runMaintenance(), MAINTENANCE_INTERVAL_MS);
const heartbeatTimer = setInterval(() => void refreshWorkerHeartbeat(), WORKER_HEARTBEAT_INTERVAL_MS);

autoRunWorker.on("failed", (job, error) => console.error("Sentinel Auto Run worker job failed", job?.id, error));
autoRunWorker.on("error", (error) => console.error("Sentinel Auto Run worker error", error));
notificationWorker.on("failed", (job, error) => console.error("Sentinel notification worker job failed", job?.id, error));
notificationWorker.on("error", (error) => console.error("Sentinel notification worker error", error));
jiraFilingWorker.on("failed", (job, error) => console.error("Sentinel Jira filing worker job failed", job?.id, error));
jiraFilingWorker.on("error", (error) => console.error("Sentinel Jira filing worker error", error));
githubDeliveryWorker.on("failed", (job, error) => console.error("Sentinel GitHub delivery worker job failed", job?.id, error));
githubDeliveryWorker.on("error", (error) => console.error("Sentinel GitHub delivery worker error", error));
sourceAnalysisWorker.on("failed", (job, error) => console.error("Sentinel source-analysis worker job failed", job?.id, error));
sourceAnalysisWorker.on("error", (error) => console.error("Sentinel source-analysis worker error", error));
productDeletionWorker.on("failed", (job, error) => console.error("Sentinel Product deletion worker job failed", job?.id, error));
productDeletionWorker.on("error", (error) => console.error("Sentinel Product deletion worker error", error));
messagingUpdateWorker.on("failed", (job, error) => console.error("Sentinel Telegram update worker job failed", job?.id, error));
messagingUpdateWorker.on("error", (error) => console.error("Sentinel Telegram update worker error", error));
messagingDeliveryWorker.on("failed", (job, error) => console.error("Sentinel Telegram delivery worker job failed", job?.id, error));
messagingDeliveryWorker.on("error", (error) => console.error("Sentinel Telegram delivery worker error", error));

async function shutdown() {
  clearInterval(maintenanceTimer);
  clearInterval(heartbeatTimer);
  await Promise.all([autoRunWorker.close(), notificationWorker.close(), jiraFilingWorker.close(), githubDeliveryWorker.close(), sourceAnalysisWorker.close(), productDeletionWorker.close(), messagingUpdateWorker.close(), messagingDeliveryWorker.close()]);
  await heartbeatConnection.quit();
  await prisma.$disconnect();
}

process.on("SIGINT", () => void shutdown().then(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown().then(() => process.exit(0)));
