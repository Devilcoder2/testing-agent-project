import { Queue } from "bullmq";
import IORedis from "ioredis";

export const AUTO_RUN_QUEUE = "sentinel-auto-runs";
export const NOTIFICATION_QUEUE = "sentinel-notifications";

export type AutoRunJobData = {
  runId: string;
  attemptId: string;
};

export type NotificationJobData = {
  notificationId: string;
};

function redisUrl() {
  return process.env.REDIS_URL ?? "redis://redis:6379";
}

export function createRedisConnection() {
  return new IORedis(redisUrl(), { maxRetriesPerRequest: null });
}

let queue: Queue<AutoRunJobData> | undefined;
let notificationQueueInstance: Queue<NotificationJobData> | undefined;

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
