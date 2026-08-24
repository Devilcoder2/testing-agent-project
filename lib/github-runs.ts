import { AccountStatus, GitHubDeliveryStatus, GitHubDeliveryTargetStatus, GitHubRepositoryConnectionStatus, OrganizationRole, RunAttemptStatus, RunFailureReason, RunMode, RunOutcome, RunStatus, SourceAnalysisStatus, SourceAnalysisTrigger, VariableSource } from "@prisma/client";
import { branchIsAllowed, validCommitSha } from "./github";
import { notifyRunFailure } from "./notifications";
import { prisma } from "./prisma";
import { enqueueAutoRun, enqueueSourceAnalysis } from "./queue";
import { sourceAnalysisExpiresAt } from "./source-analysis";

type Exclusion = { testCaseId: string; name: string; reason: string };

function targetAllowed(targetUrl: string) {
  return targetUrl === (process.env.DEMO_TARGET_URL ?? "http://demo-target");
}

function autoRunExclusion(testCase: { id: string; name: string; currentVersion: number; recordingSession: { targetUrl: string }; versions: Array<{ version: number; steps: Array<{ isCheckpoint: boolean }>; variables: Array<{ staticValueEncrypted: string | null }> }> }): Exclusion | null {
  const version = testCase.versions.find((candidate) => candidate.version === testCase.currentVersion);
  if (!version || version.steps.length === 0) return { testCaseId: testCase.id, name: testCase.name, reason: "NO_SAVED_STEPS" };
  if (!targetAllowed(testCase.recordingSession.targetUrl)) return { testCaseId: testCase.id, name: testCase.name, reason: "TARGET_NOT_ALLOWLISTED" };
  if (version.steps.some((step) => step.isCheckpoint)) return { testCaseId: testCase.id, name: testCase.name, reason: "CHECKPOINT_REQUIRES_INDIVIDUAL_RUN" };
  if (version.variables.some((variable) => !variable.staticValueEncrypted)) return { testCaseId: testCase.id, name: testCase.name, reason: "VARIABLE_REQUIRES_STATIC_DEFAULT" };
  return null;
}

async function automationActor(productId: string, organizationId: string | null) {
  if (!organizationId) return null;
  const admin = await prisma.organizationMember.findFirst({
    where: { organizationId, role: OrganizationRole.ADMIN, user: { accountStatus: AccountStatus.ACTIVE } },
    orderBy: { createdAt: "asc" },
    select: { userId: true }
  });
  if (admin) return admin.userId;
  const manager = await prisma.productMembership.findFirst({
    where: { productId, user: { accountStatus: AccountStatus.ACTIVE, organizationMemberships: { some: { organizationId, role: OrganizationRole.MANAGER } } } },
    orderBy: { createdAt: "asc" },
    select: { userId: true }
  });
  return manager?.userId ?? null;
}

function safeExclusions(value: Exclusion[]) {
  return value.slice(0, 100).map((item) => ({ testCaseId: item.testCaseId, name: item.name.slice(0, 160), reason: item.reason }));
}

