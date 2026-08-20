import { jiraCloudIsConfigured } from "./jira";
import { latestEvidenceRetentionRun } from "./maintenance";
import { verifyQaReadOnlyAccess } from "./database-diagnostics";
import { evidenceStoreIsReachable } from "./evidence";
import { prisma } from "./prisma";
import { createRedisConnection } from "./queue";

const WORKER_HEARTBEAT_KEY = "sentinel:worker:heartbeat";
const WORKER_HEARTBEAT_MAX_AGE_MS = 45 * 1000;

export type PilotReadinessItem = { key: string; label: string; status: "READY" | "ATTENTION" | "OPTIONAL"; detail: string };

async function isSentinelDatabaseReady() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function isRedisReady() {
  const connection = createRedisConnection();
  try {
    return await connection.ping() === "PONG";
  } catch {
    return false;
  } finally {
    await connection.quit().catch(() => undefined);
  }
}

async function workerIsFresh() {
  const connection = createRedisConnection();
  try {
    const value = await connection.get(WORKER_HEARTBEAT_KEY);
    const timestamp = Number(value);
    return Number.isFinite(timestamp) && Date.now() - timestamp <= WORKER_HEARTBEAT_MAX_AGE_MS;
  } catch {
    return false;
  } finally {
    await connection.quit().catch(() => undefined);
  }
}

async function endpointAvailable(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function browserIsReady() {
  const configured = process.env.BROWSER_SELENIUM_URL ?? "http://browser:4444/wd/hub";
  const url = new URL(configured);
  url.pathname = "/status";
  return endpointAvailable(url.toString());
}

async function mailpitIsReady() {
  if ((process.env.SMTP_HOST ?? "mailpit") !== "mailpit") return false;
  return endpointAvailable("http://mailpit:8025/livez");
}

export async function pilotReadiness() {
  const [database, redis, evidence, browser, mailpit, qa, worker, maintenance] = await Promise.all([
    isSentinelDatabaseReady(), isRedisReady(), evidenceStoreIsReachable(), browserIsReady(), mailpitIsReady(), verifyQaReadOnlyAccess(), workerIsFresh(), latestEvidenceRetentionRun()
  ]);
  const retentionReady = Boolean(maintenance?.completedAt && maintenance.status !== "PARTIAL");
  const items: PilotReadinessItem[] = [
    { key: "database", label: "Sentinel database", status: database ? "READY" : "ATTENTION", detail: database ? "Application persistence is reachable." : "Start the Sentinel PostgreSQL service." },
    { key: "redis", label: "Redis queues", status: redis ? "READY" : "ATTENTION", detail: redis ? "Run, notification, and Jira queues are reachable." : "Start Redis before requesting Auto Runs." },
    { key: "worker", label: "Background worker", status: worker ? "READY" : "ATTENTION", detail: worker ? "The worker heartbeat is current." : "Restart the Sentinel worker and wait for its heartbeat." },
    { key: "evidence", label: "Private evidence store", status: evidence ? "READY" : "ATTENTION", detail: evidence ? "The private evidence bucket is reachable." : "Start MinIO and confirm the evidence bucket is available." },
    { key: "browser", label: "Guided browser", status: browser ? "READY" : "ATTENTION", detail: browser ? "The local Selenium browser is reachable." : "Start the browser service before recording or Guided Runs." },
    { key: "mailpit", label: "Local email sink", status: mailpit ? "READY" : "ATTENTION", detail: mailpit ? "Mailpit is ready for safe local notification inspection." : "Start Mailpit; real SMTP is intentionally out of scope for this pilot." },
    { key: "qa", label: "QA read-only diagnostic", status: qa.ok ? "READY" : "ATTENTION", detail: qa.ok ? "The diagnostic role remains read-only." : "Restore the isolated QA fixture and its read-only role." },
    { key: "retention", label: "Evidence retention", status: retentionReady ? "READY" : "ATTENTION", detail: retentionReady ? `The latest 30-day cleanup completed at ${maintenance?.completedAt?.toISOString()}.` : "Wait for the worker retention cleanup to complete." },
    { key: "jira", label: "Jira Cloud", status: "OPTIONAL", detail: jiraCloudIsConfigured() ? "An optional Jira connection is configured." : "Unconfigured by design for the local pilot." }
  ];
  return { localOnly: true, ready: items.filter((item) => item.status === "ATTENTION").length === 0, items };
}
