import { Queue } from "bullmq";
import IORedis from "ioredis";

export const AUTO_RUN_QUEUE = "sentinel-auto-runs";
export const NOTIFICATION_QUEUE = "sentinel-notifications";
export const JIRA_FILING_QUEUE = "sentinel-jira-filings";
export const GITHUB_DELIVERY_QUEUE = "sentinel-github-deliveries";
export const SOURCE_ANALYSIS_QUEUE = "sentinel-source-analysis";

export type AutoRunJobData = {
  runId: string;
  attemptId: string;
};

export type NotificationJobData = {
  notificationId: string;
};

export type JiraFilingJobData = {
  filingId: string;
};

export type GitHubDeliveryJobData = {
  deliveryId: string;
};

export type SourceAnalysisJobData = {
  analysisId: string;
};

function redisUrl() {
  return process.env.REDIS_URL ?? "redis://redis:6379";
}

export function createRedisConnection() {
  return new IORedis(redisUrl(), { maxRetriesPerRequest: null });
}

let queue: Queue<AutoRunJobData> | undefined;
let notificationQueueInstance: Queue<NotificationJobData> | undefined;
let jiraFilingQueueInstance: Queue<JiraFilingJobData> | undefined;
let githubDeliveryQueueInstance: Queue<GitHubDeliveryJobData> | undefined;
let sourceAnalysisQueueInstance: Queue<SourceAnalysisJobData> | undefined;

export function autoRunQueue() {
  if (!queue) queue = new Queue<AutoRunJobData>(AUTO_RUN_QUEUE, { connection: createRedisConnection() });
  return queue;
}

export async function enqueueAutoRun(data: AutoRunJobData) {
  const job = await autoRunQueue().add("execute", data, {
    jobId: `attempt-${data.attemptId}`,
    removeOnComplete: 100,
    removeOnFail: 100
  });
  return String(job.id);
}

export function notificationQueue() {
  if (!notificationQueueInstance) notificationQueueInstance = new Queue<NotificationJobData>(NOTIFICATION_QUEUE, { connection: createRedisConnection() });
  return notificationQueueInstance;
}

export async function enqueueNotification(data: NotificationJobData) {
  const job = await notificationQueue().add("deliver", data, {
    jobId: `notification-${data.notificationId}`,
    attempts: 2,
    backoff: { type: "fixed", delay: 1_000 },
    removeOnComplete: 100,
    removeOnFail: 100
  });
  return String(job.id);
}

export function jiraFilingQueue() {
  if (!jiraFilingQueueInstance) jiraFilingQueueInstance = new Queue<JiraFilingJobData>(JIRA_FILING_QUEUE, { connection: createRedisConnection() });
  return jiraFilingQueueInstance;
}

export async function enqueueJiraFiling(data: JiraFilingJobData) {
  const job = await jiraFilingQueue().add("file", data, {
    jobId: `jira-filing-${data.filingId}`,
    attempts: 2,
    backoff: { type: "sentinel-jira", delay: 1_000 },
    removeOnComplete: 100,
    removeOnFail: 100
  });
  return String(job.id);
}

export function githubDeliveryQueue() {
  if (!githubDeliveryQueueInstance) githubDeliveryQueueInstance = new Queue<GitHubDeliveryJobData>(GITHUB_DELIVERY_QUEUE, { connection: createRedisConnection() });
  return githubDeliveryQueueInstance;
}

export async function enqueueGitHubDelivery(data: GitHubDeliveryJobData) {
  const job = await githubDeliveryQueue().add("process", data, {
    jobId: `github-delivery-${data.deliveryId}`,
    attempts: 2,
    backoff: { type: "fixed", delay: 1_000 },
    removeOnComplete: 100,
    removeOnFail: 100
  });
  return String(job.id);
}

export function sourceAnalysisQueue() {
  if (!sourceAnalysisQueueInstance) sourceAnalysisQueueInstance = new Queue<SourceAnalysisJobData>(SOURCE_ANALYSIS_QUEUE, { connection: createRedisConnection() });
  return sourceAnalysisQueueInstance;
}

export async function enqueueSourceAnalysis(data: SourceAnalysisJobData) {
  const job = await sourceAnalysisQueue().add("analyze", data, {
    jobId: `source-analysis-${data.analysisId}`,
    attempts: 2,
    backoff: { type: "fixed", delay: 1_000 },
    removeOnComplete: 100,
    removeOnFail: 100
  });
  return String(job.id);
}