export async function processGitHubDelivery(deliveryId: string) {
  const delivery = await prisma.gitHubDelivery.findUnique({ where: { id: deliveryId } });
  if (!delivery || delivery.status === GitHubDeliveryStatus.PROCESSED || delivery.status === GitHubDeliveryStatus.IGNORED) return;
  if (!delivery.installationNumber || !delivery.repositoryId || !delivery.repositoryFullName || !delivery.branch || !delivery.afterSha || !validCommitSha(delivery.afterSha)) {
    await prisma.gitHubDelivery.update({ where: { id: deliveryId }, data: { status: GitHubDeliveryStatus.IGNORED, safeError: "DELIVERY_UNSUPPORTED", processedAt: new Date() } });
    return;
  }
  const connections = await prisma.productRepositoryConnection.findMany({
    where: {
      status: GitHubRepositoryConnectionStatus.ACTIVE,
      repositoryId: delivery.repositoryId,
      installation: { installationId: delivery.installationNumber, status: "ACTIVE" }
    },
    include: { product: { select: { id: true, organizationId: true } } }
  });
  if (!connections.length) {
    await prisma.gitHubDelivery.update({ where: { id: deliveryId }, data: { status: GitHubDeliveryStatus.IGNORED, safeError: "NO_ACTIVE_CONNECTION", processedAt: new Date() } });
    return;
  }
  for (const connection of connections) {
    const target = await prisma.gitHubDeliveryTarget.upsert({
      where: { deliveryId_connectionId: { deliveryId, connectionId: connection.id } },
      create: { deliveryId, connectionId: connection.id },
      update: {}
    });
    if (target.status !== GitHubDeliveryTargetStatus.QUEUED) continue;
    if (!branchIsAllowed(delivery.branch, connection.branchAllowlist)) {
      await prisma.gitHubDeliveryTarget.update({ where: { id: target.id }, data: { status: GitHubDeliveryTargetStatus.IGNORED, decisionReason: "BRANCH_NOT_ALLOWLISTED" } });
      continue;
    }
    const actorId = await automationActor(connection.productId, connection.product.organizationId);
    if (!actorId) {
      await prisma.gitHubDeliveryTarget.update({ where: { id: target.id }, data: { status: GitHubDeliveryTargetStatus.IGNORED, decisionReason: "NO_ACTIVE_AUTOMATION_ACTOR" } });
      continue;
    }
    const linkedTests = await prisma.testCase.findMany({
      where: { productId: connection.productId, repositoryLinks: { some: { connectionId: connection.id } } },
      include: { recordingSession: true, versions: { include: { steps: { orderBy: { order: "asc" } }, variables: true } } }
    });
    const exclusions: Exclusion[] = [];
    const queued: Array<{ runId: string; attemptId: string }> = [];
    for (const testCase of linkedTests) {
      const exclusion = autoRunExclusion(testCase);
      if (exclusion) {
        exclusions.push(exclusion);
        continue;
      }
      const existing = await prisma.gitHubRunLink.findFirst({ where: { deliveryTargetId: target.id, run: { testCaseId: testCase.id } }, select: { runId: true } });
      if (existing) continue;
      const version = testCase.versions.find((candidate) => candidate.version === testCase.currentVersion)!;
      const created = await prisma.$transaction(async (tx) => {
        const run = await tx.run.create({
          data: {
            testCaseId: testCase.id,
            testCaseVersionId: version.id,
            productId: testCase.productId,
            initiatedById: actorId,
            targetUrl: testCase.recordingSession.targetUrl,
            mode: RunMode.AUTO,
            activeStepOrder: version.steps[0].order,
            stepResults: { create: version.steps.map((step) => ({ testStepId: step.id, order: step.order })) },
            attempts: { create: { attemptNumber: 1 } },
            variableBindings: { create: version.variables.map((variable) => ({ name: variable.name, source: VariableSource.STATIC, valueEncrypted: variable.staticValueEncrypted!, testVariableId: variable.id })) }
          },
          include: { attempts: true }
        });
        await tx.gitHubRunLink.create({ data: { runId: run.id, connectionId: connection.id, deliveryTargetId: target.id, repositoryFullName: connection.repositoryFullName, branch: delivery.branch!, commitSha: delivery.afterSha!, parentSha: delivery.beforeSha } });
        await tx.auditEvent.create({ data: { actorId, action: "GITHUB_AUTO_RUN_QUEUED", entityType: "Run", entityId: run.id, details: { deliveryId, repository: connection.repositoryFullName, branch: delivery.branch, commitSha: delivery.afterSha } } });
        return run;
      });
      queued.push({ runId: created.id, attemptId: created.attempts[0].id });
    }
    await prisma.gitHubDeliveryTarget.update({ where: { id: target.id }, data: { status: GitHubDeliveryTargetStatus.PROCESSED, decisionReason: linkedTests.length ? null : "NO_LINKED_TEST_CASES", queuedRunCount: queued.length, excludedTests: safeExclusions(exclusions) } });
    for (const item of queued) {
      try {
        const jobId = await enqueueAutoRun(item);
        await prisma.runAttempt.update({ where: { id: item.attemptId }, data: { jobId } });
      } catch {
        const completedAt = new Date();
        await prisma.$transaction([
          prisma.run.update({ where: { id: item.runId }, data: { status: RunStatus.COMPLETED, outcome: RunOutcome.FAILED, failureReason: RunFailureReason.INFRASTRUCTURE_ERROR, evidenceStatus: "PARTIAL", activeStepOrder: null, completedAt } }),
          prisma.runAttempt.update({ where: { id: item.attemptId }, data: { status: RunAttemptStatus.COMPLETED, failureReason: RunFailureReason.INFRASTRUCTURE_ERROR, completedAt } })
        ]);
        await notifyRunFailure(item.runId);
      }
    }
  }
  const targets = await prisma.gitHubDeliveryTarget.findMany({ where: { deliveryId }, select: { status: true } });
  const status = targets.every((target) => target.status === GitHubDeliveryTargetStatus.IGNORED) ? GitHubDeliveryStatus.IGNORED : GitHubDeliveryStatus.PROCESSED;
  await prisma.gitHubDelivery.update({ where: { id: deliveryId }, data: { status, processedAt: new Date(), safeError: null } });
}

