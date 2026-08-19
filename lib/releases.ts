import { ReleaseReadiness, ReleaseRunItemStatus, ReleaseRunStatus, RunOutcome } from "@prisma/client";
import { notifyReleaseCompletion } from "./notifications";
import { prisma } from "./prisma";

export function deriveReleaseReadiness(statuses: ReleaseRunItemStatus[]) {
  if (statuses.some((status) => status === ReleaseRunItemStatus.QUEUED || status === ReleaseRunItemStatus.RUNNING)) return ReleaseReadiness.IN_PROGRESS;
  if (statuses.some((status) => status === ReleaseRunItemStatus.FAILED || status === ReleaseRunItemStatus.INTERRUPTED || status === ReleaseRunItemStatus.EXCLUDED)) return ReleaseReadiness.NOT_READY;
  return ReleaseReadiness.READY;
}

export async function refreshReleaseRun(releaseRunId: string) {
  const items = await prisma.releaseRunItem.findMany({ where: { releaseRunId }, select: { status: true } });
  const readiness = deriveReleaseReadiness(items.map((item) => item.status));
  const completed = readiness !== ReleaseReadiness.IN_PROGRESS;
  if (!completed) return prisma.releaseRun.update({ where: { id: releaseRunId }, data: { readiness, status: ReleaseRunStatus.RUNNING } });

  const transitioned = await prisma.releaseRun.updateMany({
    where: { id: releaseRunId, status: { not: ReleaseRunStatus.COMPLETED } },
    data: { readiness, status: ReleaseRunStatus.COMPLETED, completedAt: new Date() }
  });
  const releaseRun = await prisma.releaseRun.findUniqueOrThrow({ where: { id: releaseRunId } });
  if (transitioned.count === 1) await notifyReleaseCompletion(releaseRunId);
  return releaseRun;
}

export async function markReleaseRunItemRunning(runId: string) {
  const item = await prisma.releaseRunItem.findUnique({ where: { runId }, select: { id: true, releaseRunId: true } });
  if (!item) return;
  await prisma.releaseRunItem.update({ where: { id: item.id }, data: { status: ReleaseRunItemStatus.RUNNING } });
  await refreshReleaseRun(item.releaseRunId);
}

export async function syncReleaseRunItemForRun(runId: string, outcome: RunOutcome) {
  const item = await prisma.releaseRunItem.findUnique({ where: { runId }, select: { id: true, releaseRunId: true } });
  if (!item) return;
  const status = outcome === RunOutcome.PASSED ? ReleaseRunItemStatus.PASSED : outcome === RunOutcome.FAILED ? ReleaseRunItemStatus.FAILED : ReleaseRunItemStatus.INTERRUPTED;
  await prisma.releaseRunItem.update({ where: { id: item.id }, data: { status } });
  await refreshReleaseRun(item.releaseRunId);
}

export async function markReleaseRunItemQueueFailure(runId: string) {
  const item = await prisma.releaseRunItem.findUnique({ where: { runId }, select: { id: true, releaseRunId: true } });
  if (!item) return;
  await prisma.releaseRunItem.update({ where: { id: item.id }, data: { status: ReleaseRunItemStatus.FAILED, exclusionReason: "AUTO_RUN_QUEUE_FAILED" } });
  await refreshReleaseRun(item.releaseRunId);
}
