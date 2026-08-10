import { Queue } from "bullmq";
import IORedis from "ioredis";

export const AUTO_RUN_QUEUE = "sentinel-auto-runs";

export type AutoRunJobData = {
  runId: string;
  attemptId: string;
};

function redisUrl() {
  return process.env.REDIS_URL ?? "redis://redis:6379";
}

export function createRedisConnection() {
  return new IORedis(redisUrl(), { maxRetriesPerRequest: null });
}

let queue: Queue<AutoRunJobData> | undefined;

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
