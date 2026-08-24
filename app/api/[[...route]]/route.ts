import crypto from "node:crypto";
import { AccountStatus, AuthTokenKind, ChangeProposalStatus, DatabaseDiagnosticKind, DatabaseDiagnosticStatus, EvidenceKind, GitHubDeliveryStatus, GitHubRepositoryConnectionStatus, JiraFilingStatus, OrganizationRole, Prisma, RecordingStatus, ReleaseRunItemReason, ReleaseRunItemStatus, ReleaseRunStatus, RunAttemptStatus, RunFailureReason, RunMode, RunOutcome, RunStatus, RunStepStatus, SourceAnalysisTrigger, StepKind, TestDataReusePolicy, TestDataStatus, TestSuggestionKind, TestSuggestionStatus, VariableSource } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { consumeAuthToken, createSession, hashPassword, issueAuthToken, readSession, revokeUserSessions, validPassword, verifyPassword, type SessionUser } from "@/lib/auth";
import { captureRunBrowserSnapshot, closeBrowser, closeRunBrowser, launchRecordingBrowser, launchRunBrowser, replayGuidedRunStep } from "@/lib/browser";
import { dashboardForUser } from "@/lib/dashboard";
import { customerEmailForDiagnostic, customerLookupByEmail } from "@/lib/database-diagnostics";
import { persistRunSnapshot, recordCaptureFailure, signedEvidenceUrl } from "@/lib/evidence";
import { buildJiraDraftWithDiagnostic, isAllowedJiraPriority, JiraAdapterError, jiraCloudIsConfigured, normalizeJiraProjectKey, publicJiraFiling, validateJiraProject } from "@/lib/jira";
import { notifyChangeProposalResolved, notifyChangeProposalSubmitted, notifyRunFailure } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { pilotReadiness } from "@/lib/pilot-readiness";
import { enqueueAutoRun, enqueueJiraFiling } from "@/lib/queue";
import { enqueueGitHubDelivery } from "@/lib/queue";
import { GitHubIntegrationError, githubIsConfigured, normalizeBranches, parseGitHubPushDelivery, repositoryDetailsForApp, validBranchName, verifyGitHubSignature } from "@/lib/github";
import { requestSourceAnalysis } from "@/lib/github-runs";
import { canonicalVariableName, decryptVariableValue, encryptVariableValue, isSecretLikeVariable, maskedVariableValue, variablePlaceholder } from "@/lib/variables";
import { markReleaseRunItemQueueFailure, refreshReleaseRun, syncReleaseRunItemForRun } from "@/lib/releases";
import { proposedValueIsSafe, suggestionsForSteps, type SuggestionKind } from "@/lib/suggestions";
import { sendAccountLink } from "@/lib/account-email";
import { isSearchSection, searchWorkspace } from "@/lib/global-search";

type Context = { params: Promise<{ route?: string[] }> };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

async function releaseBrowserAfterRecording() {
  try {
    await closeBrowser();
  } catch (error) {
    console.error("Sentinel browser cleanup failure", error);
  }
}

async function captureRunEvidence(runId: string, label: "START" | "END" | "FAILURE" | "STEP", runStepResultId?: string) {
  try {
    const snapshot = await captureRunBrowserSnapshot(runId);
    await persistRunSnapshot({ ...snapshot, runId, runStepResultId, label, includeScreenshot: label !== "STEP" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evidence capture failed.";
    try {
      await recordCaptureFailure(runId, message, runStepResultId);
    } catch (recordError) {
      console.error("Sentinel could not persist the evidence capture failure", recordError);
    }
  }
}
const recorderJson = (body: unknown, status = 200) => NextResponse.json(body, {
  status,
  headers: {
    "access-control-allow-origin": process.env.RECORDER_ORIGIN ?? "http://demo-target",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-recording-token"
  }
});

async function currentUser(): Promise<SessionUser | null> {
  return await readSession((await cookies()).get("sentinel_session")?.value);
}

async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

async function assertProductMember(userId: string, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { organizationId: true } });
  if (!product?.organizationId) throw new Error("FORBIDDEN");
  const organizationMembership = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: product.organizationId, userId } } });
  if (!organizationMembership) throw new Error("FORBIDDEN");
  if (organizationMembership.role === OrganizationRole.ADMIN) return;
  const membership = await prisma.productMembership.findUnique({ where: { userId_productId: { userId, productId } } });
  if (!membership) throw new Error("FORBIDDEN");
}

async function assertProductCreator(userId: string, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, createdById: true, organizationId: true } });
  if (!product) return null;
  if (!product.organizationId) throw new Error("FORBIDDEN");
  const membership = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: product.organizationId, userId } } });
  if (membership?.role !== OrganizationRole.ADMIN) throw new Error("FORBIDDEN");
  return product;
}

async function assertReleaseMember(userId: string, releaseId: string) {
  const release = await prisma.release.findUnique({ where: { id: releaseId }, include: { tests: { include: { testCase: { select: { productId: true } } } } } });
  if (!release) return null;
  for (const item of release.tests) await assertProductMember(userId, item.testCase.productId);
  return release;
}

async function assertNotificationAccess(userId: string, notification: { productId: string | null; runId: string | null; releaseRunId: string | null }) {
  let productId = notification.productId;
  if (!productId && notification.runId) {
    const run = await prisma.run.findUnique({ where: { id: notification.runId }, select: { productId: true } });
    productId = run?.productId ?? null;
  }
  if (productId) {
    await assertProductMember(userId, productId);
    return;
  }
  if (notification.releaseRunId) {
    const releaseRun = await prisma.releaseRun.findUnique({ where: { id: notification.releaseRunId }, select: { releaseId: true } });
    if (!releaseRun || !(await assertReleaseMember(userId, releaseRun.releaseId))) throw new Error("FORBIDDEN");
    return;
  }
  throw new Error("FORBIDDEN");
}

function publicNotification(notification: {
  id: string;
  type: string;
  deliveryStatus: string;
  deliveryAttempts: number;
  deliveryError: string | null;
  createdAt: Date;
  sentAt: Date | null;
  readAt: Date | null;
  product: { name: string } | null;
  run: { id: string; outcome: string | null; testCase: { name: string } } | null;
  releaseRun: { release: { id: string; name: string }; readiness: string } | null;
  changeProposal: { id: string; status: string; testCase: { name: string } } | null;
}) {
  return {
    id: notification.id,
    type: notification.type,
    deliveryStatus: notification.deliveryStatus,
    deliveryAttempts: notification.deliveryAttempts,
    deliveryError: notification.deliveryError,
    createdAt: notification.createdAt,
    sentAt: notification.sentAt,
    readAt: notification.readAt,
    productName: notification.product?.name ?? null,
    run: notification.run ? { id: notification.run.id, name: notification.run.testCase.name, outcome: notification.run.outcome } : null,
    release: notification.releaseRun ? { id: notification.releaseRun.release.id, name: notification.releaseRun.release.name, readiness: notification.releaseRun.readiness } : null,
    changeProposal: notification.changeProposal ? { id: notification.changeProposal.id, status: notification.changeProposal.status, testCaseName: notification.changeProposal.testCase.name } : null
  };
}

type RunBindingInput = { source?: unknown; dataSetId?: unknown; value?: unknown };

function bindingInputs(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, RunBindingInput> : {};
}

function publicVariable(variable: { name: string; staticValueEncrypted: string | null }) {
  return { name: variable.name, hasStaticDefault: Boolean(variable.staticValueEncrypted), maskedValue: variable.staticValueEncrypted ? maskedVariableValue() : null };
}

async function updateReservedDataSet(runId: string, outcome: RunOutcome) {
  if (outcome === RunOutcome.PASSED) {
    await prisma.$transaction([
      prisma.testDataSet.updateMany({
        where: { reservedByRunId: runId, status: TestDataStatus.RESERVED, reusePolicy: TestDataReusePolicy.REUSABLE },
        data: { status: TestDataStatus.SAFE, reservedByRunId: null }
      }),
      prisma.testDataSet.updateMany({
        where: { reservedByRunId: runId, status: TestDataStatus.RESERVED, reusePolicy: TestDataReusePolicy.SINGLE_USE },
        data: { status: TestDataStatus.CONSUMED, reservedByRunId: null }
      })
    ]);
    return;
  }
  await prisma.testDataSet.updateMany({
    where: { reservedByRunId: runId, status: TestDataStatus.RESERVED },
    data: { status: TestDataStatus.SAFE, reservedByRunId: null }
  });
}

async function createRunBindings(tx: Prisma.TransactionClient, runId: string, productId: string, variables: Array<{ id: string; name: string; staticValueEncrypted: string | null }>, rawInputs: unknown) {
  const inputs = bindingInputs(rawInputs);
  const selectedDataSetIds = new Set<string>();
  const resolved: Array<{ name: string; source: VariableSource; value: string; testVariableId: string; dataSetId?: string }> = [];

  for (const variable of variables) {
    const input = inputs[variable.name];
    const source = input?.source;
    if (source === "STATIC") {
      if (!variable.staticValueEncrypted) throw new Error(`VARIABLE_BINDING_REQUIRED:${variable.name}`);
      resolved.push({ name: variable.name, source: VariableSource.STATIC, value: decryptVariableValue(variable.staticValueEncrypted), testVariableId: variable.id });
      continue;
    }
    if (source === "MANUAL") {
      if (typeof input?.value !== "string" || !input.value.trim()) throw new Error(`VARIABLE_VALUE_REQUIRED:${variable.name}`);
      if (isSecretLikeVariable(variable.name, input.value)) throw new Error("VARIABLE_SECRET_REJECTED");
      resolved.push({ name: variable.name, source: VariableSource.MANUAL, value: input.value, testVariableId: variable.id });
      continue;
    }
    if (source === "POOL") {
      if (typeof input?.dataSetId !== "string") throw new Error(`VARIABLE_DATA_SET_REQUIRED:${variable.name}`);
      const dataSet = await tx.testDataSet.findFirst({ where: { id: input.dataSetId, productId, status: TestDataStatus.SAFE } });
      if (!dataSet) throw new Error("VARIABLE_DATA_SET_UNAVAILABLE");
      const fields = JSON.parse(decryptVariableValue(dataSet.encryptedFields)) as Record<string, string>;
      const value = fields[variable.name];
      if (typeof value !== "string" || !value) throw new Error(`VARIABLE_DATA_SET_FIELD_MISSING:${variable.name}`);
      if (isSecretLikeVariable(variable.name, value)) throw new Error("VARIABLE_SECRET_REJECTED");
      selectedDataSetIds.add(dataSet.id);
      resolved.push({ name: variable.name, source: VariableSource.POOL, value, testVariableId: variable.id, dataSetId: dataSet.id });
      continue;
    }
    throw new Error(`VARIABLE_BINDING_REQUIRED:${variable.name}`);
  }

  for (const dataSetId of selectedDataSetIds) {
    const reservation = await tx.testDataSet.updateMany({ where: { id: dataSetId, productId, status: TestDataStatus.SAFE, reservedByRunId: null }, data: { status: TestDataStatus.RESERVED, reservedByRunId: runId } });
    if (reservation.count !== 1) throw new Error("VARIABLE_DATA_SET_UNAVAILABLE");
  }
  if (resolved.length) await tx.runVariableBinding.createMany({ data: resolved.map((binding) => ({ runId, name: binding.name, source: binding.source, valueEncrypted: encryptVariableValue(binding.value), testVariableId: binding.testVariableId, dataSetId: binding.dataSetId })) });
}

async function migrateLegacyVariables(version: { id: string; steps: Array<{ id: string; variableName: string | null; value: string | null; isRedacted: boolean }> }) {
  const grouped = new Map<string, Array<{ id: string; value: string | null }>>();
  for (const step of version.steps) {
    if (!step.variableName || step.isRedacted) continue;
    const name = canonicalVariableName(step.variableName);
    grouped.set(name, [...(grouped.get(name) ?? []), { id: step.id, value: step.value }]);
  }
  if (!grouped.size) return prisma.testVariable.findMany({ where: { testCaseVersionId: version.id } });
  return prisma.$transaction(async (tx) => {
    for (const [name, steps] of grouped) {
      const values = [...new Set(steps.map((step) => step.value).filter((value): value is string => Boolean(value) && value !== variablePlaceholder(name)))];
      const staticValueEncrypted = values.length === 1 && !isSecretLikeVariable(name, values[0]) ? encryptVariableValue(values[0]) : null;
      await tx.testVariable.upsert({ where: { testCaseVersionId_name: { testCaseVersionId: version.id, name } }, create: { testCaseVersionId: version.id, name, staticValueEncrypted }, update: {} });
      await tx.testStep.updateMany({ where: { id: { in: steps.map((step) => step.id) } }, data: { variableName: name, value: variablePlaceholder(name) } });
    }
    return tx.testVariable.findMany({ where: { testCaseVersionId: version.id } });
  });
}

function allowedTarget(url: string) {
  return url === (process.env.DEMO_TARGET_URL ?? "http://demo-target");
}

function featureLabelNames(value: unknown) {
  if (!Array.isArray(value) || value.length > 20) throw new Error("FEATURE_LABELS_INVALID");
  const names = value.map((item) => typeof item === "string" ? item.trim().replace(/\s+/g, " ") : "");
  if (names.some((name) => !name || name.length > 64)) throw new Error("FEATURE_LABELS_INVALID");
  const deduplicated = [...new Set(names.map((name) => name.toLocaleLowerCase()))];
  if (deduplicated.length !== names.length) throw new Error("FEATURE_LABELS_INVALID");
  return names;
}

function optionalSafeText(value: unknown, code: string) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length > 4_000) throw new Error(code);
  return value.trim() || null;
}

function suggestionText(value: unknown, code: string) {
  if (typeof value !== "string") throw new Error(code);
  const text = value.trim();
  if (!text || text.length > 240) throw new Error(code);
  return text;
}

function suggestionFieldName(target: unknown) {
  if (!target || typeof target !== "object" || Array.isArray(target)) return "";
  const name = (target as { name?: unknown }).name;
  return typeof name === "string" ? name : "";
}

function publicSuggestion(suggestion: {
  id: string;
  kind: TestSuggestionKind;
  status: TestSuggestionStatus;
  title: string;
  rationale: string;
  expectedOutcome: string;
  proposedValue: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  dismissedAt: Date | null;
  product: { id: string; name: string };
  sourceTestCase: { id: string; name: string };
  sourceVersion: { id: string; version: number };
  sourceStep: { id: string; order: number; kind: StepKind; target: Prisma.JsonValue };
  approvedTestCase: { id: string; name: string } | null;
}) {
  return {
    id: suggestion.id,
    kind: suggestion.kind,
    status: suggestion.status,
    title: suggestion.title,
    rationale: suggestion.rationale,
    expectedOutcome: suggestion.expectedOutcome,
    proposedValue: suggestion.proposedValue,
    createdAt: suggestion.createdAt,
    updatedAt: suggestion.updatedAt,
    approvedAt: suggestion.approvedAt,
    dismissedAt: suggestion.dismissedAt,
    product: suggestion.product,
    sourceTestCase: suggestion.sourceTestCase,
    sourceVersion: suggestion.sourceVersion,
    sourceStep: { id: suggestion.sourceStep.id, order: suggestion.sourceStep.order, kind: suggestion.sourceStep.kind, target: suggestion.sourceStep.target },
    approvedTestCase: suggestion.approvedTestCase
  };
}