export async function requestSourceAnalysis(input: { runId: string; connectionId: string; requestedById: string | null; trigger: SourceAnalysisTrigger; commitSha: string; parentSha?: string | null }) {
  if (!validCommitSha(input.commitSha) || (input.parentSha && !validCommitSha(input.parentSha))) throw new Error("SOURCE_ANALYSIS_COMMIT_INVALID");
  const connection = await prisma.productRepositoryConnection.findUnique({ where: { id: input.connectionId }, include: { installation: true } });
  if (!connection || connection.status !== GitHubRepositoryConnectionStatus.ACTIVE || !connection.analysisEnabled || connection.installation.status !== "ACTIVE") throw new Error("SOURCE_ANALYSIS_CONNECTION_UNAVAILABLE");
  const existing = await prisma.sourceAnalysis.findUnique({ where: { runId_connectionId_commitSha: { runId: input.runId, connectionId: input.connectionId, commitSha: input.commitSha } } });
  if (existing) return { analysis: existing, created: false };
  const run = await prisma.run.findUnique({ where: { id: input.runId }, select: { id: true, productId: true, initiatedById: true } });
  if (!run || run.productId !== connection.productId) throw new Error("SOURCE_ANALYSIS_RUN_INVALID");
  const analysis = await prisma.$transaction(async (tx) => {
    const created = await tx.sourceAnalysis.create({ data: { runId: run.id, connectionId: connection.id, requestedById: input.requestedById, trigger: input.trigger, commitSha: input.commitSha, parentSha: input.parentSha ?? null, expiresAt: sourceAnalysisExpiresAt() } });
    await tx.auditEvent.create({ data: { actorId: input.requestedById ?? run.initiatedById, action: "SOURCE_ANALYSIS_QUEUED", entityType: "SourceAnalysis", entityId: created.id, details: { runId: run.id, repository: connection.repositoryFullName, commitSha: input.commitSha, trigger: input.trigger } } });
    return created;
  });
  try {
    await enqueueSourceAnalysis({ analysisId: analysis.id });
  } catch {
    const unavailable = await prisma.sourceAnalysis.update({ where: { id: analysis.id }, data: { status: SourceAnalysisStatus.UNAVAILABLE, errorCode: "SOURCE_ANALYSIS_QUEUE_UNAVAILABLE", completedAt: new Date() } });
    return { analysis: unavailable, created: true };
  }
  return { analysis, created: true };
}

export async function requestAutomaticSourceAnalysis(runId: string) {
  const linked = await prisma.run.findUnique({ where: { id: runId }, include: { githubRunLink: true } });
  if (!linked?.githubRunLink || linked.outcome !== RunOutcome.FAILED) return null;
  try {
    return await requestSourceAnalysis({ runId, connectionId: linked.githubRunLink.connectionId, requestedById: null, trigger: SourceAnalysisTrigger.GITHUB_FAILURE, commitSha: linked.githubRunLink.commitSha, parentSha: linked.githubRunLink.parentSha });
  } catch {
    return null;
  }
}
