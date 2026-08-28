import {
  ProductDeletionStatus,
  RecordingStatus,
  ReleaseReadiness,
  ReleaseRunStatus,
  RunAttemptStatus,
  RunFailureReason,
  RunMode,
  RunOutcome,
  RunStatus
} from "@prisma/client";
import { closeBrowser } from "./browser";
import { deleteEvidenceObject } from "./evidence";
import { prisma } from "./prisma";
import { autoRunQueue } from "./queue";
import { deriveReleaseReadiness } from "./releases";

export type ProductDeletionImpact = {
  recordings: number;
  testCases: number;
  testCaseVersions: number;
  runs: number;
  evidenceItems: number;
  testDataSets: number;
  reviewItems: number;
  notifications: number;
  integrations: number;
  releasesAffected: number;
  activeWork: number;
};

export async function productDeletionImpact(productId: string): Promise<ProductDeletionImpact> {
  const [recordings, testCases, testCaseVersions, runs, evidenceItems, testDataSets, suggestions, proposals, notifications, jiraConfigs, jiraIssues, jiraFilings, repositories, releaseTests, releaseRunItems, activeRuns, activeRecordings] = await Promise.all([
    prisma.recordingSession.count({ where: { productId } }),
    prisma.testCase.count({ where: { productId } }),
    prisma.testCaseVersion.count({ where: { testCase: { productId } } }),
    prisma.run.count({ where: { productId } }),
    prisma.evidenceItem.count({ where: { run: { productId } } }),
    prisma.testDataSet.count({ where: { productId } }),
    prisma.testSuggestion.count({ where: { productId } }),
    prisma.changeProposal.count({ where: { productId } }),
    prisma.notification.count({ where: { productId } }),
    prisma.jiraProjectConfig.count({ where: { productId } }),
    prisma.jiraIssue.count({ where: { productId } }),
    prisma.jiraFiling.count({ where: { productId } }),
    prisma.productRepositoryConnection.count({ where: { productId } }),
    prisma.releaseTest.findMany({ where: { testCase: { productId } }, select: { releaseId: true } }),
    prisma.releaseRunItem.findMany({ where: { productId }, select: { releaseRun: { select: { releaseId: true } } } }),
    prisma.run.count({ where: { productId, status: { not: RunStatus.COMPLETED } } }),
    prisma.recordingSession.count({ where: { productId, status: { in: [RecordingStatus.DRAFT, RecordingStatus.ACTIVE] } } })
  ]);
  const releaseIds = new Set([...releaseTests.map((item) => item.releaseId), ...releaseRunItems.map((item) => item.releaseRun.releaseId)]);
  return {
    recordings,
    testCases,
    testCaseVersions,
    runs,
    evidenceItems,
    testDataSets,
    reviewItems: suggestions + proposals,
    notifications,
    integrations: jiraConfigs + jiraIssues + jiraFilings + repositories,
    releasesAffected: releaseIds.size,
    activeWork: activeRuns + activeRecordings
  };
}

async function removeQueuedAutoRunJobs(productId: string) {
  const attempts = await prisma.runAttempt.findMany({ where: { run: { productId, mode: RunMode.AUTO, status: { in: [RunStatus.QUEUED, RunStatus.PAUSED] } } }, select: { jobId: true } });
  const queue = autoRunQueue();
  await Promise.all(attempts.flatMap((attempt) => attempt.jobId ? [queue.getJob(attempt.jobId).then((job) => job?.remove()).catch(() => undefined)] : []));
}

async function stopProductWork(productId: string) {
  const now = new Date();
  const [activeRecordingCount, activeGuidedCount] = await Promise.all([
    prisma.recordingSession.count({ where: { productId, status: RecordingStatus.ACTIVE } }),
    prisma.run.count({ where: { productId, mode: RunMode.GUIDED, status: { not: RunStatus.COMPLETED } } })
  ]);
  await removeQueuedAutoRunJobs(productId);
  if (activeRecordingCount || activeGuidedCount) await closeBrowser().catch(() => undefined);
  await prisma.$transaction([
    prisma.recordingSession.updateMany({ where: { productId, status: { in: [RecordingStatus.DRAFT, RecordingStatus.ACTIVE] } }, data: { status: RecordingStatus.DISCARDED } }),
    prisma.run.updateMany({ where: { productId, mode: RunMode.GUIDED, status: { not: RunStatus.COMPLETED } }, data: { status: RunStatus.COMPLETED, outcome: RunOutcome.INTERRUPTED, failureReason: RunFailureReason.CANCELLED, completedAt: now, cancellingAt: now } }),
    prisma.run.updateMany({ where: { productId, mode: RunMode.AUTO, status: { in: [RunStatus.QUEUED, RunStatus.PAUSED] } }, data: { status: RunStatus.COMPLETED, outcome: RunOutcome.INTERRUPTED, failureReason: RunFailureReason.CANCELLED, completedAt: now, cancellingAt: now } }),
    prisma.runAttempt.updateMany({ where: { run: { productId, status: RunStatus.COMPLETED }, status: { in: [RunAttemptStatus.QUEUED, RunAttemptStatus.RUNNING] } }, data: { status: RunAttemptStatus.COMPLETED, failureReason: RunFailureReason.CANCELLED, completedAt: now } }),
    prisma.run.updateMany({ where: { productId, mode: RunMode.AUTO, status: RunStatus.RUNNING }, data: { status: RunStatus.CANCELLING, cancellingAt: now } })
  ]);

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await prisma.run.count({ where: { productId, status: RunStatus.CANCELLING } }) === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("PRODUCT_ACTIVE_WORK_DID_NOT_STOP");
}