async function route(request: Request, context: Context) {
  const path = (await context.params).route ?? [];
  if (request.method === "POST" && path.join("/") === "internal/github/webhooks") {
    if (!githubIsConfigured()) return json({ error: "GitHub App integration is not configured." }, 503);
    const rawBody = await request.text();
    if (!verifyGitHubSignature(rawBody, request.headers.get("x-hub-signature-256"))) return json({ error: "GitHub webhook signature is invalid." }, 401);
    const event = request.headers.get("x-github-event");
    const deliveryHeader = request.headers.get("x-github-delivery");
    if (event !== "push") return json({ accepted: true, ignored: true }, 202);
    let parsed;
    try {
      parsed = parseGitHubPushDelivery(rawBody, deliveryHeader, event);
    } catch (error) {
      if (error instanceof GitHubIntegrationError) return json({ error: error.message }, 400);
      return json({ error: "GitHub webhook payload is invalid." }, 400);
    }
    const existing = await prisma.gitHubDelivery.findUnique({ where: { deliveryId: parsed.deliveryId } });
    if (existing?.status === GitHubDeliveryStatus.PROCESSED || existing?.status === GitHubDeliveryStatus.IGNORED) return json({ accepted: true, duplicate: true }, 202);
    const delivery = existing ?? await prisma.gitHubDelivery.create({ data: { deliveryId: parsed.deliveryId, event: parsed.event, installationNumber: parsed.installationId, repositoryId: parsed.repositoryId, repositoryFullName: parsed.repositoryFullName, ref: parsed.ref, branch: parsed.branch, beforeSha: parsed.beforeSha, afterSha: parsed.afterSha } });
    try {
      await enqueueGitHubDelivery({ deliveryId: delivery.id });
      await prisma.gitHubDelivery.update({ where: { id: delivery.id }, data: { status: GitHubDeliveryStatus.QUEUED, safeError: null } });
      return json({ accepted: true, duplicate: Boolean(existing) }, 202);
    } catch {
      await prisma.gitHubDelivery.update({ where: { id: delivery.id }, data: { status: GitHubDeliveryStatus.FAILED, safeError: "DELIVERY_QUEUE_UNAVAILABLE" } });
      return json({ error: "GitHub delivery queue is temporarily unavailable." }, 503);
    }
  }
  const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));

  if (request.method === "OPTIONS" && path.join("/") === "internal/events") return recorderJson({});

  if (request.method === "POST" && (path.join("/") === "auth/login" || path.join("/") === "auth/dev-login")) {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    if (!user || user.accountStatus !== AccountStatus.ACTIVE || !(await verifyPassword(password, user.passwordHash))) return json({ error: "Invalid email or password." }, 401);
    const memberships = await prisma.organizationMember.findMany({ where: { userId: user.id }, include: { organization: { select: { id: true, name: true } } }, orderBy: { organization: { name: "asc" } } });
    const requestedOrganizationId = typeof body.organizationId === "string" ? body.organizationId : memberships[0]?.organizationId;
    const membership = memberships.find((item) => item.organizationId === requestedOrganizationId);
    if (!membership) return json({ error: "This account has no active organization access." }, 403);
    const token = await createSession(user.id, membership.organizationId);
    const response = json({ user: { id: user.id, email: user.email, displayName: user.displayName, role: membership.role, organization: membership.organization }, organizations: memberships.map((item) => ({ ...item.organization, role: item.role })) });
    response.cookies.set("sentinel_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
    return response;
  }

  if (request.method === "POST" && path.join("/") === "auth/logout") {
    const raw = (await cookies()).get("sentinel_session")?.value;
    const user = await currentUser();
    if (user && raw) await prisma.userSession.deleteMany({ where: { userId: user.id, tokenHash: hash(raw) } });
    const response = json({ signedOut: true });
    response.cookies.set("sentinel_session", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  }

  if (request.method === "POST" && path.join("/") === "auth/password-reset/request") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    if (user && user.accountStatus === AccountStatus.ACTIVE) {
      const token = await issueAuthToken(user.id, AuthTokenKind.PASSWORD_RESET);
      await prisma.auditEvent.create({ data: { actorId: user.id, action: "PASSWORD_RESET_REQUESTED", entityType: "User", entityId: user.id } });
      await sendAccountLink({ to: user.email, kind: "reset", token });
    }
    return json({ message: "If the account exists, a password reset link has been sent." });
  }

  if (request.method === "POST" && path.join("/") === "auth/password-reset/complete") {
    const token = typeof body.token === "string" ? body.token : "";
    if (!validPassword(body.password)) return json({ error: "Use a password of at least 12 characters." }, 400);
    const reset = await consumeAuthToken(token, AuthTokenKind.PASSWORD_RESET);
    if (!reset) return json({ error: "This password reset link is invalid or has expired." }, 400);
    await prisma.$transaction([prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(body.password) } }), prisma.userSession.deleteMany({ where: { userId: reset.userId } }), prisma.auditEvent.create({ data: { actorId: reset.userId, action: "PASSWORD_RESET_COMPLETED", entityType: "User", entityId: reset.userId } })]);
    return json({ reset: true });
  }

  if (request.method === "POST" && path.join("/") === "auth/invitations/accept") {
    const token = typeof body.token === "string" ? body.token : "";
    if (!validPassword(body.password)) return json({ error: "Use a password of at least 12 characters." }, 400);
    const invite = await consumeAuthToken(token, AuthTokenKind.INVITE);
    if (!invite?.organizationId) return json({ error: "This invitation link is invalid or has expired." }, 400);
    await prisma.$transaction([prisma.user.update({ where: { id: invite.userId }, data: { passwordHash: await hashPassword(body.password), accountStatus: AccountStatus.ACTIVE } }), prisma.auditEvent.create({ data: { actorId: invite.userId, action: "INVITATION_ACCEPTED", entityType: "Organization", entityId: invite.organizationId } })]);
    return json({ accepted: true });
  }

  if (request.method === "POST" && path.join("/") === "internal/events") {
    const token = request.headers.get("x-recording-token");
    if (!token) return recorderJson({ error: "Missing recording token." }, 401);
    const recording = await prisma.recordingSession.findUnique({ where: { tokenHash: hash(token) } });
    if (!recording || recording.status !== RecordingStatus.ACTIVE) return recorderJson({ error: "Inactive recording." }, 401);
    const kind = body.kind as StepKind;
    if (!Object.values(StepKind).includes(kind)) return recorderJson({ error: "Unsupported step." }, 400);
    const target = (body.target ?? {}) as Prisma.InputJsonValue;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const prior = await prisma.recordedStep.findFirst({ where: { recordingSessionId: recording.id }, orderBy: { order: "desc" } });
      if (prior && prior.kind === kind && JSON.stringify(prior.target) === JSON.stringify(target) && kind !== StepKind.TEXT_ENTRY) return recorderJson({ skipped: true });
      try {
        const step = await prisma.recordedStep.create({
          data: { recordingSessionId: recording.id, order: (prior?.order ?? 0) + 1, kind, timestamp: new Date(body.timestamp ?? Date.now()), target, value: body.value ?? null, isRedacted: Boolean(body.isRedacted) }
        });
        return recorderJson({ step });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || attempt === 2) throw error;
      }
    }
    return recorderJson({ error: "Unable to persist this recording event." }, 409);
  }

  try {
    const user = await requireUser();
    if (request.method === "GET" && path.join("/") === "auth/me") {
      return json({ user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, organizationId: user.organizationId } });
    }
    if (request.method === "GET" && path.join("/") === "search") {
      const searchParams = new URL(request.url).searchParams;
      const query = searchParams.get("q") ?? "";
      const section = searchParams.get("section");
      if (!query.trim()) return json({ error: "Enter a search term." }, 400);
      if (query.trim().length > 80) return json({ error: "Search terms must be 80 characters or fewer." }, 400);
      return json(await searchWorkspace(user, query, isSearchSection(section) ? section : null));
    }
    if (path[0] === "admin") {
      if (user.role !== OrganizationRole.ADMIN) return json({ error: "Organization administration is restricted to Admins." }, 403);
      if (request.method === "GET" && path[1] === "members") {
        const members = await prisma.organizationMember.findMany({
          where: { organizationId: user.organizationId },
          include: { user: { select: { id: true, email: true, displayName: true, accountStatus: true, createdAt: true } } },
          orderBy: { user: { displayName: "asc" } }
        });
        const productMemberships = await prisma.productMembership.findMany({ where: { product: { organizationId: user.organizationId } }, include: { product: { select: { id: true, name: true } } } });
        return json(members.map((member) => ({ ...member.user, role: member.role, products: productMemberships.filter((item) => item.userId === member.userId).map((item) => item.product) })));
      }
      if (request.method === "POST" && path[1] === "members") {
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
        const role = Object.values(OrganizationRole).includes(body.role) ? body.role as OrganizationRole : null;
        const productIds = Array.isArray(body.productIds) ? body.productIds.filter((id: unknown): id is string => typeof id === "string") : [];
        if (!email || !displayName || !role) return json({ error: "Name, email, and role are required." }, 400);
        const products = await prisma.product.findMany({ where: { id: { in: productIds }, organizationId: user.organizationId }, select: { id: true } });
        if (products.length !== productIds.length) return json({ error: "Choose Products in this organization only." }, 400);
        const result = await prisma.$transaction(async (tx) => {
          const existing = await tx.user.findUnique({ where: { email } });
          const account = existing ?? await tx.user.create({ data: { email, displayName, accountStatus: AccountStatus.DISABLED } });
          await tx.organizationMember.upsert({ where: { organizationId_userId: { organizationId: user.organizationId, userId: account.id } }, update: { role }, create: { organizationId: user.organizationId, userId: account.id, role } });
          await tx.productMembership.createMany({ data: products.map((product) => ({ userId: account.id, productId: product.id })), skipDuplicates: true });
          await tx.auditEvent.create({ data: { actorId: user.id, action: existing ? "ORGANIZATION_MEMBER_GRANTED" : "ORGANIZATION_INVITED", entityType: "User", entityId: account.id, details: { organizationId: user.organizationId, role, productIds } } });
          return { account, existing: Boolean(existing) };
        });
        if (!result.existing) {
          const token = await issueAuthToken(result.account.id, AuthTokenKind.INVITE, user.organizationId);
          await sendAccountLink({ to: result.account.email, kind: "invite", token, organizationName: (await prisma.organization.findUnique({ where: { id: user.organizationId }, select: { name: true } }))?.name });
        }
        return json({ id: result.account.id, existingAccount: result.existing }, 201);
      }
      if (request.method === "PATCH" && path[1] === "members" && path[2]) {
        const member = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: user.organizationId, userId: path[2] } }, include: { user: true } });
        if (!member) return json({ error: "Organization member not found." }, 404);
        const wantsRole = Object.values(OrganizationRole).includes(body.role) ? body.role as OrganizationRole : undefined;
        const wantsStatus = Object.values(AccountStatus).includes(body.accountStatus) ? body.accountStatus as AccountStatus : undefined;
        if (wantsRole === OrganizationRole.ADMIN || wantsStatus === AccountStatus.DISABLED) {
          const activeAdmins = await prisma.organizationMember.count({ where: { organizationId: user.organizationId, role: OrganizationRole.ADMIN, user: { accountStatus: AccountStatus.ACTIVE } } });
          if (member.role === OrganizationRole.ADMIN && member.user.accountStatus === AccountStatus.ACTIVE && activeAdmins <= 1 && (wantsRole && wantsRole !== OrganizationRole.ADMIN || wantsStatus === AccountStatus.DISABLED)) return json({ error: "An organization must retain one active Admin." }, 409);
        }
        await prisma.$transaction(async (tx) => {
          if (wantsRole) await tx.organizationMember.update({ where: { organizationId_userId: { organizationId: user.organizationId, userId: member.userId } }, data: { role: wantsRole } });
          if (wantsStatus) await tx.user.update({ where: { id: member.userId }, data: { accountStatus: wantsStatus } });
          if (Array.isArray(body.productIds)) {
            const ids = body.productIds.filter((id: unknown): id is string => typeof id === "string");
            const products = await tx.product.findMany({ where: { id: { in: ids }, organizationId: user.organizationId }, select: { id: true } });
            if (products.length !== ids.length) throw new Error("PRODUCT_SCOPE_INVALID");
            await tx.productMembership.deleteMany({ where: { userId: member.userId, product: { organizationId: user.organizationId } } });
            await tx.productMembership.createMany({ data: ids.map((productId: string) => ({ userId: member.userId, productId })) });
          }
          await tx.auditEvent.create({ data: { actorId: user.id, action: "ORGANIZATION_MEMBER_UPDATED", entityType: "User", entityId: member.userId, details: { role: wantsRole, accountStatus: wantsStatus, productIds: body.productIds } } });
        });
        if (wantsStatus === AccountStatus.DISABLED || wantsRole || Array.isArray(body.productIds)) await revokeUserSessions(member.userId);
        return json({ updated: true });
      }
    }
    if (request.method === "GET" && path.join("/") === "dashboard") {
      const productId = new URL(request.url).searchParams.get("productId") ?? undefined;
      return json(await dashboardForUser(user.id, productId, new Date(), user.organizationId, user.role));
    }
    if (request.method === "GET" && path.join("/") === "pilot-readiness") {
      return json(await pilotReadiness());
    }
    if (request.method === "GET" && path.join("/") === "notifications") {
      const unreadOnly = new URL(request.url).searchParams.get("filter") === "unread";
      const notifications = await prisma.notification.findMany({
        where: { recipientId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
        include: {
          product: { select: { name: true } },
          run: { select: { id: true, productId: true, outcome: true, testCase: { select: { name: true } } } },
          releaseRun: { select: { releaseId: true, readiness: true, release: { select: { id: true, name: true } } } },
          changeProposal: { select: { id: true, status: true, testCase: { select: { name: true } } } }
        },
        orderBy: { createdAt: "desc" }
      });
      const permitted = [];
      for (const notification of notifications) {
        try {
          await assertNotificationAccess(user.id, notification);
          permitted.push(publicNotification(notification));
        } catch {
          // Notifications remain invisible when current Product access has been removed.
        }
      }
      return json(permitted);
    }
    if (request.method === "PATCH" && path[0] === "notifications" && path[1] && path[2] === "read") {
      const notification = await prisma.notification.findFirst({ where: { id: path[1], recipientId: user.id } });
      if (!notification) return json({ error: "Notification not found." }, 404);
      await assertNotificationAccess(user.id, notification);
      if (!notification.readAt) {
        const readAt = new Date();
        await prisma.$transaction([
          prisma.notification.update({ where: { id: notification.id }, data: { readAt } }),
          prisma.auditEvent.create({ data: { actorId: user.id, action: "NOTIFICATION_READ", entityType: "Notification", entityId: notification.id } })
        ]);
      }
      return json({ id: notification.id, read: true });
    }
    if (request.method === "POST" && path.join("/") === "notifications/read-all") {
      const unread = await prisma.notification.findMany({ where: { recipientId: user.id, readAt: null } });
      const permittedIds: string[] = [];
      for (const notification of unread) {
        try {
          await assertNotificationAccess(user.id, notification);
          permittedIds.push(notification.id);
        } catch {
          // Do not disclose notifications whose underlying Product membership was removed.
        }
      }
      if (permittedIds.length) {
        const readAt = new Date();
        await prisma.$transaction([
          prisma.notification.updateMany({ where: { id: { in: permittedIds }, readAt: null }, data: { readAt } }),
          ...permittedIds.map((id) => prisma.auditEvent.create({ data: { actorId: user.id, action: "NOTIFICATION_READ", entityType: "Notification", entityId: id, details: { bulk: true } } }))
        ]);
      }
      return json({ count: permittedIds.length });
    }
    if (request.method === "GET" && path.join("/") === "products") {
      return json(await prisma.product.findMany({ where: { organizationId: user.organizationId, ...(user.role === OrganizationRole.ADMIN ? {} : { memberships: { some: { userId: user.id } } }) }, orderBy: { name: "asc" } }));
    }
    if (request.method === "POST" && path.join("/") === "products") {
      if (user.role === OrganizationRole.TESTER) return json({ error: "Only Admins and Managers can create Products." }, 403);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return json({ error: "Product name is required." }, 400);
      try {
        const product = await prisma.product.create({ data: { name, createdById: user.id, organizationId: user.organizationId, memberships: { create: { userId: user.id } } } });
        return json(product, 201);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return json({ error: "You already have a Product with this name." }, 409);
        }
        throw error;
      }
    }
    if (path[0] === "products" && path[1] && path[2] === "github") {
      const product = await prisma.product.findUnique({ where: { id: path[1] }, select: { id: true, name: true, organizationId: true } });
      if (!product) return json({ error: "Product not found." }, 404);
      await assertProductMember(user.id, product.id);
      const canConfigure = user.role === OrganizationRole.ADMIN || user.role === OrganizationRole.MANAGER;
      if (request.method === "GET" && path.length === 3) {
        const connections = await prisma.productRepositoryConnection.findMany({
          where: { productId: product.id },
          include: { installation: { select: { accountLogin: true, accountType: true, status: true } }, testCaseLinks: { select: { testCaseId: true } } },
          orderBy: { createdAt: "asc" }
        });
        return json({
          available: githubIsConfigured(),
          canConfigure,
          connections: connections.map((connection) => ({ id: connection.id, label: connection.label, repositoryFullName: connection.repositoryFullName, repositoryId: connection.repositoryId, defaultBranch: connection.defaultBranch, branchAllowlist: connection.branchAllowlist, status: connection.status, analysisEnabled: connection.analysisEnabled, installation: connection.installation, linkedTestCaseCount: connection.testCaseLinks.length, createdAt: connection.createdAt, updatedAt: connection.updatedAt }))
        });
      }
      if (request.method === "GET" && path[3] === "activity") {
        const activity = await prisma.gitHubDeliveryTarget.findMany({
          where: { connection: { productId: product.id } },
          include: {
            connection: { select: { id: true, label: true, repositoryFullName: true } },
            delivery: { select: { deliveryId: true, branch: true, afterSha: true, status: true, receivedAt: true, processedAt: true } },
            runLinks: { include: { run: { select: { id: true, status: true, outcome: true, testCase: { select: { name: true } }, sourceAnalyses: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 } } } } }
          },
          orderBy: { createdAt: "desc" },
          take: 100
        });
        return json(activity.map((target) => ({ id: target.id, status: target.status, decisionReason: target.decisionReason, queuedRunCount: target.queuedRunCount, excludedTests: target.excludedTests, createdAt: target.createdAt, connection: target.connection, delivery: target.delivery, runs: target.runLinks.map((link) => ({ id: link.run.id, status: link.run.status, outcome: link.run.outcome, testCaseName: link.run.testCase.name, sourceAnalysisStatus: link.run.sourceAnalyses[0]?.status ?? null })) })));
      }
      if (request.method === "POST" && path[3] === "connections") {
        if (!canConfigure) return json({ error: "Only Admins and assigned Managers can configure GitHub repositories." }, 403);
        if (!githubIsConfigured()) return json({ error: "GitHub App integration is not configured for this Sentinel deployment." }, 503);
        const repositoryFullName = typeof body.repositoryFullName === "string" ? body.repositoryFullName.trim() : "";
        const label = typeof body.label === "string" ? body.label.trim().replace(/\s+/g, " ") : "";
        if (!label || label.length > 64) return json({ error: "Use a repository label of up to 64 characters." }, 400);
        let details: Awaited<ReturnType<typeof repositoryDetailsForApp>>;
        let branchAllowlist: string[];
        try {
          details = await repositoryDetailsForApp(repositoryFullName);
          const requestedDefaultBranch = typeof body.defaultBranch === "string" ? body.defaultBranch.trim() : details.defaultBranch;
          if (!validBranchName(requestedDefaultBranch)) return json({ error: "The default branch is invalid." }, 400);
          branchAllowlist = normalizeBranches(Array.isArray(body.branchAllowlist) && body.branchAllowlist.length ? body.branchAllowlist : [requestedDefaultBranch]);
          if (!branchAllowlist.includes(requestedDefaultBranch)) branchAllowlist = [requestedDefaultBranch, ...branchAllowlist];
          const connection = await prisma.$transaction(async (tx) => {
            const currentInstallation = await tx.gitHubInstallation.findUnique({ where: { installationId: details.installationId } });
            if (currentInstallation && currentInstallation.organizationId !== product.organizationId) throw new Error("GITHUB_INSTALLATION_ORGANIZATION_CONFLICT");
            const installation = currentInstallation ?? await tx.gitHubInstallation.create({ data: { organizationId: product.organizationId!, installationId: details.installationId, accountLogin: details.installationAccountLogin, accountType: details.installationAccountType } });
            const created = await tx.productRepositoryConnection.create({ data: { productId: product.id, installationId: installation.id, repositoryId: details.repositoryId, repositoryFullName: details.repositoryFullName, label, defaultBranch: requestedDefaultBranch, branchAllowlist, analysisEnabled: body.analysisEnabled !== false } });
            await tx.auditEvent.create({ data: { actorId: user.id, action: "GITHUB_REPOSITORY_CONNECTED", entityType: "ProductRepositoryConnection", entityId: created.id, details: { productId: product.id, repository: created.repositoryFullName, label: created.label, branches: created.branchAllowlist } } });
            return created;
          });
          return json(connection, 201);
        } catch (error) {
          if (error instanceof GitHubIntegrationError) return json({ error: error.message }, error.transient ? 503 : 400);
          if (error instanceof Error && error.message === "GITHUB_INSTALLATION_ORGANIZATION_CONFLICT") return json({ error: "This GitHub App installation already belongs to another Sentinel organization." }, 409);
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return json({ error: "This repository is already connected to this Product." }, 409);
          throw error;
        }
      }
      if ((request.method === "PATCH" || request.method === "DELETE") && path[3] === "connections" && path[4]) {
        if (!canConfigure) return json({ error: "Only Admins and assigned Managers can configure GitHub repositories." }, 403);
        const connection = await prisma.productRepositoryConnection.findFirst({ where: { id: path[4], productId: product.id } });
        if (!connection) return json({ error: "GitHub repository connection not found." }, 404);
        if (request.method === "DELETE") {
          const disconnected = await prisma.$transaction(async (tx) => {
            const updated = await tx.productRepositoryConnection.update({ where: { id: connection.id }, data: { status: GitHubRepositoryConnectionStatus.DISCONNECTED } });
            await tx.auditEvent.create({ data: { actorId: user.id, action: "GITHUB_REPOSITORY_DISCONNECTED", entityType: "ProductRepositoryConnection", entityId: connection.id, details: { productId: product.id, repository: connection.repositoryFullName } } });
            return updated;
          });
          return json(disconnected);
        }
        const label = body.label === undefined ? connection.label : typeof body.label === "string" ? body.label.trim().replace(/\s+/g, " ") : "";
        const defaultBranch = body.defaultBranch === undefined ? connection.defaultBranch : typeof body.defaultBranch === "string" ? body.defaultBranch.trim() : "";
        if (!label || label.length > 64 || !validBranchName(defaultBranch)) return json({ error: "Use a valid repository label and default branch." }, 400);
        let branchAllowlist: string[];
        try {
          branchAllowlist = body.branchAllowlist === undefined ? connection.branchAllowlist : normalizeBranches(body.branchAllowlist);
        } catch (error) {
          if (error instanceof GitHubIntegrationError) return json({ error: error.message }, 400);
          throw error;
        }
        if (!branchAllowlist.includes(defaultBranch)) branchAllowlist = [defaultBranch, ...branchAllowlist];
        const status = body.status === undefined ? connection.status : body.status === "ACTIVE" ? GitHubRepositoryConnectionStatus.ACTIVE : body.status === "PAUSED" ? GitHubRepositoryConnectionStatus.PAUSED : null;
        if (!status) return json({ error: "Repository state must be ACTIVE or PAUSED." }, 400);
        const updated = await prisma.$transaction(async (tx) => {
          const changed = await tx.productRepositoryConnection.update({ where: { id: connection.id }, data: { label, defaultBranch, branchAllowlist, status, analysisEnabled: typeof body.analysisEnabled === "boolean" ? body.analysisEnabled : connection.analysisEnabled } });
          await tx.auditEvent.create({ data: { actorId: user.id, action: "GITHUB_REPOSITORY_UPDATED", entityType: "ProductRepositoryConnection", entityId: connection.id, details: { productId: product.id, status: changed.status, branches: changed.branchAllowlist, analysisEnabled: changed.analysisEnabled } } });
          return changed;
        });
        return json(updated);
      }
    }
    if (path[0] === "products" && path[1] && path[2] === "jira") {
      const product = await prisma.product.findUnique({ where: { id: path[1] }, include: { jiraConfig: true } });
      if (!product) return json({ error: "Product not found." }, 404);
      await assertProductMember(user.id, product.id);
      if (request.method === "GET") {
        return json({ projectKey: product.jiraConfig?.projectKey ?? null, validatedAt: product.jiraConfig?.validatedAt ?? null, canConfigure: user.role === OrganizationRole.ADMIN || user.role === OrganizationRole.MANAGER, available: jiraCloudIsConfigured() });
      }
      if (request.method === "PUT") {
        if (user.role === OrganizationRole.TESTER) return json({ error: "Only Admins and assigned Managers can configure Jira." }, 403);
        const projectKey = typeof body.projectKey === "string" ? body.projectKey : "";
        const normalized = normalizeJiraProjectKey(projectKey);
        await validateJiraProject(normalized);
        const config = await prisma.jiraProjectConfig.upsert({ where: { productId: product.id }, create: { productId: product.id, projectKey: normalized, validatedAt: new Date() }, update: { projectKey: normalized, validatedAt: new Date() } });
        await prisma.auditEvent.create({ data: { actorId: user.id, action: "JIRA_PROJECT_CONFIGURED", entityType: "Product", entityId: product.id, details: { projectKey: normalized } } });
        return json({ projectKey: config.projectKey, validatedAt: config.validatedAt, canConfigure: true, available: true });
      }
      if (request.method === "DELETE") {
        if (user.role === OrganizationRole.TESTER) return json({ error: "Only Admins and assigned Managers can remove Jira configuration." }, 403);
        await prisma.$transaction([
          prisma.jiraProjectConfig.deleteMany({ where: { productId: product.id } }),
          prisma.auditEvent.create({ data: { actorId: user.id, action: "JIRA_PROJECT_REMOVED", entityType: "Product", entityId: product.id } })
        ]);
        return json({ removed: true });
      }
    }
    if (request.method === "GET" && path[0] === "products" && path[1] && path[2] === "members") {
      const product = await prisma.product.findUnique({ where: { id: path[1] }, include: { memberships: { include: { user: { select: { id: true, displayName: true, email: true } } }, orderBy: { user: { displayName: "asc" } } } } });
      if (!product) return json({ error: "Product not found." }, 404);
      await assertProductMember(user.id, product.id);
      return json({ canTransfer: user.role === OrganizationRole.ADMIN, members: product.memberships.map((membership) => membership.user) });
    }
    if (request.method === "PATCH" && path[0] === "products" && path[1] && path[2] === "owner") {
      const product = await assertProductCreator(user.id, path[1]);
      if (!product) return json({ error: "Product not found." }, 404);
      const nextOwnerId = typeof body.ownerId === "string" ? body.ownerId : "";
      if (!nextOwnerId) return json({ error: "Choose an existing Product member." }, 400);
      await assertProductMember(nextOwnerId, product.id);
      if (nextOwnerId === product.createdById) return json({ id: product.id, createdById: product.createdById });
      const updated = await prisma.$transaction(async (tx) => {
        const changed = await tx.product.update({ where: { id: product.id }, data: { createdById: nextOwnerId } });
        await tx.auditEvent.create({ data: { actorId: user.id, action: "PRODUCT_OWNERSHIP_TRANSFERRED", entityType: "Product", entityId: product.id, details: { previousOwnerId: product.createdById, nextOwnerId } } });
        return changed;
      });
      return json(updated);
    }
    if (request.method === "PATCH" && path[0] === "products" && path[1]) {
      const product = await prisma.product.findUnique({ where: { id: path[1] } });
      if (!product) return json({ error: "Product not found." }, 404);
      await assertProductMember(user.id, product.id);
      if (user.role === OrganizationRole.TESTER) return json({ error: "Only Admins and assigned Managers can edit a Product name." }, 403);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return json({ error: "Product name is required." }, 400);
      try {
        return json(await prisma.product.update({ where: { id: product.id }, data: { name } }));
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return json({ error: "You already have a Product with this name." }, 409);
        }
        throw error;
      }
    }
    if (request.method === "POST" && path.join("/") === "recordings") {
      await assertProductMember(user.id, body.productId);
      if (!body.testName || !allowedTarget(body.targetUrl)) return json({ error: "Use a name and the approved demo target URL." }, 400);
      const token = crypto.randomBytes(24).toString("base64url");
      const recording = await prisma.recordingSession.create({ data: { ownerId: user.id, productId: body.productId, testName: body.testName, targetUrl: body.targetUrl, tokenHash: hash(token) } });
      return json({ recording, token }, 201);
    }
    if (request.method === "GET" && path.join("/") === "test-cases") {
      const testCases = await prisma.testCase.findMany({
        where: { product: { organizationId: user.organizationId, ...(user.role === OrganizationRole.ADMIN ? {} : { memberships: { some: { userId: user.id } } }) } },
        include: { product: true, owner: { select: { displayName: true } }, featureLabels: { include: { featureLabel: true }, orderBy: { featureLabel: { name: "asc" } } } },
        orderBy: { updatedAt: "desc" }
      });
      return json(testCases);
    }
    if (path[0] === "test-cases" && path[1] && path[2] === "github") {
      const testCase = await prisma.testCase.findUnique({ where: { id: path[1] }, select: { id: true, productId: true, ownerId: true } });
      if (!testCase) return json({ error: "Test Case not found." }, 404);
      await assertProductMember(user.id, testCase.productId);
      if (request.method === "GET") {
        const connections = await prisma.productRepositoryConnection.findMany({
          where: { productId: testCase.productId, status: { not: GitHubRepositoryConnectionStatus.DISCONNECTED } },
          include: { testCaseLinks: { where: { testCaseId: testCase.id }, select: { testCaseId: true } } },
          orderBy: { label: "asc" }
        });
        return json({ available: githubIsConfigured(), canEdit: user.role !== OrganizationRole.TESTER || testCase.ownerId === user.id, connections: connections.map((connection) => ({ id: connection.id, label: connection.label, repositoryFullName: connection.repositoryFullName, defaultBranch: connection.defaultBranch, branchAllowlist: connection.branchAllowlist, status: connection.status, analysisEnabled: connection.analysisEnabled, linked: connection.testCaseLinks.length === 1 })) });
      }
      if (request.method === "PATCH") {
        if (user.role === OrganizationRole.TESTER && testCase.ownerId !== user.id) return json({ error: "Testers can change repository routing only for their own Test Cases." }, 403);
        const connectionIds = Array.isArray(body.connectionIds) && body.connectionIds.every((id: unknown) => typeof id === "string") ? [...new Set(body.connectionIds as string[])] : null;
        if (!connectionIds) return json({ error: "Repository routing must contain valid connection identifiers." }, 400);
        const connections = connectionIds.length ? await prisma.productRepositoryConnection.findMany({ where: { id: { in: connectionIds }, productId: testCase.productId, status: GitHubRepositoryConnectionStatus.ACTIVE }, select: { id: true } }) : [];
        if (connections.length !== connectionIds.length) return json({ error: "Choose only active repository connections from this Product." }, 409);
        await prisma.$transaction(async (tx) => {
          await tx.testCaseRepositoryLink.deleteMany({ where: { testCaseId: testCase.id } });
          if (connectionIds.length) await tx.testCaseRepositoryLink.createMany({ data: connectionIds.map((connectionId) => ({ testCaseId: testCase.id, connectionId })) });
          await tx.auditEvent.create({ data: { actorId: user.id, action: "TEST_CASE_GITHUB_ROUTING_UPDATED", entityType: "TestCase", entityId: testCase.id, details: { connectionCount: connectionIds.length } } });
        });
        return json({ connectionIds });
      }
    }
    if (request.method === "GET" && path[0] === "test-cases" && path[1] && path.length === 2) {
      const testCase = await prisma.testCase.findUnique({
        where: { id: path[1] },
        include: { product: true, owner: { select: { displayName: true } }, featureLabels: { include: { featureLabel: true }, orderBy: { featureLabel: { name: "asc" } } }, versions: { include: { steps: { orderBy: { order: "asc" } }, variables: true, runs: { select: { id: true, mode: true, outcome: true, createdAt: true } } }, orderBy: { version: "desc" } } }
      });
      if (!testCase) return json({ error: "Test Case not found." }, 404);
      await assertProductMember(user.id, testCase.productId);
      return json({ ...testCase, versions: testCase.versions.map((version) => ({ ...version, variables: version.variables.map(publicVariable) })) });
    }
    if (request.method === "PATCH" && path[0] === "test-cases" && path[1] && path[2] === "owner") {
      const testCase = await prisma.testCase.findUnique({ where: { id: path[1] } });
      if (!testCase) return json({ error: "Test Case not found." }, 404);
      await assertProductCreator(user.id, testCase.productId);
      const nextOwnerId = typeof body.ownerId === "string" ? body.ownerId : "";
      if (!nextOwnerId) return json({ error: "Choose an existing Product member." }, 400);
      await assertProductMember(nextOwnerId, testCase.productId);
      if (nextOwnerId === testCase.ownerId) return json({ id: testCase.id, ownerId: testCase.ownerId, reassignedSubmittedProposals: 0 });
      const result = await prisma.$transaction(async (tx) => {
        const reassigned = await tx.changeProposal.updateMany({ where: { testCaseId: testCase.id, status: ChangeProposalStatus.SUBMITTED }, data: { ownerId: nextOwnerId } });
        const updated = await tx.testCase.update({ where: { id: testCase.id }, data: { ownerId: nextOwnerId } });
        await tx.auditEvent.create({ data: { actorId: user.id, action: "TEST_CASE_OWNERSHIP_TRANSFERRED", entityType: "TestCase", entityId: testCase.id, details: { previousOwnerId: testCase.ownerId, nextOwnerId, reassignedSubmittedProposals: reassigned.count } } });
        return { updated, reassignedSubmittedProposals: reassigned.count };
      });
      return json({ id: result.updated.id, ownerId: result.updated.ownerId, reassignedSubmittedProposals: result.reassignedSubmittedProposals });
    }
    if (request.method === "POST" && path[0] === "test-cases" && path[1] && path[2] === "suggestions") {
      const testCase = await prisma.testCase.findUnique({
        where: { id: path[1] },
        include: { versions: { include: { steps: { orderBy: { order: "asc" } } } } }
      });
      if (!testCase) return json({ error: "Test Case not found." }, 404);
      await assertProductMember(user.id, testCase.productId);
      const version = testCase.versions.find((candidate) => candidate.version === testCase.currentVersion);
      if (!version) return json({ error: "The current Test Case version is unavailable." }, 409);
      const generated = suggestionsForSteps(version.steps);
      let created = 0;
      let existing = 0;
      await prisma.$transaction(async (tx) => {
        const inserted = await tx.testSuggestion.createMany({
          data: generated.candidates.map((candidate) => ({
            productId: testCase.productId,
            sourceTestCaseId: testCase.id,
            sourceVersionId: version.id,
            sourceStepId: candidate.sourceStepId,
            kind: candidate.kind as TestSuggestionKind,
            title: candidate.title,
            rationale: candidate.rationale,
            expectedOutcome: candidate.expectedOutcome,
            proposedValue: candidate.proposedValue
          })),
          skipDuplicates: true
        });
        created = inserted.count;
        existing = generated.candidates.length - inserted.count;
        await tx.auditEvent.create({ data: { actorId: user.id, action: "TEST_SUGGESTIONS_GENERATED", entityType: "TestCase", entityId: testCase.id, details: { sourceVersion: version.version, created, existing, skipped: generated.skipped.length } } });
      });
      return json({ created, existing, skipped: generated.skipped, sourceVersion: version.version }, 201);
    }
    if (request.method === "GET" && path.join("/") === "suggestions") {
      const url = new URL(request.url);
      const requestedProductId = url.searchParams.get("productId");
      const requestedTestCaseId = url.searchParams.get("testCaseId");
      const rawStatus = url.searchParams.get("status");
      const status = rawStatus && Object.values(TestSuggestionStatus).includes(rawStatus as TestSuggestionStatus) ? rawStatus as TestSuggestionStatus : undefined;
      if (requestedProductId) await assertProductMember(user.id, requestedProductId);
      if (requestedTestCaseId) {
        const source = await prisma.testCase.findUnique({ where: { id: requestedTestCaseId }, select: { productId: true } });
        if (!source) return json({ error: "Test Case not found." }, 404);
        await assertProductMember(user.id, source.productId);
      }
      const suggestions = await prisma.testSuggestion.findMany({
        where: {
          product: { memberships: { some: { userId: user.id } } },
          ...(requestedProductId ? { productId: requestedProductId } : {}),
          ...(requestedTestCaseId ? { sourceTestCaseId: requestedTestCaseId } : {}),
          ...(status ? { status } : {})
        },
        include: {
          product: { select: { id: true, name: true } },
          sourceTestCase: { select: { id: true, name: true } },
          sourceVersion: { select: { id: true, version: true } },
          sourceStep: { select: { id: true, order: true, kind: true, target: true } },
          approvedTestCase: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" }
      });
      return json(suggestions.map(publicSuggestion));
    }
    if (request.method === "PATCH" && path[0] === "suggestions" && path[1]) {
      const suggestion = await prisma.testSuggestion.findUnique({ where: { id: path[1] }, include: { sourceStep: true } });
      if (!suggestion) return json({ error: "Suggestion not found." }, 404);
      await assertProductMember(user.id, suggestion.productId);
      if (suggestion.status !== TestSuggestionStatus.DRAFT) return json({ error: "Only Draft suggestions can be edited." }, 409);
      try {
        const title = body.title === undefined ? suggestion.title : suggestionText(body.title, "SUGGESTION_TITLE_INVALID");
        const rationale = body.rationale === undefined ? suggestion.rationale : suggestionText(body.rationale, "SUGGESTION_RATIONALE_INVALID");
        const proposedValue = body.proposedValue === undefined ? suggestion.proposedValue : body.proposedValue;
        if (!proposedValueIsSafe(suggestion.kind as SuggestionKind, proposedValue)) throw new Error("SUGGESTION_VALUE_INVALID");
        if (isSecretLikeVariable(suggestionFieldName(suggestion.sourceStep.target), proposedValue)) throw new Error("SUGGESTION_VALUE_SECRET");
        const updated = await prisma.$transaction(async (tx) => {
          const next = await tx.testSuggestion.update({ where: { id: suggestion.id }, data: { title, rationale, proposedValue } });
          await tx.auditEvent.create({ data: { actorId: user.id, action: "TEST_SUGGESTION_UPDATED", entityType: "TestSuggestion", entityId: suggestion.id } });
          return next;
        });
        return json(updated);
      } catch (error) {
        const code = error instanceof Error ? error.message : "SUGGESTION_VALUE_INVALID";
        const messages: Record<string, string> = {
          SUGGESTION_TITLE_INVALID: "Suggestion name must be non-empty text up to 240 characters.",
          SUGGESTION_RATIONALE_INVALID: "Rationale must be non-empty text up to 240 characters.",
          SUGGESTION_VALUE_INVALID: suggestion.kind === TestSuggestionKind.REQUIRED_MISSING ? "A missing-required suggestion must keep its proposed value blank." : "Enter a safe proposed value of up to 256 characters.",
          SUGGESTION_VALUE_SECRET: "Passwords, tokens, and other secret-like values cannot be proposed."
        };
        return json({ error: messages[code] ?? "The suggestion draft is invalid." }, 400);
      }
    }
    if (request.method === "POST" && path[0] === "suggestions" && path[1] && path[2] === "dismiss") {
      const suggestion = await prisma.testSuggestion.findUnique({ where: { id: path[1] } });
      if (!suggestion) return json({ error: "Suggestion not found." }, 404);
      await assertProductMember(user.id, suggestion.productId);
      if (suggestion.status !== TestSuggestionStatus.DRAFT) return json({ error: "Only Draft suggestions can be dismissed." }, 409);
      const dismissedAt = new Date();
      const updated = await prisma.$transaction(async (tx) => {
        const next = await tx.testSuggestion.update({ where: { id: suggestion.id }, data: { status: TestSuggestionStatus.DISMISSED, dismissedById: user.id, dismissedAt } });
        await tx.auditEvent.create({ data: { actorId: user.id, action: "TEST_SUGGESTION_DISMISSED", entityType: "TestSuggestion", entityId: suggestion.id } });
        return next;
      });
      return json(updated);
    }
    if (request.method === "POST" && path[0] === "suggestions" && path[1] && path[2] === "reopen") {
      const suggestion = await prisma.testSuggestion.findUnique({ where: { id: path[1] } });
      if (!suggestion) return json({ error: "Suggestion not found." }, 404);
      await assertProductMember(user.id, suggestion.productId);
      if (suggestion.status !== TestSuggestionStatus.DISMISSED) return json({ error: "Only dismissed suggestions can be reopened." }, 409);
      const updated = await prisma.$transaction(async (tx) => {
        const next = await tx.testSuggestion.update({ where: { id: suggestion.id }, data: { status: TestSuggestionStatus.DRAFT, dismissedById: null, dismissedAt: null } });
        await tx.auditEvent.create({ data: { actorId: user.id, action: "TEST_SUGGESTION_REOPENED", entityType: "TestSuggestion", entityId: suggestion.id } });
        return next;
      });
      return json(updated);
    }
    if (request.method === "POST" && path[0] === "suggestions" && path[1] && path[2] === "approve") {
      const suggestion = await prisma.testSuggestion.findUnique({
        where: { id: path[1] },
        include: {
          sourceStep: true,
          sourceVersion: { include: { steps: { orderBy: { order: "asc" } }, variables: true } },
          sourceTestCase: { include: { recordingSession: true, featureLabels: true } }
        }
      });
      if (!suggestion) return json({ error: "Suggestion not found." }, 404);
      await assertProductMember(user.id, suggestion.productId);
      if (suggestion.status !== TestSuggestionStatus.DRAFT) return json({ error: "Only Draft suggestions can be approved." }, 409);
      if (!proposedValueIsSafe(suggestion.kind as SuggestionKind, suggestion.proposedValue) || isSecretLikeVariable(suggestionFieldName(suggestion.sourceStep.target), suggestion.proposedValue)) return json({ error: "This suggestion has no safe proposed value and cannot be approved." }, 409);
      const approvedAt = new Date();
      const created = await prisma.$transaction(async (tx) => {
        const token = crypto.randomBytes(24).toString("base64url");
        const derivedName = `${suggestion.sourceTestCase.name} — ${suggestion.title}`.slice(0, 240);
        const stepData = suggestion.sourceVersion.steps.map((step) => ({
          order: step.order,
          kind: step.kind,
          timestamp: step.timestamp,
          target: step.target === null ? Prisma.JsonNull : step.target as Prisma.InputJsonValue,
          value: step.id === suggestion.sourceStepId ? suggestion.proposedValue : step.value,
          isRedacted: step.isRedacted,
          description: step.description,
          expectedOutcome: step.id === suggestion.sourceStepId ? suggestion.expectedOutcome : step.expectedOutcome,
          variableName: step.variableName,
          isCheckpoint: step.isCheckpoint
        }));
        const recording = await tx.recordingSession.create({
          data: {
            productId: suggestion.productId,
            ownerId: user.id,
            testName: derivedName,
            targetUrl: suggestion.sourceTestCase.recordingSession.targetUrl,
            tokenHash: hash(token),
            status: RecordingStatus.SAVED,
            steps: { create: stepData },
            variables: { create: suggestion.sourceVersion.variables.map((variable) => ({ name: variable.name, encryptedValue: variable.staticValueEncrypted })) }
          }
        });
        const testCase = await tx.testCase.create({
          data: {
            productId: suggestion.productId,
            ownerId: user.id,
            recordingSessionId: recording.id,
            name: derivedName,
            featureLabels: { create: suggestion.sourceTestCase.featureLabels.map((label) => ({ featureLabelId: label.featureLabelId })) },
            versions: { create: { version: 1, steps: { create: stepData }, variables: { create: suggestion.sourceVersion.variables.map((variable) => ({ name: variable.name, staticValueEncrypted: variable.staticValueEncrypted })) } } }
          }
        });
        await tx.testSuggestion.update({ where: { id: suggestion.id }, data: { status: TestSuggestionStatus.APPROVED, approvedTestCaseId: testCase.id, approvedById: user.id, approvedAt } });
        await tx.auditEvent.create({ data: { actorId: user.id, action: "TEST_SUGGESTION_APPROVED", entityType: "TestSuggestion", entityId: suggestion.id, details: { testCaseId: testCase.id, sourceVersion: suggestion.sourceVersion.version } } });
        await tx.auditEvent.create({ data: { actorId: user.id, action: "TEST_CASE_CREATED_FROM_SUGGESTION", entityType: "TestCase", entityId: testCase.id, details: { suggestionId: suggestion.id } } });
        return testCase;
      });
      return json({ testCase: created }, 201);
    }
    if (request.method === "GET" && path[0] === "products" && path[1] && path[2] === "feature-labels") {
      await assertProductMember(user.id, path[1]);
      return json(await prisma.featureLabel.findMany({ where: { productId: path[1] }, orderBy: { name: "asc" } }));
    }
    if (request.method === "GET" && path[0] === "test-cases" && path[1] && path[2] === "variables") {
      const testCase = await prisma.testCase.findUnique({ where: { id: path[1] }, include: { versions: { include: { variables: true, steps: true } } } });
      if (!testCase) return json({ error: "Test Case not found." }, 404);
      await assertProductMember(user.id, testCase.productId);
      const version = testCase.versions.find((candidate) => candidate.version === testCase.currentVersion);
      if (!version) return json({ error: "Current Test Case version not found." }, 404);
      return json({ variables: version.variables.map(publicVariable), steps: version.steps.filter((step) => step.variableName && !step.isRedacted).map((step) => ({ order: step.order, variableName: step.variableName })) });
    }
    if (request.method === "PATCH" && path[0] === "test-cases" && path[1] && path[2] === "variables" && path[3]) {
      const testCase = await prisma.testCase.findUnique({ where: { id: path[1] }, include: { versions: { include: { variables: true } } } });
      if (!testCase) return json({ error: "Test Case not found." }, 404);
      await assertProductMember(user.id, testCase.productId);
      const version = testCase.versions.find((candidate) => candidate.version === testCase.currentVersion);
      const name = canonicalVariableName(path[3]);
      if (!version || !version.variables.some((variable) => variable.name === name)) return json({ error: "Variable not found on the current Test Case version." }, 404);
      if (typeof body.value !== "string" || !body.value.trim()) return json({ error: "A static value is required." }, 400);
      if (isSecretLikeVariable(name, body.value)) return json({ error: "Passwords, tokens, and other secret-like values cannot be saved as variables." }, 400);
      const variable = await prisma.testVariable.update({ where: { testCaseVersionId_name: { testCaseVersionId: version.id, name } }, data: { staticValueEncrypted: encryptVariableValue(body.value) } });
      await prisma.auditEvent.create({ data: { actorId: user.id, action: "TEST_VARIABLE_STATIC_VALUE_SET", entityType: "TestCase", entityId: testCase.id, details: { variable: name } } });
      return json(publicVariable(variable));
    }
    if (request.method === "POST" && path[0] === "test-cases" && path[1] && path[2] === "versions") {
      const testCase = await prisma.testCase.findUnique({
        where: { id: path[1] },
        include: {
          featureLabels: { include: { featureLabel: true } },
          versions: { include: { steps: { orderBy: { order: "asc" } }, variables: true } }
        }
      });
      if (!testCase) return json({ error: "Test Case not found." }, 404);
      await assertProductMember(user.id, testCase.productId);
      const current = testCase.versions.find((version) => version.version === testCase.currentVersion);
      if (!current) return json({ error: "Current Test Case version not found." }, 409);
      if (!Array.isArray(body.steps) || body.steps.length !== current.steps.length) return json({ error: "Every saved step must remain present when creating a new version." }, 400);
      const submitted = new Map<string, Record<string, unknown>>();
      for (const entry of body.steps) {
        if (!entry || typeof entry !== "object" || typeof (entry as { id?: unknown }).id !== "string") return json({ error: "Each edited step must identify its saved source step." }, 400);
        const id = (entry as { id: string }).id;
        if (submitted.has(id)) return json({ error: "A saved step can be edited only once." }, 400);
        submitted.set(id, entry as Record<string, unknown>);
      }
      if (current.steps.some((step) => !submitted.has(step.id))) return json({ error: "Every saved step must remain present when creating a new version." }, 400);
      const previousVariables = new Map(current.variables.map((variable) => [variable.name, variable]));
      const nextVariables = new Map<string, string | null>();
      const capturedVariableValues = new Map<string, string>();
      const stepData: Array<{ order: number; kind: StepKind; timestamp: Date; target: Prisma.InputJsonValue; value: string | null; isRedacted: boolean; description: string | null; expectedOutcome: string | null; variableName: string | null; isCheckpoint: boolean }> = [];
      try {
        for (const source of current.steps) {
          const edit = submitted.get(source.id)!;
          if (Object.prototype.hasOwnProperty.call(edit, "target") && JSON.stringify(edit.target) !== JSON.stringify(source.target)) throw new Error("STEP_TARGET_IMMUTABLE");
          const target = source.target as Prisma.InputJsonValue;
          const description = Object.prototype.hasOwnProperty.call(edit, "description") ? optionalSafeText(edit.description, "STEP_DESCRIPTION_INVALID") : source.description;
          const expectedOutcome = Object.prototype.hasOwnProperty.call(edit, "expectedOutcome") ? optionalSafeText(edit.expectedOutcome, "STEP_EXPECTED_OUTCOME_INVALID") : source.expectedOutcome;
          const isCheckpoint = Object.prototype.hasOwnProperty.call(edit, "isCheckpoint") ? edit.isCheckpoint : source.isCheckpoint;
          if (typeof isCheckpoint !== "boolean") throw new Error("STEP_CHECKPOINT_INVALID");
          const inputValue = Object.prototype.hasOwnProperty.call(edit, "value") ? edit.value : undefined;
          if (inputValue !== undefined && inputValue !== source.value) throw new Error("STEP_VALUE_IMMUTABLE");
          if (source.isRedacted) {
            // The editor sends the unchanged redaction marker with every save. Permit only
            // that exact marker; any different value or variable assignment is still blocked.
            if (edit.variableName) throw new Error("VARIABLE_STEP_UNSUPPORTED");
            stepData.push({ order: source.order, kind: source.kind, timestamp: source.timestamp, target, value: source.value, isRedacted: true, description, expectedOutcome, variableName: null, isCheckpoint });
            continue;
          }
          const variableInput = Object.prototype.hasOwnProperty.call(edit, "variableName") ? edit.variableName : source.variableName;
          const variableName = variableInput === null || variableInput === "" ? null : canonicalVariableName(variableInput);
          if (source.variableName && !variableName) throw new Error("VARIABLE_MARKER_REMOVAL_UNSUPPORTED");
          if (variableName) {
            if (source.kind !== StepKind.TEXT_ENTRY) throw new Error("VARIABLE_STEP_UNSUPPORTED");
            const capturedValue = source.variableName ? null : source.value;
            if (capturedValue && isSecretLikeVariable(variableName, capturedValue)) throw new Error("VARIABLE_SECRET_REJECTED");
            const priorCapturedValue = capturedValue ? capturedVariableValues.get(variableName) : undefined;
            if (priorCapturedValue && capturedValue && priorCapturedValue !== capturedValue) throw new Error("VARIABLE_VALUE_CONFLICT");
            if (capturedValue) capturedVariableValues.set(variableName, capturedValue);
            const encrypted = source.variableName ? previousVariables.get(source.variableName)?.staticValueEncrypted ?? null : capturedValue ? encryptVariableValue(capturedValue) : null;
            const prior = nextVariables.get(variableName);
            nextVariables.set(variableName, prior ?? encrypted);
            stepData.push({ order: source.order, kind: source.kind, timestamp: source.timestamp, target, value: variablePlaceholder(variableName), isRedacted: false, description, expectedOutcome, variableName, isCheckpoint });
            continue;
          }
          stepData.push({ order: source.order, kind: source.kind, timestamp: source.timestamp, target, value: source.value, isRedacted: false, description, expectedOutcome, variableName: null, isCheckpoint });
        }
      } catch (error) {
        const code = error instanceof Error ? error.message : "STEP_UPDATE_INVALID";
        const messages: Record<string, string> = {
          FEATURE_LABELS_INVALID: "Feature labels must be unique names of up to 64 characters.",
          STEP_TARGET_IMMUTABLE: "Recorded target metadata cannot be changed here. Create a new recording to change a browser action.",
          STEP_VALUE_IMMUTABLE: "Recorded input values cannot be changed here. Use the Variables section for a variable default, or create a new recording.",
          STEP_DESCRIPTION_INVALID: "Step descriptions must be short text.",
          STEP_EXPECTED_OUTCOME_INVALID: "Expected outcomes must be short text.",
          STEP_CHECKPOINT_INVALID: "Checkpoint must be true or false.",
          VARIABLE_STEP_UNSUPPORTED: "Only non-secret text-entry steps can be marked as variables.",
          VARIABLE_NAME_INVALID: "Variable names must use lower-case letters, numbers, and underscores.",
          VARIABLE_SECRET_REJECTED: "Passwords, tokens, and other secret-like values cannot be saved.",
          VARIABLE_VALUE_CONFLICT: "Matching variable names must use one shared value.",
          VARIABLE_MARKER_REMOVAL_UNSUPPORTED: "A variable marker cannot be removed because its original value is not retained. Create a new recording instead."
        };
        return json({ error: messages[code] ?? "The saved Test Case edit is invalid." }, 400);
      }
      let labels: string[];
      try {
        labels = body.featureLabels === undefined ? testCase.featureLabels.map((item) => item.featureLabel.name) : featureLabelNames(body.featureLabels);
      } catch {
        return json({ error: "Feature labels must be unique names of up to 64 characters." }, 400);
      }
      const created = await prisma.$transaction(async (tx) => {
        const version = await tx.testCaseVersion.create({
          data: {
            testCaseId: testCase.id,
            version: current.version + 1,
            steps: { create: stepData },
            variables: { create: [...nextVariables].map(([name, staticValueEncrypted]) => ({ name, staticValueEncrypted })) }
          }
        });
        const labelIds: string[] = [];
        for (const name of labels) {
          const label = await tx.featureLabel.upsert({ where: { productId_name: { productId: testCase.productId, name } }, create: { productId: testCase.productId, name }, update: {} });
          labelIds.push(label.id);
        }
        await tx.testCase.update({ where: { id: testCase.id }, data: { currentVersion: version.version, featureLabels: { deleteMany: {}, create: labelIds.map((featureLabelId) => ({ featureLabelId })) } } });
        await tx.auditEvent.create({ data: { actorId: user.id, action: "TEST_CASE_VERSION_CREATED", entityType: "TestCase", entityId: testCase.id, details: { version: version.version, labels } } });
        return version;
      });
      return json({ version: created }, 201);
    }
    if (path[0] === "products" && path[1] && path[2] === "test-data") {
      await assertProductMember(user.id, path[1]);
      if (request.method === "GET") {
        const dataSets = await prisma.testDataSet.findMany({ where: { productId: path[1] }, select: { id: true, name: true, fieldNames: true, status: true, reusePolicy: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: "desc" } });
        return json(dataSets);
      }
      if (request.method === "POST" && !path[3]) {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const reusePolicy = body.reusePolicy === undefined ? TestDataReusePolicy.REUSABLE : body.reusePolicy === TestDataReusePolicy.REUSABLE || body.reusePolicy === TestDataReusePolicy.SINGLE_USE ? body.reusePolicy : null;
        if (!reusePolicy) return json({ error: "Choose whether this Test Data Set is reusable or single-use." }, 400);
        const rawFields = body.fields && typeof body.fields === "object" && !Array.isArray(body.fields) ? body.fields as Record<string, unknown> : {};
        const fields: Record<string, string> = {};
        for (const [rawName, rawValue] of Object.entries(rawFields)) {
          const fieldName = canonicalVariableName(rawName);
          if (typeof rawValue !== "string" || !rawValue.trim()) return json({ error: "Every Test Data field needs a value." }, 400);
          if (isSecretLikeVariable(fieldName, rawValue)) return json({ error: "Passwords, tokens, and other secret-like values cannot be stored in Test Data." }, 400);
          fields[fieldName] = rawValue;
        }
        if (!name || Object.keys(fields).length === 0) return json({ error: "A Test Data Set needs a name and at least one field." }, 400);
        try {
          const created = await prisma.testDataSet.create({ data: { productId: path[1], ownerId: user.id, name, fieldNames: Object.keys(fields).sort(), encryptedFields: encryptVariableValue(JSON.stringify(fields)), reusePolicy }, select: { id: true, name: true, fieldNames: true, status: true, reusePolicy: true, createdAt: true } });
          await prisma.auditEvent.create({ data: { actorId: user.id, action: "TEST_DATA_SET_CREATED", entityType: "TestDataSet", entityId: created.id, details: { productId: path[1], fieldNames: created.fieldNames, reusePolicy } } });
          return json(created, 201);
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return json({ error: "A Test Data Set with this name already exists for this Product." }, 409);
          throw error;
        }
      }
      if (request.method === "POST" && path[3] && path[4] === "invalidate") {
        const dataSet = await prisma.testDataSet.findFirst({ where: { id: path[3], productId: path[1], ...(user.role === OrganizationRole.TESTER ? { ownerId: user.id } : {}) } });
        if (!dataSet) return json({ error: "Test Data Set not found." }, 404);
        if (dataSet.status !== TestDataStatus.SAFE) return json({ error: "Only safe Test Data Sets can be invalidated. Create a replacement instead." }, 409);
        const invalidated = await prisma.testDataSet.update({ where: { id: dataSet.id }, data: { status: TestDataStatus.INVALID }, select: { id: true, name: true, fieldNames: true, status: true, reusePolicy: true } });
        await prisma.auditEvent.create({ data: { actorId: user.id, action: "TEST_DATA_SET_INVALIDATED", entityType: "TestDataSet", entityId: dataSet.id } });
        return json(invalidated);
      }
    }
    if (request.method === "GET" && path.join("/") === "releases") {
      const releases = await prisma.release.findMany({
        include: {
          owner: { select: { displayName: true } },
          tests: { include: { testCase: { include: { product: true } } } },
          runs: { select: { id: true, status: true, readiness: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 }
        },
        orderBy: { updatedAt: "desc" }
      });
      const permitted = [];
      for (const release of releases) {
        try {
          for (const item of release.tests) await assertProductMember(user.id, item.testCase.productId);
          permitted.push(release);
        } catch {
          // Releases are invisible unless the caller belongs to every included Product.
        }
      }
      return json(permitted);
    }
    if (request.method === "POST" && path.join("/") === "releases") {
      if (user.role === OrganizationRole.TESTER) return json({ error: "Only Admins and assigned Managers can manage Releases." }, 403);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const testCaseIds = Array.isArray(body.testCaseIds) && (body.testCaseIds as unknown[]).every((id: unknown) => typeof id === "string") ? body.testCaseIds as string[] : [];
      if (!name || name.length > 120 || testCaseIds.length === 0) return json({ error: "A Release needs a name and at least one Test Case." }, 400);
      if (new Set(testCaseIds).size !== testCaseIds.length) return json({ error: "A Test Case can be tagged only once in a Release." }, 400);
      const testCases = await prisma.testCase.findMany({ where: { id: { in: testCaseIds } }, select: { id: true, productId: true } });
      if (testCases.length !== testCaseIds.length) return json({ error: "One or more selected Test Cases no longer exist." }, 404);
      for (const testCase of testCases) await assertProductMember(user.id, testCase.productId);
      const release = await prisma.release.create({ data: { name, ownerId: user.id, tests: { create: testCaseIds.map((testCaseId) => ({ testCaseId })) } }, include: { tests: true } });
      await prisma.auditEvent.create({ data: { actorId: user.id, action: "RELEASE_CREATED", entityType: "Release", entityId: release.id, details: { testCaseCount: release.tests.length } } });
      return json(release, 201);
    }
    if (request.method === "GET" && path[0] === "releases" && path[1] && path.length === 2) {
      const basic = await assertReleaseMember(user.id, path[1]);
      if (!basic) return json({ error: "Release not found." }, 404);
      const release = await prisma.release.findUniqueOrThrow({
        where: { id: basic.id },
        include: {
          owner: { select: { displayName: true } },
          tests: { include: { testCase: { include: { product: true, featureLabels: { include: { featureLabel: true } } } } }, orderBy: { createdAt: "asc" } },
          runs: { include: { items: { include: { testCase: { select: { id: true, name: true } }, testCaseVersion: { select: { version: true } }, product: { select: { id: true, name: true } }, run: { select: { id: true, status: true, outcome: true, failureReason: true } } }, orderBy: { createdAt: "asc" } }, initiatedBy: { select: { displayName: true } } }, orderBy: { createdAt: "desc" } }
        }
      });
      return json(release);
    }
    if (request.method === "GET" && path[0] === "releases" && path[1] && path[2] === "members") {
      const release = await assertReleaseMember(user.id, path[1]);
      if (!release) return json({ error: "Release not found." }, 404);
      const productIds = [...new Set(release.tests.map((item) => item.testCase.productId))];
      const products = await prisma.product.findMany({ where: { id: { in: productIds } }, include: { memberships: { include: { user: { select: { id: true, displayName: true, email: true } } } } } });
      const canTransfer = products.length === productIds.length && products.every((product) => product.createdById === user.id);
      const eligibleIds = products.reduce<Set<string> | null>((shared, product) => {
        const memberIds = new Set(product.memberships.map((membership) => membership.userId));
        return shared === null ? memberIds : new Set([...shared].filter((id) => memberIds.has(id)));
      }, null) ?? new Set<string>();
      const members = products[0]?.memberships.map((membership) => membership.user).filter((member) => eligibleIds.has(member.id)).sort((left, right) => left.displayName.localeCompare(right.displayName)) ?? [];
      return json({ canTransfer, members });
    }
    if (request.method === "PATCH" && path[0] === "releases" && path[1] && path[2] === "owner") {
      const release = await prisma.release.findUnique({ where: { id: path[1] }, include: { tests: { include: { testCase: { select: { productId: true } } } } } });
      if (!release) return json({ error: "Release not found." }, 404);
      const productIds = [...new Set(release.tests.map((item) => item.testCase.productId))];
      for (const productId of productIds) await assertProductCreator(user.id, productId);
      const nextOwnerId = typeof body.ownerId === "string" ? body.ownerId : "";
      if (!nextOwnerId) return json({ error: "Choose a member of every Product in this Release." }, 400);
      for (const productId of productIds) await assertProductMember(nextOwnerId, productId);
      if (nextOwnerId === release.ownerId) return json({ id: release.id, ownerId: release.ownerId });
      const updated = await prisma.$transaction(async (tx) => {
        const changed = await tx.release.update({ where: { id: release.id }, data: { ownerId: nextOwnerId } });
        await tx.auditEvent.create({ data: { actorId: user.id, action: "RELEASE_OWNERSHIP_TRANSFERRED", entityType: "Release", entityId: release.id, details: { previousOwnerId: release.ownerId, nextOwnerId } } });
        return changed;
      });
      return json(updated);
    }
    if (request.method === "PATCH" && path[0] === "releases" && path[1] && path[2] === "tests") {
      if (user.role === OrganizationRole.TESTER) return json({ error: "Only Admins and assigned Managers can manage Releases." }, 403);
      const release = await assertReleaseMember(user.id, path[1]);
      if (!release) return json({ error: "Release not found." }, 404);
      const testCaseIds = Array.isArray(body.testCaseIds) && (body.testCaseIds as unknown[]).every((id: unknown) => typeof id === "string") ? body.testCaseIds as string[] : [];
      if (testCaseIds.length === 0) return json({ error: "A Release must keep at least one Test Case." }, 400);
      if (new Set(testCaseIds).size !== testCaseIds.length) return json({ error: "A Test Case can be tagged only once in a Release." }, 400);
      const testCases = await prisma.testCase.findMany({ where: { id: { in: testCaseIds } }, select: { id: true, productId: true } });
      if (testCases.length !== testCaseIds.length) return json({ error: "One or more selected Test Cases no longer exist." }, 404);
      for (const testCase of testCases) await assertProductMember(user.id, testCase.productId);
      const updated = await prisma.release.update({ where: { id: release.id }, data: { tests: { deleteMany: {}, create: testCaseIds.map((testCaseId) => ({ testCaseId })) } }, include: { tests: true } });
      await prisma.auditEvent.create({ data: { actorId: user.id, action: "RELEASE_TESTS_UPDATED", entityType: "Release", entityId: release.id, details: { testCaseCount: updated.tests.length } } });
      return json(updated);
    }
    if (request.method === "POST" && path[0] === "releases" && path[1] && path[2] === "runs") {
      if (user.role === OrganizationRole.TESTER) return json({ error: "Only Admins and assigned Managers can manage Releases." }, 403);
      const accessible = await assertReleaseMember(user.id, path[1]);
      if (!accessible) return json({ error: "Release not found." }, 404);
      const created = await prisma.$transaction(async (tx) => {
        const release = await tx.release.findUniqueOrThrow({
          where: { id: accessible.id },
          include: {
            tests: {
              include: {
                testCase: {
                  include: { recordingSession: true, versions: { include: { steps: { orderBy: { order: "asc" } }, variables: true } } }
                }
              }
            }
          }
        });
        if (!release.tests.length) throw new Error("RELEASE_EMPTY");
        const releaseRun = await tx.releaseRun.create({ data: { releaseId: release.id, initiatedById: user.id, status: ReleaseRunStatus.RUNNING } });
        const enqueued: Array<{ runId: string; attemptId: string }> = [];
        for (const tagged of release.tests) {
          const testCase = tagged.testCase;
          const version = testCase.versions.find((candidate) => candidate.version === testCase.currentVersion);
          if (!version || !version.steps.length) throw new Error("RELEASE_TEST_CASE_INVALID");
          const reason = version.steps.some((step) => step.isCheckpoint)
            ? ReleaseRunItemReason.CHECKPOINT_REQUIRES_INDIVIDUAL_RUN
            : version.variables.some((variable) => !variable.staticValueEncrypted)
              ? ReleaseRunItemReason.VARIABLE_REQUIRES_STATIC_DEFAULT
              : null;
          if (reason) {
            await tx.releaseRunItem.create({ data: { releaseRunId: releaseRun.id, testCaseId: testCase.id, testCaseVersionId: version.id, productId: testCase.productId, status: ReleaseRunItemStatus.EXCLUDED, exclusionReason: reason } });
            continue;
          }
          const run = await tx.run.create({
            data: {
              testCaseId: testCase.id,
              testCaseVersionId: version.id,
              productId: testCase.productId,
              initiatedById: user.id,
              targetUrl: testCase.recordingSession.targetUrl,
              mode: RunMode.AUTO,
              activeStepOrder: version.steps[0].order,
              stepResults: { create: version.steps.map((step) => ({ testStepId: step.id, order: step.order })) },
              attempts: { create: { attemptNumber: 1 } },
              variableBindings: { create: version.variables.map((variable) => ({ name: variable.name, source: VariableSource.STATIC, valueEncrypted: variable.staticValueEncrypted!, testVariableId: variable.id })) }
            },
            include: { attempts: true }
          });
          await tx.releaseRunItem.create({ data: { releaseRunId: releaseRun.id, testCaseId: testCase.id, testCaseVersionId: version.id, productId: testCase.productId, runId: run.id } });
          await tx.auditEvent.create({ data: { actorId: user.id, action: "RELEASE_RUN_ITEM_QUEUED", entityType: "Run", entityId: run.id, details: { releaseRunId: releaseRun.id, testCaseVersion: version.version } } });
          enqueued.push({ runId: run.id, attemptId: run.attempts[0].id });
        }
        await tx.auditEvent.create({ data: { actorId: user.id, action: "RELEASE_RUN_STARTED", entityType: "ReleaseRun", entityId: releaseRun.id, details: { itemCount: release.tests.length } } });
        return { releaseRun, enqueued };
      });
      for (const item of created.enqueued) {
        try {
          const jobId = await enqueueAutoRun(item);
          await prisma.runAttempt.update({ where: { id: item.attemptId }, data: { jobId } });
        } catch (error) {
          const completedAt = new Date();
          await prisma.$transaction([
            prisma.run.update({ where: { id: item.runId }, data: { status: RunStatus.COMPLETED, outcome: RunOutcome.FAILED, failureReason: RunFailureReason.INFRASTRUCTURE_ERROR, evidenceStatus: "PARTIAL", activeStepOrder: null, completedAt } }),
            prisma.runAttempt.updateMany({ where: { runId: item.runId }, data: { status: RunAttemptStatus.COMPLETED, failureReason: RunFailureReason.INFRASTRUCTURE_ERROR, completedAt } })
          ]);
          await markReleaseRunItemQueueFailure(item.runId);
          await notifyRunFailure(item.runId);
          console.error("Sentinel could not enqueue a Release Run item", error);
        }
      }
      await refreshReleaseRun(created.releaseRun.id);
      return json({ releaseRunId: created.releaseRun.id }, 201);
    }
    if (request.method === "POST" && path[0] === "test-cases" && path[1] && path[2] === "runs") {
      const testCase = await prisma.testCase.findUnique({
        where: { id: path[1] },
        include: { recordingSession: true, versions: { include: { steps: { orderBy: { order: "asc" } }, variables: true } } }
      });
      if (!testCase) return json({ error: "Test Case not found." }, 404);
      await assertProductMember(user.id, testCase.productId);
      const version = testCase.versions.find((candidate) => candidate.version === testCase.currentVersion);
      if (!version || version.steps.length === 0) return json({ error: "This Test Case has no saved steps to guide a Run." }, 409);
      const variables = await migrateLegacyVariables(version);
      if (await prisma.run.findFirst({ where: { mode: RunMode.GUIDED, status: RunStatus.RUNNING } })) return json({ error: "Another local browser session is active. Finish it before starting a Run." }, 409);
        const run = await prisma.$transaction(async (tx) => {
          const created = await tx.run.create({
          data: {
            testCaseId: testCase.id,
            testCaseVersionId: version.id,
            productId: testCase.productId,
            initiatedById: user.id,
            targetUrl: testCase.recordingSession.targetUrl,
            activeStepOrder: version.steps[0].order,
            stepResults: { create: version.steps.map((step) => ({ testStepId: step.id, order: step.order })) }
          }
          });
          await createRunBindings(tx, created.id, testCase.productId, variables, body.bindings);
          await tx.auditEvent.create({ data: { actorId: user.id, action: "RUN_QUEUED", entityType: "Run", entityId: created.id, details: { testCaseVersion: version.version } } });
        return created;
      });
      try {
        await launchRunBrowser(run.targetUrl, run.id);
      } catch (error) {
        await prisma.run.update({ where: { id: run.id }, data: { status: RunStatus.COMPLETED, outcome: RunOutcome.INTERRUPTED, evidenceStatus: "PARTIAL", completedAt: new Date() } });
        await updateReservedDataSet(run.id, RunOutcome.INTERRUPTED);
        throw error;
      }
      const started = await prisma.run.update({ where: { id: run.id }, data: { status: RunStatus.RUNNING, startedAt: new Date() } });
      await prisma.auditEvent.create({ data: { actorId: user.id, action: "RUN_STARTED", entityType: "Run", entityId: run.id } });
      await captureRunEvidence(run.id, "START");
      return json({ run: started, viewerUrl: process.env.BROWSER_VIEWER_URL }, 201);
    }
    if (request.method === "POST" && path[0] === "test-cases" && path[1] && path[2] === "auto-runs") {
      const testCase = await prisma.testCase.findUnique({
        where: { id: path[1] },
        include: { recordingSession: true, versions: { include: { steps: { orderBy: { order: "asc" } }, variables: true } } }
      });
      if (!testCase) return json({ error: "Test Case not found." }, 404);
      await assertProductMember(user.id, testCase.productId);
      const version = testCase.versions.find((candidate) => candidate.version === testCase.currentVersion);
      if (!version || version.steps.length === 0) return json({ error: "This Test Case has no saved steps to replay." }, 409);
      const variables = await migrateLegacyVariables(version);
      const created = await prisma.$transaction(async (tx) => {
        const run = await tx.run.create({
          data: {
            testCaseId: testCase.id,
            testCaseVersionId: version.id,
            productId: testCase.productId,
            initiatedById: user.id,
            targetUrl: testCase.recordingSession.targetUrl,
            mode: RunMode.AUTO,
            activeStepOrder: version.steps[0].order,
            stepResults: { create: version.steps.map((step) => ({ testStepId: step.id, order: step.order })) },
            attempts: { create: { attemptNumber: 1 } }
          },
          include: { attempts: true }
        });
        await createRunBindings(tx, run.id, testCase.productId, variables, body.bindings);
        await tx.auditEvent.create({ data: { actorId: user.id, action: "AUTO_RUN_QUEUED", entityType: "Run", entityId: run.id, details: { testCaseVersion: version.version } } });
        return run;
      });
      const attempt = created.attempts[0];
      try {
        const jobId = await enqueueAutoRun({ runId: created.id, attemptId: attempt.id });
        await prisma.runAttempt.update({ where: { id: attempt.id }, data: { jobId } });
      } catch (error) {
        const completedAt = new Date();
        await prisma.$transaction([
          prisma.run.update({ where: { id: created.id }, data: { status: RunStatus.COMPLETED, outcome: RunOutcome.FAILED, failureReason: RunFailureReason.INFRASTRUCTURE_ERROR, evidenceStatus: "PARTIAL", activeStepOrder: null, completedAt } }),
          prisma.runAttempt.update({ where: { id: attempt.id }, data: { status: RunAttemptStatus.COMPLETED, failureReason: RunFailureReason.INFRASTRUCTURE_ERROR, completedAt } }),
          prisma.auditEvent.create({ data: { actorId: user.id, action: "AUTO_RUN_QUEUE_FAILED", entityType: "Run", entityId: created.id } })
        ]);
        await updateReservedDataSet(created.id, RunOutcome.FAILED);
        await markReleaseRunItemQueueFailure(created.id);
        await notifyRunFailure(created.id);
        console.error("Sentinel could not enqueue Auto Run", error);
        return json({ error: "Auto Run could not be queued. Redis is unavailable; try again." }, 503);
      }
      return json({ run: created }, 201);
    }
    if (request.method === "POST" && path[0] === "runs" && path[1] && path[2] === "jira-draft") {
      if (!jiraCloudIsConfigured()) return json({ error: "Jira Cloud is not configured for this Sentinel deployment." }, 503);
      const run = await prisma.run.findUnique({
        where: { id: path[1] },
        include: { product: true, testCase: true, testCaseVersion: { include: { steps: { select: { order: true, kind: true } } } } }
      });
      if (!run) return json({ error: "Run not found." }, 404);
      await assertProductMember(user.id, run.productId);
      if (run.status !== RunStatus.COMPLETED || run.outcome !== RunOutcome.FAILED) return json({ error: "Only a completed failed Run can be filed to Jira." }, 409);
      const config = await prisma.jiraProjectConfig.findUnique({ where: { productId: run.productId } });
      if (!config) return json({ error: "This Product does not have a Jira project mapping." }, 409);
      const draft = await buildJiraDraftWithDiagnostic(run);
      let filing = await prisma.jiraFiling.findUnique({ where: { runId: run.id }, include: { jiraIssue: true } });
      if (!filing) {
        try {
          filing = await prisma.$transaction(async (tx) => {
            const created = await tx.jiraFiling.create({ data: { runId: run.id, productId: run.productId, requestedById: user.id, summary: draft.summary, description: draft.description, priority: draft.priority }, include: { jiraIssue: true } });
            await tx.auditEvent.create({ data: { actorId: user.id, action: "JIRA_FILING_DRAFT_CREATED", entityType: "JiraFiling", entityId: created.id, details: { runId: run.id } } });
            return created;
          });
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
          filing = await prisma.jiraFiling.findUniqueOrThrow({ where: { runId: run.id }, include: { jiraIssue: true } });
        }
      }
      return json(publicJiraFiling(filing));
    }
    if (request.method === "PATCH" && path[0] === "jira-filings" && path[1]) {
      const filing = await prisma.jiraFiling.findUnique({ where: { id: path[1] }, include: { jiraIssue: true } });
      if (!filing) return json({ error: "Jira filing not found." }, 404);
      await assertProductMember(user.id, filing.productId);
      if (filing.status !== JiraFilingStatus.DRAFT) return json({ error: "Only an unfiled Jira draft can be edited." }, 409);
      const summary = typeof body.summary === "string" ? body.summary.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : "";
      const priority = typeof body.priority === "string" ? body.priority : "";
      if (!summary || summary.length > 240) return json({ error: "Jira summary is required and must be 240 characters or fewer." }, 400);
      if (!description || description.length > 8_000) return json({ error: "Jira reproduction description is required and must be 8,000 characters or fewer." }, 400);
      if (!isAllowedJiraPriority(priority)) return json({ error: "Choose a valid Jira priority." }, 400);
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.jiraFiling.update({ where: { id: filing.id }, data: { summary, description, priority }, include: { jiraIssue: true } });
        await tx.auditEvent.create({ data: { actorId: user.id, action: "JIRA_FILING_DRAFT_EDITED", entityType: "JiraFiling", entityId: filing.id } });
        return result;
      });
      return json(publicJiraFiling(updated));
    }
    if (request.method === "POST" && path[0] === "jira-filings" && path[1] && path[2] === "file") {
      if (!jiraCloudIsConfigured()) return json({ error: "Jira Cloud is not configured for this Sentinel deployment." }, 503);
      const filing = await prisma.jiraFiling.findUnique({ where: { id: path[1] }, include: { jiraIssue: true } });
      if (!filing) return json({ error: "Jira filing not found." }, 404);
      await assertProductMember(user.id, filing.productId);
      if (filing.status === JiraFilingStatus.FILED) return json(publicJiraFiling(filing));
      if (filing.status === JiraFilingStatus.QUEUED) return json(publicJiraFiling(filing), 202);
      const config = await prisma.jiraProjectConfig.findUnique({ where: { productId: filing.productId } });
      if (!config) return json({ error: "This Product does not have a Jira project mapping." }, 409);
      const queued = await prisma.$transaction(async (tx) => {
        const result = await tx.jiraFiling.update({ where: { id: filing.id }, data: { status: JiraFilingStatus.QUEUED, queuedAt: new Date(), deliveryError: null }, include: { jiraIssue: true } });
        await tx.auditEvent.create({ data: { actorId: user.id, action: "JIRA_FILING_QUEUED", entityType: "JiraFiling", entityId: filing.id } });
        return result;
      });
      try {
        await enqueueJiraFiling({ filingId: filing.id });
      } catch (error) {
        await prisma.jiraFiling.update({ where: { id: filing.id }, data: { status: JiraFilingStatus.FAILED, deliveryError: "Jira filing could not be queued." } });
        console.error("Sentinel could not queue Jira filing", error);
        return json({ error: "Jira filing could not be queued. Redis is unavailable; try again." }, 503);
      }
      return json(publicJiraFiling(queued), 202);
    }
    if (request.method === "POST" && path[0] === "runs" && path[1] && path[2] === "change-proposals") {
      const run = await prisma.run.findUnique({ where: { id: path[1] }, include: { testCase: true, testCaseVersion: { include: { steps: { orderBy: { order: "asc" } } } } } });
      if (!run) return json({ error: "Run not found." }, 404);
      await assertProductMember(user.id, run.productId);
      if (run.status !== RunStatus.COMPLETED || run.outcome !== RunOutcome.FAILED) return json({ error: "Only a completed failed Run can start a change proposal." }, 409);
      const context = typeof body.context === "string" ? body.context.trim() : "";
      const changes = Array.isArray(body.changes) ? body.changes : [];
      if (!context || context.length > 1000 || !changes.length) return json({ error: "Add deployment context and at least one changed description or expected outcome." }, 400);
      try {
        const proposal = await prisma.$transaction(async (tx) => {
          const rows = changes.map((change: { stepId?: unknown; description?: unknown; expectedOutcome?: unknown }) => {
            const step = run.testCaseVersion.steps.find((item) => item.id === change.stepId);
            const description = typeof change.description === "string" ? change.description.trim() || null : null;
            const expectedOutcome = typeof change.expectedOutcome === "string" ? change.expectedOutcome.trim() || null : null;
            if (!step || (description === step.description && expectedOutcome === step.expectedOutcome) || (description && (description.length > 2000 || isSecretLikeVariable("proposal", description))) || (expectedOutcome && (expectedOutcome.length > 2000 || isSecretLikeVariable("proposal", expectedOutcome)))) throw new Error("INVALID_PROPOSAL_CHANGE");
            return { sourceStepId: step.id, order: step.order, proposedDescription: description, proposedExpectedOutcome: expectedOutcome };
          });
          const created = await tx.changeProposal.create({ data: { runId: run.id, productId: run.productId, testCaseId: run.testCaseId, sourceVersionId: run.testCaseVersionId, createdById: user.id, ownerId: run.testCase.ownerId, context, changes: { create: rows } }, include: { changes: true } });
          await tx.auditEvent.create({ data: { actorId: user.id, action: "CHANGE_PROPOSAL_CREATED", entityType: "ChangeProposal", entityId: created.id, details: { runId: run.id } } });
          return created;
        });
        return json(proposal, 201);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return json({ error: "This failed Run already has a change proposal." }, 409);
        if (error instanceof Error && error.message === "INVALID_PROPOSAL_CHANGE") return json({ error: "Proposal changes must refer to saved steps and modify only safe annotations." }, 400);
        throw error;
      }
    }
    if (request.method === "POST" && path[0] === "change-proposals" && path[1] && path[2] === "submit") {
      const proposal = await prisma.changeProposal.findUnique({ where: { id: path[1] } });
      if (!proposal) return json({ error: "Change proposal not found." }, 404);
      await assertProductMember(user.id, proposal.productId);
      if (proposal.createdById !== user.id || proposal.status !== ChangeProposalStatus.DRAFT) return json({ error: "Only the proposal creator can submit a draft." }, 403);
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.changeProposal.update({ where: { id: proposal.id }, data: { status: ChangeProposalStatus.SUBMITTED, submittedAt: new Date() } });
        await tx.auditEvent.create({ data: { actorId: user.id, action: "CHANGE_PROPOSAL_SUBMITTED", entityType: "ChangeProposal", entityId: proposal.id } });
        return result;
      });
      await notifyChangeProposalSubmitted(updated.id);
      return json(updated);
    }
    if (request.method === "PATCH" && path[0] === "change-proposals" && path[1]) {
      const proposal = await prisma.changeProposal.findUnique({ where: { id: path[1] }, include: { sourceVersion: { include: { steps: true } } } });
      if (!proposal) return json({ error: "Change proposal not found." }, 404);
      await assertProductMember(user.id, proposal.productId);
      if (proposal.createdById !== user.id || proposal.status !== ChangeProposalStatus.DRAFT) return json({ error: "Only the proposal creator can edit an unsubmitted draft." }, 403);
      const context = typeof body.context === "string" ? body.context.trim() : "";
      const changes = Array.isArray(body.changes) ? body.changes : [];
      if (!context || context.length > 1000 || !changes.length) return json({ error: "Add deployment context and at least one changed description or expected outcome." }, 400);
      try {
        const updated = await prisma.$transaction(async (tx) => {
          const rows = changes.map((change: { stepId?: unknown; description?: unknown; expectedOutcome?: unknown }) => {
            const step = proposal.sourceVersion.steps.find((item) => item.id === change.stepId);
            const description = typeof change.description === "string" ? change.description.trim() || null : null;
            const expectedOutcome = typeof change.expectedOutcome === "string" ? change.expectedOutcome.trim() || null : null;
            if (!step || (description === step.description && expectedOutcome === step.expectedOutcome) || (description && (description.length > 2000 || isSecretLikeVariable("proposal", description))) || (expectedOutcome && (expectedOutcome.length > 2000 || isSecretLikeVariable("proposal", expectedOutcome)))) throw new Error("INVALID_PROPOSAL_CHANGE");
            return { sourceStepId: step.id, order: step.order, proposedDescription: description, proposedExpectedOutcome: expectedOutcome };
          });
          await tx.changeProposalStep.deleteMany({ where: { changeProposalId: proposal.id } });
          const result = await tx.changeProposal.update({ where: { id: proposal.id }, data: { context, changes: { create: rows } }, include: { changes: true } });
          await tx.auditEvent.create({ data: { actorId: user.id, action: "CHANGE_PROPOSAL_EDITED", entityType: "ChangeProposal", entityId: proposal.id } });
          return result;
        });
        return json(updated);
      } catch (error) {
        if (error instanceof Error && error.message === "INVALID_PROPOSAL_CHANGE") return json({ error: "Proposal changes may update only safe descriptions and expected outcomes." }, 400);
        throw error;
      }
    }
    if (request.method === "POST" && path[0] === "change-proposals" && path[1] && (path[2] === "approve" || path[2] === "reject")) {
      const proposal = await prisma.changeProposal.findUnique({ where: { id: path[1] }, include: { testCase: { include: { versions: { include: { steps: { orderBy: { order: "asc" } }, variables: true } } } }, changes: true } });
      if (!proposal) return json({ error: "Change proposal not found." }, 404);
      await assertProductMember(user.id, proposal.productId);
      if (user.role === OrganizationRole.TESTER || proposal.status !== ChangeProposalStatus.SUBMITTED) return json({ error: "Only an Admin or assigned Manager can decide this submitted proposal." }, 403);
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) || null : null;
      if (proposal.testCase.currentVersion !== proposal.testCase.versions.find((version) => version.id === proposal.sourceVersionId)?.version) {
        const stale = await prisma.$transaction(async (tx) => {
          const result = await tx.changeProposal.update({ where: { id: proposal.id }, data: { status: ChangeProposalStatus.STALE, decidedAt: new Date(), decisionNote: "The Test Case baseline changed before review." } });
          await tx.auditEvent.create({ data: { actorId: user.id, action: "CHANGE_PROPOSAL_STALE", entityType: "ChangeProposal", entityId: proposal.id } });
          return result;
        });
        return json(stale, 409);
      }
      if (path[2] === "reject") {
        const rejected = await prisma.$transaction(async (tx) => {
          const result = await tx.changeProposal.update({ where: { id: proposal.id }, data: { status: ChangeProposalStatus.REJECTED, decisionNote: note, decidedAt: new Date() } });
          await tx.auditEvent.create({ data: { actorId: user.id, action: "CHANGE_PROPOSAL_REJECTED", entityType: "ChangeProposal", entityId: proposal.id } });
          const config = await tx.jiraProjectConfig.findUnique({ where: { productId: proposal.productId } });
          const filing = await tx.jiraFiling.findUnique({ where: { runId: proposal.runId } });
          if (config && !filing) {
            const run = await tx.run.findUniqueOrThrow({ where: { id: proposal.runId }, include: { product: true, testCase: true, testCaseVersion: { include: { steps: { select: { order: true, kind: true } } } } } });
            const draft = await buildJiraDraftWithDiagnostic(run);
            const jiraDraft = await tx.jiraFiling.create({ data: { runId: run.id, productId: run.productId, requestedById: user.id, summary: draft.summary, description: draft.description, priority: draft.priority } });
            await tx.auditEvent.create({ data: { actorId: user.id, action: "JIRA_FILING_DRAFT_CREATED", entityType: "JiraFiling", entityId: jiraDraft.id, details: { source: "CHANGE_PROPOSAL_REJECTION" } } });
          }
          return result;
        });
        await notifyChangeProposalResolved(rejected.id);
        return json(rejected);
      }
      const approved = await prisma.$transaction(async (tx) => {
        const source = proposal.testCase.versions.find((version) => version.id === proposal.sourceVersionId)!;
        const nextVersion = proposal.testCase.currentVersion + 1;
        const version = await tx.testCaseVersion.create({ data: { testCaseId: proposal.testCaseId, version: nextVersion, steps: { create: source.steps.map((step) => { const change = proposal.changes.find((item) => item.sourceStepId === step.id); return { order: step.order, kind: step.kind, timestamp: step.timestamp, target: step.target === null ? Prisma.JsonNull : step.target as Prisma.InputJsonValue, value: step.value, isRedacted: step.isRedacted, description: change ? change.proposedDescription : step.description, expectedOutcome: change ? change.proposedExpectedOutcome : step.expectedOutcome, variableName: step.variableName, isCheckpoint: step.isCheckpoint }; }) }, variables: { create: source.variables.map((variable) => ({ name: variable.name, staticValueEncrypted: variable.staticValueEncrypted })) } } });
        await tx.testCase.update({ where: { id: proposal.testCaseId }, data: { currentVersion: nextVersion } });
        const result = await tx.changeProposal.update({ where: { id: proposal.id }, data: { status: ChangeProposalStatus.APPROVED, decisionNote: note, decidedAt: new Date(), appliedVersion: nextVersion } });
        await tx.auditEvent.create({ data: { actorId: user.id, action: "CHANGE_PROPOSAL_APPROVED", entityType: "ChangeProposal", entityId: proposal.id, details: { versionId: version.id, version: nextVersion } } });
        return result;
      });
      await notifyChangeProposalResolved(approved.id);
      return json(approved);
    }
    if (request.method === "GET" && path.join("/") === "change-proposals") {
      const proposals = await prisma.changeProposal.findMany({ where: { product: { organizationId: user.organizationId, ...(user.role === OrganizationRole.ADMIN ? {} : { memberships: { some: { userId: user.id } } }) } }, include: { testCase: { select: { name: true } }, run: { select: { id: true } }, sourceVersion: { select: { version: true, steps: { select: { id: true, order: true, description: true, expectedOutcome: true } } } }, createdBy: { select: { displayName: true } }, owner: { select: { displayName: true } }, changes: true }, orderBy: { createdAt: "desc" } });
      return json(proposals.map((proposal) => ({ ...proposal, canDecide: user.role === OrganizationRole.ADMIN || user.role === OrganizationRole.MANAGER, canEdit: proposal.createdById === user.id && proposal.status === ChangeProposalStatus.DRAFT })));
    }
    if (request.method === "GET" && path.join("/") === "runs") {
      const runs = await prisma.run.findMany({
        where: { product: { organizationId: user.organizationId, ...(user.role === OrganizationRole.ADMIN ? {} : { memberships: { some: { userId: user.id } } }) } },
        include: { product: true, testCase: { select: { id: true, name: true } }, initiatedBy: { select: { displayName: true } }, stepResults: { select: { status: true } }, attempts: { select: { id: true, attemptNumber: true, status: true, failureReason: true, activeDurationMs: true }, orderBy: { attemptNumber: "asc" } } },
        orderBy: { createdAt: "desc" }
      });
      return json(runs);
    }
    if (request.method === "GET" && path[0] === "runs" && path[1] && path[2] === "jira-filings") {
      const run = await prisma.run.findUnique({ where: { id: path[1] }, include: { jiraFiling: { include: { jiraIssue: true } } } });
      if (!run) return json({ error: "Run not found." }, 404);
      await assertProductMember(user.id, run.productId);
      return json(run.jiraFiling ? publicJiraFiling(run.jiraFiling) : null);
    }
    if (request.method === "POST" && path[0] === "runs" && path[1] && path[2] === "source-analysis") {
      const run = await prisma.run.findUnique({ where: { id: path[1] }, select: { id: true, productId: true, status: true, outcome: true } });
      if (!run) return json({ error: "Run not found." }, 404);
      await assertProductMember(user.id, run.productId);
      if (run.status !== RunStatus.COMPLETED || run.outcome !== RunOutcome.FAILED) return json({ error: "Source analysis is available only for a completed failed Run." }, 409);
      const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
      const commitSha = typeof body.commitSha === "string" ? body.commitSha.trim() : "";
      const parentSha = typeof body.parentSha === "string" && body.parentSha.trim() ? body.parentSha.trim() : null;
      if (!connectionId || !commitSha) return json({ error: "Choose a connected repository and immutable commit SHA before analysis." }, 400);
      try {
        const result = await requestSourceAnalysis({ runId: run.id, connectionId, requestedById: user.id, trigger: SourceAnalysisTrigger.MANUAL_REQUEST, commitSha, parentSha });
        return json(result, result.created ? 201 : 200);
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        if (code === "SOURCE_ANALYSIS_COMMIT_INVALID") return json({ error: "Use a full 40-character immutable Git commit SHA." }, 400);
        if (code === "SOURCE_ANALYSIS_CONNECTION_UNAVAILABLE") return json({ error: "This repository connection is unavailable for analysis." }, 409);
        if (code === "SOURCE_ANALYSIS_RUN_INVALID") return json({ error: "The selected repository does not belong to this Run's Product." }, 403);
        throw error;
      }
    }
    if (request.method === "POST" && path[0] === "runs" && path[1] && path[2] === "diagnostics" && path[3] === "customer-lookup") {
      const run = await prisma.run.findUnique({ where: { id: path[1] }, include: { testCaseVersion: { include: { steps: { orderBy: { order: "asc" } } } }, variableBindings: true } });
      if (!run) return json({ error: "Run not found." }, 404);
      await assertProductMember(user.id, run.productId);
      if (run.status !== RunStatus.COMPLETED || run.outcome !== RunOutcome.FAILED) return json({ error: "Database insight is available only for a completed failed Run." }, 409);
      const existing = await prisma.databaseDiagnostic.findUnique({ where: { runId_kind: { runId: run.id, kind: DatabaseDiagnosticKind.CUSTOMER_LOOKUP_BY_EMAIL } } });
      if (existing) return json(existing);
      const email = customerEmailForDiagnostic(run.testCaseVersion.steps, run.variableBindings);
      const result = email ? await customerLookupByEmail(email) : { status: "INCOMPLETE" as const, errorCode: "MISSING_LOOKUP_KEY" };
      const metadata = result.status === "COMPLETE" ? { diagnostic: "CUSTOMER_LOOKUP_BY_EMAIL", status: result.status, ...result.safeMetadata } : { diagnostic: "CUSTOMER_LOOKUP_BY_EMAIL", status: result.status, errorCode: result.errorCode };
      try {
        const diagnostic = await prisma.$transaction(async (tx) => {
          const created = await tx.databaseDiagnostic.create({ data: { runId: run.id, kind: DatabaseDiagnosticKind.CUSTOMER_LOOKUP_BY_EMAIL, status: result.status === "COMPLETE" ? DatabaseDiagnosticStatus.COMPLETE : result.status === "INCOMPLETE" ? DatabaseDiagnosticStatus.INCOMPLETE : DatabaseDiagnosticStatus.UNAVAILABLE, requestedById: user.id, safeMetadata: result.status === "COMPLETE" ? metadata as Prisma.InputJsonValue : Prisma.JsonNull, errorCode: result.status === "COMPLETE" ? null : result.errorCode, completedAt: new Date() } });
          await tx.evidenceItem.create({ data: { runId: run.id, kind: EvidenceKind.DATABASE, metadata: metadata as Prisma.InputJsonValue } });
          await tx.auditEvent.create({ data: { actorId: user.id, action: "DATABASE_DIAGNOSTIC_COMPLETED", entityType: "DatabaseDiagnostic", entityId: created.id, details: { kind: created.kind, status: created.status, errorCode: created.errorCode } } });
          return created;
        });
        return json(diagnostic, 201);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return json(await prisma.databaseDiagnostic.findUniqueOrThrow({ where: { runId_kind: { runId: run.id, kind: DatabaseDiagnosticKind.CUSTOMER_LOOKUP_BY_EMAIL } } }));
        throw error;
      }
    }
    if (request.method === "GET" && path[0] === "runs" && path[1]) {
      const run = await prisma.run.findUnique({
        where: { id: path[1] },
        include: {
          product: true,
          testCase: { select: { id: true, name: true } },
          testCaseVersion: { select: { version: true } },
          initiatedBy: { select: { displayName: true } },
          stepResults: { include: { testStep: true, evidence: { orderBy: { capturedAt: "asc" } } }, orderBy: { order: "asc" } },
          attempts: { orderBy: { attemptNumber: "asc" } },
          variableBindings: { select: { name: true, source: true, dataSetId: true } },
          evidence: { orderBy: { capturedAt: "asc" } },
          databaseDiagnostics: { orderBy: { createdAt: "asc" } },
          jiraFiling: { include: { jiraIssue: true } },
          changeProposal: { include: { changes: true } },
          githubRunLink: { include: { connection: { select: { id: true, label: true, repositoryFullName: true, defaultBranch: true } } } },
          sourceAnalyses: { orderBy: { createdAt: "desc" }, select: { id: true, trigger: true, commitSha: true, parentSha: true, status: true, confidence: true, provider: true, model: true, observations: true, hypotheses: true, likelyCause: true, remediation: true, suggestedPatch: true, sourceReferences: true, limitations: true, errorCode: true, queuedAt: true, startedAt: true, completedAt: true, expiresAt: true, connection: { select: { id: true, label: true, repositoryFullName: true } } } }
        }
      });
      if (!run) return json({ error: "Run not found." }, 404);
      await assertProductMember(user.id, run.productId);
      return json({ ...run, jiraFiling: run.jiraFiling ? publicJiraFiling(run.jiraFiling) : null, viewerUrl: run.mode === RunMode.GUIDED && run.status === RunStatus.RUNNING ? process.env.BROWSER_VIEWER_URL : null });
    }
    if (request.method === "POST" && path[0] === "runs" && path[1] && path[2] === "steps" && path[3] && path[4] === "complete") {
      const run = await prisma.run.findUnique({ where: { id: path[1] }, include: { stepResults: { include: { testStep: true }, orderBy: { order: "asc" } }, variableBindings: true } });
      if (!run) return json({ error: "Run not found." }, 404);
      await assertProductMember(user.id, run.productId);
      if (run.mode !== RunMode.GUIDED) return json({ error: "Auto Runs are completed by their worker, not the guided step controls." }, 409);
      if (run.status !== RunStatus.RUNNING) return json({ error: "This Run is no longer active." }, 409);
      const stepResult = run.stepResults.find((item) => item.id === path[3]);
      if (!stepResult) return json({ error: "Run step not found." }, 404);
      if (stepResult.status !== RunStepStatus.PENDING || stepResult.order !== run.activeStepOrder) return json({ error: "Complete the active Run step before changing another step." }, 409);
      const outcome = body.status === "PASSED" ? RunStepStatus.PASSED : body.status === "FAILED" ? RunStepStatus.FAILED : null;
      if (!outcome) return json({ error: "Step status must be PASSED or FAILED." }, 400);
      if (outcome === RunStepStatus.PASSED) {
        try {
          const binding = stepResult.testStep.variableName && !stepResult.testStep.isRedacted ? run.variableBindings.find((item) => item.name === stepResult.testStep.variableName) : undefined;
          await replayGuidedRunStep(run.id, stepResult.testStep, binding ? decryptVariableValue(binding.valueEncrypted) : undefined);
        } catch (error) {
          const code = error instanceof Error ? error.message : "GUIDED_STEP_ACTION_FAILED";
          const messages: Record<string, string> = {
            GUIDED_NAVIGATION_TARGET_MISSING: "This saved navigation step has no target URL.",
            GUIDED_NAVIGATION_MISMATCH: "The live browser did not reach the expected URL for this step.",
            GUIDED_CREDENTIAL_UNAVAILABLE: "The local Demo CRM password is not configured for guided replay.",
            GUIDED_VARIABLE_VALUE_MISSING: "This Run has no usable value for the saved variable.",
            GUIDED_TEXT_VALUE_MISSING: "This saved text step has no value to apply.",
            GUIDED_SELECTOR_AMBIGUOUS: "This saved step matches more than one browser element, so Sentinel stopped safely.",
            GUIDED_SELECTOR_NOT_FOUND: "Sentinel could not find the saved browser element for this step.",
            GUIDED_TEXT_TARGET_INVALID: "This saved text step does not target an editable browser field.",
            GUIDED_STEP_TIMEOUT: "The live browser did not complete this step in time.",
            GUIDED_STEP_ACTION_FAILED: "The live browser could not apply this saved step."
          };
          return json({ error: messages[code] ?? messages.GUIDED_STEP_ACTION_FAILED }, 409);
        }
      }
      const completedAt = new Date();
      const nextStep = run.stepResults.find((item) => item.order > stepResult.order);
      await prisma.runStepResult.update({ where: { id: stepResult.id }, data: { status: outcome, startedAt: stepResult.startedAt ?? run.startedAt ?? completedAt, completedAt } });
      if (outcome === RunStepStatus.FAILED) {
        await captureRunEvidence(run.id, "FAILURE", stepResult.id);
        const completed = await prisma.run.update({ where: { id: run.id }, data: { status: RunStatus.COMPLETED, outcome: RunOutcome.FAILED, activeStepOrder: null, completedAt } });
        await updateReservedDataSet(run.id, RunOutcome.FAILED);
        await prisma.auditEvent.create({ data: { actorId: user.id, action: "RUN_FAILED", entityType: "Run", entityId: run.id, details: { stepOrder: stepResult.order } } });
        await notifyRunFailure(run.id);
        await closeRunBrowser(run.id);
        return json(completed);
      }
      if (nextStep) {
        const updated = await prisma.run.update({ where: { id: run.id }, data: { activeStepOrder: nextStep.order } });
        await captureRunEvidence(run.id, "STEP", stepResult.id);
        return json(updated);
      }
      await captureRunEvidence(run.id, "END", stepResult.id);
      const completed = await prisma.run.update({ where: { id: run.id }, data: { status: RunStatus.COMPLETED, outcome: RunOutcome.PASSED, activeStepOrder: null, completedAt } });
      await updateReservedDataSet(run.id, RunOutcome.PASSED);
      await prisma.auditEvent.create({ data: { actorId: user.id, action: "RUN_PASSED", entityType: "Run", entityId: run.id } });
      await closeRunBrowser(run.id);
      return json(completed);
    }
    if (request.method === "POST" && path[0] === "runs" && path[1] && path[2] === "interrupt") {
      const run = await prisma.run.findUnique({ where: { id: path[1] } });
      if (!run) return json({ error: "Run not found." }, 404);
      await assertProductMember(user.id, run.productId);
      if (run.mode !== RunMode.GUIDED) return json({ error: "Use the Auto Run cancel control for this Run." }, 409);
      if (run.status !== RunStatus.RUNNING) return json({ error: "This Run is no longer active." }, 409);
      await captureRunEvidence(run.id, "END");
      const completed = await prisma.run.update({ where: { id: run.id }, data: { status: RunStatus.COMPLETED, outcome: RunOutcome.INTERRUPTED, activeStepOrder: null, completedAt: new Date() } });
      await updateReservedDataSet(run.id, RunOutcome.INTERRUPTED);
      await prisma.auditEvent.create({ data: { actorId: user.id, action: "RUN_INTERRUPTED", entityType: "Run", entityId: run.id } });
      await closeRunBrowser(run.id);
      return json(completed);
    }
    if (request.method === "POST" && path[0] === "runs" && path[1] && path[2] === "resume") {
      const run = await prisma.run.findUnique({ where: { id: path[1] } });
      if (!run) return json({ error: "Run not found." }, 404);
      await assertProductMember(user.id, run.productId);
      if (run.mode !== RunMode.AUTO) return json({ error: "Only Auto Runs can be resumed at a checkpoint." }, 409);
      if (run.status !== RunStatus.PAUSED) return json({ error: "This Auto Run is not waiting at a checkpoint." }, 409);
      const resumed = await prisma.run.update({ where: { id: run.id }, data: { status: RunStatus.RUNNING, pausedAt: null } });
      await prisma.auditEvent.create({ data: { actorId: user.id, action: "AUTO_RUN_CHECKPOINT_RESUMED", entityType: "Run", entityId: run.id, details: { stepOrder: run.activeStepOrder } } });
      return json(resumed);
    }
    if (request.method === "POST" && path[0] === "runs" && path[1] && path[2] === "cancel") {
      const run = await prisma.run.findUnique({ where: { id: path[1] }, include: { attempts: { orderBy: { attemptNumber: "desc" }, take: 1 } } });
      if (!run) return json({ error: "Run not found." }, 404);
      await assertProductMember(user.id, run.productId);
      if (run.mode !== RunMode.AUTO) return json({ error: "Use the guided Run interrupt control for this Run." }, 409);
      if (run.status === RunStatus.COMPLETED) return json({ error: "This Auto Run is already complete." }, 409);
      const completedAt = new Date();
      if (run.status === RunStatus.QUEUED) {
        const cancelled = await prisma.$transaction(async (tx) => {
          const updated = await tx.run.update({ where: { id: run.id }, data: { status: RunStatus.COMPLETED, outcome: RunOutcome.INTERRUPTED, failureReason: RunFailureReason.CANCELLED, evidenceStatus: "PARTIAL", activeStepOrder: null, completedAt } });
          const attempt = run.attempts[0];
          if (attempt) await tx.runAttempt.update({ where: { id: attempt.id }, data: { status: RunAttemptStatus.COMPLETED, failureReason: RunFailureReason.CANCELLED, completedAt } });
          await tx.auditEvent.create({ data: { actorId: user.id, action: "AUTO_RUN_CANCELLED", entityType: "Run", entityId: run.id, details: { beforeStart: true } } });
          return updated;
        });
        await updateReservedDataSet(run.id, RunOutcome.INTERRUPTED);
        await syncReleaseRunItemForRun(run.id, RunOutcome.INTERRUPTED);
        return json(cancelled);
      }
      const cancelling = await prisma.run.update({ where: { id: run.id }, data: { status: RunStatus.CANCELLING, cancellingAt: completedAt } });
      await prisma.auditEvent.create({ data: { actorId: user.id, action: "AUTO_RUN_CANCELLATION_REQUESTED", entityType: "Run", entityId: run.id } });
      return json(cancelling, 202);
    }
    if (request.method === "GET" && path[0] === "evidence" && path[1] && path[2] === "access") {
      const evidence = await prisma.evidenceItem.findUnique({ where: { id: path[1] }, include: { run: true } });
      if (!evidence || !evidence.objectKey) return json({ error: "Evidence artifact not found." }, 404);
      await assertProductMember(user.id, evidence.run.productId);
      return json({ url: await signedEvidenceUrl(evidence.objectKey), expiresInSeconds: 900 });
    }
    const recordingId = path[1];
    if (path[0] === "recordings" && recordingId) {
      const recording = await prisma.recordingSession.findUnique({ where: { id: recordingId }, include: { steps: { orderBy: { order: "asc" } }, variables: true } });
      if (!recording) return json({ error: "Recording not found." }, 404);
      await assertProductMember(user.id, recording.productId);
      if (request.method === "GET" && path[2] === "steps") return json(recording.steps);
      if (request.method === "POST" && path[2] === "launch") {
        const token = body.token;
        if (!token || hash(token) !== recording.tokenHash) return json({ error: "Invalid recording launch token." }, 403);
        await prisma.recordingSession.update({ where: { id: recording.id }, data: { status: RecordingStatus.ACTIVE } });
        if (!recording.steps.some((step) => step.kind === StepKind.NAVIGATION && JSON.stringify(step.target).includes(recording.targetUrl))) {
          await prisma.recordedStep.create({ data: { recordingSessionId: recording.id, order: (recording.steps.at(-1)?.order ?? 0) + 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: recording.targetUrl, title: "Demo CRM" } } });
        }
        try {
          await launchRecordingBrowser(recording.targetUrl, token, recording.id);
        } catch (error) {
          await prisma.recordingSession.update({ where: { id: recording.id }, data: { status: RecordingStatus.DRAFT } });
          throw error;
        }
        return json({ viewerUrl: process.env.BROWSER_VIEWER_URL });
      }
      if (request.method === "PATCH" && path[2] === "steps" && path[3]) {
        const currentStep = recording.steps.find((step) => step.id === path[3]);
        if (!currentStep) return json({ error: "Step not found." }, 404);
        if (body.isCheckpoint !== undefined && typeof body.isCheckpoint !== "boolean") return json({ error: "Checkpoint must be true or false." }, 400);
        const step = await prisma.$transaction(async (tx) => {
          if (body.variableName !== undefined && body.variableName) {
            if (currentStep.kind !== StepKind.TEXT_ENTRY || currentStep.isRedacted || !currentStep.value) throw new Error("VARIABLE_STEP_UNSUPPORTED");
            const variableName = canonicalVariableName(body.variableName);
            if (isSecretLikeVariable(variableName, currentStep.value)) throw new Error("VARIABLE_SECRET_REJECTED");
            const existing = await tx.recordingVariable.findUnique({ where: { recordingSessionId_name: { recordingSessionId: recording.id, name: variableName } } });
            if (existing?.encryptedValue && decryptVariableValue(existing.encryptedValue) !== currentStep.value) throw new Error("VARIABLE_VALUE_CONFLICT");
            await tx.recordingVariable.upsert({ where: { recordingSessionId_name: { recordingSessionId: recording.id, name: variableName } }, create: { recordingSessionId: recording.id, name: variableName, encryptedValue: encryptVariableValue(currentStep.value) }, update: {} });
            return tx.recordedStep.update({ where: { id: path[3] }, data: { ...(body.description !== undefined ? { description: body.description || null } : {}), ...(body.expectedOutcome !== undefined ? { expectedOutcome: body.expectedOutcome || null } : {}), variableName, value: variablePlaceholder(variableName), ...(body.isCheckpoint !== undefined ? { isCheckpoint: body.isCheckpoint } : {}) } });
          }
          return tx.recordedStep.update({
            where: { id: path[3] },
            data: {
              ...(body.description !== undefined ? { description: body.description || null } : {}),
              ...(body.expectedOutcome !== undefined ? { expectedOutcome: body.expectedOutcome || null } : {}),
              ...(body.variableName !== undefined ? { variableName: null } : {}),
              ...(body.isCheckpoint !== undefined ? { isCheckpoint: body.isCheckpoint } : {})
            }
          });
        });
        return json(step);
      }
      if (request.method === "POST" && path[2] === "save") {
        if (recording.status === RecordingStatus.SAVED) return json({ error: "Recording already saved." }, 409);
        const testCase = await prisma.$transaction(async (tx) => {
          const created = await tx.testCase.create({ data: { productId: recording.productId, ownerId: recording.ownerId, recordingSessionId: recording.id, name: recording.testName, versions: { create: { version: 1, steps: { create: recording.steps.map((step) => ({ order: step.order, kind: step.kind, timestamp: step.timestamp, target: step.target === null ? Prisma.JsonNull : step.target as Prisma.InputJsonValue, value: step.value, isRedacted: step.isRedacted, description: step.description, expectedOutcome: step.expectedOutcome, variableName: step.variableName, isCheckpoint: step.isCheckpoint })) }, variables: { create: recording.variables.map((variable) => ({ name: variable.name, staticValueEncrypted: variable.encryptedValue })) } } } } });
          await tx.recordingSession.update({ where: { id: recording.id }, data: { status: RecordingStatus.SAVED } });
          await tx.auditEvent.create({ data: { actorId: user.id, action: "TEST_CASE_SAVED", entityType: "TestCase", entityId: created.id } });
          return created;
        });
        await releaseBrowserAfterRecording();
        return json(testCase, 201);
      }
      if (request.method === "DELETE" && path.length === 2) {
        if (recording.status === RecordingStatus.SAVED) return json({ error: "Saved tests cannot be discarded." }, 409);
        await releaseBrowserAfterRecording();
        await prisma.recordingSession.delete({ where: { id: recording.id } });
        return new NextResponse(null, { status: 204 });
      }
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "UNAUTHORIZED") return json({ error: "Sign in required." }, 401);
    if (code === "FORBIDDEN") return json({ error: "You do not have access to this resource." }, 403);
    if (code === "BROWSER_LAUNCH_IN_PROGRESS") return json({ error: "The live browser is still starting. Wait a moment, then try again." }, 409);
    if (code === "BROWSER_BUSY") return json({ error: "Another local browser session is active. Finish it before launching this workspace." }, 409);
    if (code === "RUN_BROWSER_UNAVAILABLE") return json({ error: "The guided Run browser is unavailable. Refresh the Run or start a new one." }, 409);
    if (code === "VARIABLE_ENCRYPTION_UNAVAILABLE") return json({ error: "Variable encryption is not configured. Set VARIABLE_ENCRYPTION_KEY and try again." }, 503);
    if (code === "VARIABLE_CIPHERTEXT_INVALID") return json({ error: "A saved variable value cannot be read safely. Configure a replacement value before running this Test Case." }, 409);
    if (code === "VARIABLE_NAME_INVALID") return json({ error: "Variable names must start with a letter and contain only lowercase letters, numbers, or underscores." }, 400);
    if (code === "VARIABLE_SECRET_REJECTED") return json({ error: "Passwords, tokens, cookies, authorization values, and API-key values cannot be stored as Phase 4 variables." }, 400);
    if (code === "VARIABLE_STEP_UNSUPPORTED") return json({ error: "Only non-secret text-entry steps can become variables." }, 400);
    if (code === "VARIABLE_VALUE_CONFLICT") return json({ error: "Steps using the same variable name must have the same recorded value." }, 409);
    if (code === "RELEASE_EMPTY") return json({ error: "A Release needs at least one tagged Test Case before it can run." }, 409);
    if (code === "RELEASE_TEST_CASE_INVALID") return json({ error: "A tagged Test Case no longer has a runnable current version." }, 409);
    if (code === "VARIABLE_DATA_SET_UNAVAILABLE") return json({ error: "The selected Test Data Set is no longer safe and available. Choose another data set." }, 409);
    if (code.startsWith("VARIABLE_BINDING_REQUIRED:")) return json({ error: `Choose a value source for ${code.slice("VARIABLE_BINDING_REQUIRED:".length)} before starting this Run.` }, 409);
    if (code.startsWith("VARIABLE_VALUE_REQUIRED:")) return json({ error: `Enter a value for ${code.slice("VARIABLE_VALUE_REQUIRED:".length)} before starting this Run.` }, 400);
    if (code.startsWith("VARIABLE_DATA_SET_REQUIRED:")) return json({ error: `Choose a Test Data Set for ${code.slice("VARIABLE_DATA_SET_REQUIRED:".length)} before starting this Run.` }, 400);
    if (code.startsWith("VARIABLE_DATA_SET_FIELD_MISSING:")) return json({ error: `The selected Test Data Set does not provide ${code.slice("VARIABLE_DATA_SET_FIELD_MISSING:".length)}.` }, 409);
    if (code.startsWith("BROWSER_")) return json({ error: "The live browser could not start. Try launching it again." }, 503);
    if (error instanceof GitHubIntegrationError) return json({ error: error.message }, error.transient ? 503 : 400);
    if (error instanceof JiraAdapterError) return json({ error: error.message }, error.transient ? 503 : 400);
    console.error("Sentinel API failure", error);
    return json({ error: "The recording browser could not be launched. Check the Sentinel container logs for details." }, 500);
  }
  return json({ error: "Not found." }, 404);
}

export const GET = (request: Request, context: Context) => route(request, context);
export const POST = (request: Request, context: Context) => route(request, context);
export const PUT = (request: Request, context: Context) => route(request, context);
export const PATCH = (request: Request, context: Context) => route(request, context);
export const DELETE = (request: Request, context: Context) => route(request, context);
export const OPTIONS = (request: Request, context: Context) => route(request, context);