async function deleteEvidenceObjects(productId: string) {
  const evidence = await prisma.evidenceItem.findMany({ where: { run: { productId }, objectKey: { not: null } }, select: { objectKey: true } });
  const keys = evidence.flatMap((item) => item.objectKey ? [item.objectKey] : []);
  for (let offset = 0; offset < keys.length; offset += 8) {
    const batch = await Promise.allSettled(keys.slice(offset, offset + 8).map((key) => deleteEvidenceObject(key)));
    if (batch.some((result) => result.status === "rejected")) throw new Error("PRODUCT_EVIDENCE_DELETE_FAILED");
  }
}

async function deleteProductRecords(deletionRequestId: string, productId: string, actorId: string, productName: string, impact: ProductDeletionImpact) {
  const [testCases, affectedReleaseRunItems] = await Promise.all([
    prisma.testCase.findMany({ where: { productId }, select: { id: true } }),
    prisma.releaseRunItem.findMany({ where: { productId }, select: { releaseRunId: true } })
  ]);
  const testCaseIds = testCases.map((testCase) => testCase.id);
  const releaseRunIds = [...new Set(affectedReleaseRunItems.map((item) => item.releaseRunId))];

  await prisma.$transaction(async (tx) => {
    if (testCaseIds.length) {
      await tx.testSuggestion.updateMany({ where: { approvedTestCaseId: { in: testCaseIds } }, data: { approvedTestCaseId: null } });
      await tx.releaseTest.deleteMany({ where: { testCaseId: { in: testCaseIds } } });
    }
    await tx.releaseRunItem.deleteMany({ where: { productId } });
    await tx.notification.deleteMany({ where: { productId } });
    await tx.testSuggestion.deleteMany({ where: { productId } });
    await tx.changeProposal.deleteMany({ where: { productId } });
    await tx.run.deleteMany({ where: { productId } });
    await tx.testCase.deleteMany({ where: { productId } });
    await tx.recordingSession.deleteMany({ where: { productId } });

    for (const releaseRunId of releaseRunIds) {
      const items = await tx.releaseRunItem.findMany({ where: { releaseRunId }, select: { status: true } });
      const readiness = items.length ? deriveReleaseReadiness(items.map((item) => item.status)) : ReleaseReadiness.NOT_READY;
      await tx.releaseRun.update({ where: { id: releaseRunId }, data: { readiness, status: readiness === ReleaseReadiness.IN_PROGRESS ? ReleaseRunStatus.RUNNING : ReleaseRunStatus.COMPLETED, ...(readiness === ReleaseReadiness.IN_PROGRESS ? {} : { completedAt: new Date() }) } });
    }

    await tx.product.delete({ where: { id: productId } });
    await tx.productDeletionRequest.update({ where: { id: deletionRequestId }, data: { status: ProductDeletionStatus.COMPLETED, failureCode: null, completedAt: new Date() } });
    await tx.auditEvent.create({ data: { actorId, action: "PRODUCT_DELETION_COMPLETED", entityType: "Product", entityId: productId, details: { productName, impact } } });
  }, { timeout: 20_000 });
}

export async function processProductDeletion(deletionRequestId: string) {
  const request = await prisma.productDeletionRequest.findUnique({ where: { id: deletionRequestId }, include: { product: { select: { id: true, name: true } } } });
  if (!request || request.status === ProductDeletionStatus.COMPLETED) return;
  if (!request.product) {
    await prisma.productDeletionRequest.update({ where: { id: request.id }, data: { status: ProductDeletionStatus.COMPLETED, completedAt: new Date(), failureCode: null } });
    return;
  }
  const claimed = await prisma.productDeletionRequest.updateMany({
    where: { id: request.id, status: { in: [ProductDeletionStatus.QUEUED, ProductDeletionStatus.FAILED] } },
    data: { status: ProductDeletionStatus.PROCESSING, attemptCount: { increment: 1 }, startedAt: new Date(), failureCode: null }
  });
  if (claimed.count !== 1) return;

  try {
    await stopProductWork(request.product.id);
    await deleteEvidenceObjects(request.product.id);
    await deleteProductRecords(request.id, request.product.id, request.requestedById, request.productName, request.impact as ProductDeletionImpact);
  } catch (error) {
    const failureCode = error instanceof Error && ["PRODUCT_ACTIVE_WORK_DID_NOT_STOP", "PRODUCT_EVIDENCE_DELETE_FAILED"].includes(error.message) ? error.message : "PRODUCT_DELETION_FAILED";
    await prisma.productDeletionRequest.updateMany({ where: { id: request.id, status: ProductDeletionStatus.PROCESSING }, data: { status: ProductDeletionStatus.FAILED, failureCode } });
    throw error;
  }
}
