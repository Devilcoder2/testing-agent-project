import { AccountStatus, AuthTokenKind, MessagingCommandStatus, MessagingDeliveryKind, MessagingDeliveryStatus, MessagingIdentityStatus, MessagingInboundUpdateStatus, MessagingProvider, OrganizationRole, RunAttemptStatus, RunFailureReason, RunMode, RunOutcome, RunStatus, VariableSource } from "@prisma/client";
import { consumeAuthToken, issueAuthToken, type SessionUser } from "./auth";
import { decryptMessagingIdentifier, encryptMessagingIdentifier, messagingIdentifierHash } from "./messaging";
import { prisma } from "./prisma";
import { createRedisConnection, enqueueAutoRun } from "./queue";
import { isTransientTelegramError, sendTelegramMessage, type TelegramKeyboard } from "./telegram";

const CONFIRMATION_MS = 5 * 60 * 1000;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 8;

type Identity = { id: string; organizationId: string; userId: string; chatIdEncrypted: string; status: MessagingIdentityStatus };
type ActionName = "MENU_TESTS" | "MENU_RELEASES" | "OPEN_RELEASE" | "SELECT_TEST" | "REVIEW" | "CONFIRM" | "CANCEL" | "NEXT_TESTS" | "PREVIOUS_TESTS";

function targetAllowed(targetUrl: string) {
  return targetUrl === (process.env.DEMO_TARGET_URL ?? "http://demo-target");
}

function callback(actionId: string) {
  return `m:${actionId}`;
}

function safeReason(error: unknown) {
  return error instanceof Error && /^[A-Z0-9_]{3,80}$/.test(error.message) ? error.message : "MESSAGING_PROCESSING_FAILED";
}

async function activeIdentity(identityId: string) {
  const identity = await prisma.messagingIdentity.findUnique({
    where: { id: identityId },
    include: { user: true }
  });
  if (!identity || identity.status !== MessagingIdentityStatus.ACTIVE || identity.user.accountStatus !== AccountStatus.ACTIVE) return null;
  const membership = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: identity.organizationId, userId: identity.userId } } });
  if (!membership) return null;
  return { identity, role: membership.role };
}

async function hasProductAccess(userId: string, role: OrganizationRole, productId: string) {
  if (role === OrganizationRole.ADMIN) return true;
  return Boolean(await prisma.productMembership.findUnique({ where: { userId_productId: { userId, productId } } }));
}

async function createAction(commandId: string, action: ActionName, referenceId?: string | null) {
  return prisma.messagingAction.create({ data: { commandId, action, referenceId: referenceId ?? null } });
}

async function createMenuCommand(identity: Identity, sourceReleaseId?: string | null) {
  const command = await prisma.messagingCommand.create({
    data: {
      identityId: identity.id,
      organizationId: identity.organizationId,
      userId: identity.userId,
      sourceReleaseId: sourceReleaseId ?? null,
      expiresAt: new Date(Date.now() + CONFIRMATION_MS)
    }
  });
  const [tests, releases] = await Promise.all([
    createAction(command.id, "MENU_TESTS"),
    createAction(command.id, "MENU_RELEASES")
  ]);
  return { command, keyboard: [[{ text: "Test Cases", callback_data: callback(tests.id) }, { text: "Releases", callback_data: callback(releases.id) }]] satisfies TelegramKeyboard };
}

async function sendMainMenu(identity: Identity) {
  const menu = await createMenuCommand(identity);
  await sendTelegramMessage(decryptMessagingIdentifier(identity.chatIdEncrypted), "Choose Test Cases or Releases. Sentinel will show only Tests you can currently access.", menu.keyboard);
}

function eligibleReason(testCase: { recordingSession: { targetUrl: string }; versions: Array<{ version: number; steps: Array<{ isCheckpoint: boolean }>; variables: Array<{ staticValueEncrypted: string | null }> }>; currentVersion: number }) {
  const version = testCase.versions.find((candidate) => candidate.version === testCase.currentVersion);
  if (!version?.steps.length) return "NO_SAVED_STEPS";
  if (!targetAllowed(testCase.recordingSession.targetUrl)) return "TARGET_NOT_ALLOWLISTED";
  if (version.steps.some((step) => step.isCheckpoint)) return "CHECKPOINT_UNAVAILABLE";
  if (version.variables.some((variable) => !variable.staticValueEncrypted)) return "VARIABLE_REQUIRES_STATIC_DEFAULT";
  return null;
}

async function listTests(identity: Identity, role: OrganizationRole, commandId: string, page = 0, releaseId?: string | null) {
  const where = {
    ...(releaseId ? { releaseTests: { some: { releaseId } } } : {}),
    product: {
      organizationId: identity.organizationId,
      ...(role === OrganizationRole.ADMIN ? {} : { memberships: { some: { userId: identity.userId } } })
    }
  };
  const [total, testCases, selections] = await Promise.all([
    prisma.testCase.count({ where }),
    prisma.testCase.findMany({
      where,
      include: { product: { select: { name: true } }, recordingSession: { select: { targetUrl: true } }, versions: { include: { steps: { select: { isCheckpoint: true } }, variables: { select: { staticValueEncrypted: true } } } } },
      orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE
    }),
    prisma.messagingCommandSelection.findMany({ where: { commandId }, select: { testCaseId: true } })
  ]);
  const selected = new Set(selections.map((item) => item.testCaseId));
  const keyboard: TelegramKeyboard = [];
  const unavailable: string[] = [];
  for (const testCase of testCases) {
    const reason = eligibleReason(testCase);
    if (reason) {
      unavailable.push(`${testCase.name}: ${reason}`);
      continue;
    }
    const action = await createAction(commandId, "SELECT_TEST", testCase.id);
    keyboard.push([{ text: `${selected.has(testCase.id) ? "✓ " : ""}${testCase.name} · ${testCase.product.name}`, callback_data: callback(action.id) }]);
  }
  const navigation: TelegramKeyboard[0] = [];
  if (page > 0) {
    const action = await createAction(commandId, "PREVIOUS_TESTS", String(page - 1));
    navigation.push({ text: "Previous", callback_data: callback(action.id) });
  }
  if ((page + 1) * PAGE_SIZE < total) {
    const action = await createAction(commandId, "NEXT_TESTS", String(page + 1));
    navigation.push({ text: "Next", callback_data: callback(action.id) });
  }
  if (navigation.length) keyboard.push(navigation);
  const review = await createAction(commandId, "REVIEW");
  const cancel = await createAction(commandId, "CANCEL");
  keyboard.push([{ text: `Review selection (${selected.size})`, callback_data: callback(review.id) }, { text: "Cancel", callback_data: callback(cancel.id) }]);
  const noTests = total === 0 ? "No accessible Test Cases are available." : "Select eligible Test Cases, then review your selection.";
  const skipped = unavailable.length ? ` ${unavailable.slice(0, 3).join("; ")}${unavailable.length > 3 ? "; more are unavailable." : ""}` : "";
  await sendTelegramMessage(decryptMessagingIdentifier(identity.chatIdEncrypted), `${noTests}${skipped}`, keyboard);
}

async function listReleases(identity: Identity, role: OrganizationRole, commandId: string) {
  const releases = await prisma.release.findMany({
    include: { tests: { select: { testCase: { select: { productId: true } } } } },
    orderBy: { updatedAt: "desc" },
    take: 20
  });
  const accessible: Array<{ id: string; name: string }> = [];
  for (const release of releases) {
    const allowed = await Promise.all(release.tests.map((item) => hasProductAccess(identity.userId, role, item.testCase.productId)));
    if (release.tests.length && allowed.every(Boolean)) accessible.push(release);
  }
  const keyboard: TelegramKeyboard = [];
  for (const release of accessible) {
    const action = await createAction(commandId, "OPEN_RELEASE", release.id);
    keyboard.push([{ text: release.name, callback_data: callback(action.id) }]);
  }
  const cancel = await createAction(commandId, "CANCEL");
  keyboard.push([{ text: "Cancel", callback_data: callback(cancel.id) }]);
  await sendTelegramMessage(decryptMessagingIdentifier(identity.chatIdEncrypted), accessible.length ? "Choose a Release to browse its Test Cases. Telegram will still start individual Tests only." : "No accessible Releases are available.", keyboard);
}

async function reviewSelection(identity: Identity, commandId: string) {
  const command = await prisma.messagingCommand.findUnique({ where: { id: commandId }, include: { selections: { include: { testCase: { include: { product: { select: { name: true } } } } } } } });
  if (!command || !command.selections.length) {
    await sendTelegramMessage(decryptMessagingIdentifier(identity.chatIdEncrypted), "Select at least one eligible Test Case before confirmation.");
    return;
  }
  await prisma.messagingCommand.update({ where: { id: commandId }, data: { status: MessagingCommandStatus.CONFIRMING, expiresAt: new Date(Date.now() + CONFIRMATION_MS) } });
  const [confirm, cancel] = await Promise.all([createAction(commandId, "CONFIRM"), createAction(commandId, "CANCEL")]);
  const names = command.selections.slice(0, 8).map((item) => `${item.testCase.name} (${item.testCase.product.name})`).join("\n");
  await sendTelegramMessage(decryptMessagingIdentifier(identity.chatIdEncrypted), `Confirm ${command.selections.length} Test Case${command.selections.length === 1 ? "" : "s"} within five minutes:\n${names}`, [[{ text: "Confirm Auto Runs", callback_data: callback(confirm.id) }, { text: "Cancel", callback_data: callback(cancel.id) }]]);
}

async function queueSelectedRuns(identity: Identity, role: OrganizationRole, commandId: string) {
  const command = await prisma.messagingCommand.findUnique({ where: { id: commandId }, include: { selections: true } });
  if (!command || command.status === MessagingCommandStatus.QUEUED) return;
  if (command.expiresAt <= new Date()) {
    await prisma.messagingCommand.update({ where: { id: commandId }, data: { status: MessagingCommandStatus.EXPIRED, terminalAt: new Date(), safeReason: "CONFIRMATION_EXPIRED" } });
    await sendTelegramMessage(decryptMessagingIdentifier(identity.chatIdEncrypted), "This selection expired. Open /menu to start again.");
    return;
  }
  const selectedIds = command.selections.map((item) => item.testCaseId);
  if (!selectedIds.length) throw new Error("NO_TEST_SELECTION");
  const created = await prisma.$transaction(async (tx) => {
    const membership = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: identity.organizationId, userId: identity.userId } }, include: { user: true } });
    if (!membership || membership.user.accountStatus !== AccountStatus.ACTIVE) throw new Error("ACCOUNT_ACCESS_REVOKED");
    const testCases = await tx.testCase.findMany({
      where: { id: { in: selectedIds }, product: { organizationId: identity.organizationId } },
      include: { recordingSession: true, versions: { include: { steps: { orderBy: { order: "asc" } }, variables: true } } }
    });
    if (testCases.length !== selectedIds.length) throw new Error("TEST_SELECTION_STALE");
    const productAccess = membership.role === OrganizationRole.ADMIN
      ? new Set(testCases.map((testCase) => testCase.productId))
      : new Set((await tx.productMembership.findMany({ where: { userId: identity.userId, productId: { in: testCases.map((testCase) => testCase.productId) } }, select: { productId: true } })).map((item) => item.productId));
    const reasons: string[] = [];
    for (const testCase of testCases) {
      if (!productAccess.has(testCase.productId)) reasons.push(`${testCase.id}:PRODUCT_ACCESS_REVOKED`);
      const reason = eligibleReason(testCase);
      if (reason) reasons.push(`${testCase.id}:${reason}`);
    }
    if (reasons.length) throw new Error("SELECTION_INELIGIBLE");
    const queued: Array<{ runId: string; attemptId: string }> = [];
    for (const testCase of testCases) {
      const version = testCase.versions.find((candidate) => candidate.version === testCase.currentVersion)!;
      const run = await tx.run.create({
        data: {
          testCaseId: testCase.id,
          testCaseVersionId: version.id,
          productId: testCase.productId,
          initiatedById: identity.userId,
          targetUrl: testCase.recordingSession.targetUrl,
          mode: RunMode.AUTO,
          activeStepOrder: version.steps[0].order,
          stepResults: { create: version.steps.map((step) => ({ testStepId: step.id, order: step.order })) },
          attempts: { create: { attemptNumber: 1 } },
          variableBindings: { create: version.variables.map((variable) => ({ name: variable.name, source: VariableSource.STATIC, valueEncrypted: variable.staticValueEncrypted!, testVariableId: variable.id })) },
          messagingDeliveries: { create: { identityId: identity.id, kind: MessagingDeliveryKind.RUN_TERMINAL } }
        },
        include: { attempts: true }
      });
      await tx.auditEvent.create({ data: { actorId: identity.userId, action: "TELEGRAM_AUTO_RUN_QUEUED", entityType: "Run", entityId: run.id, details: { testCaseVersion: version.version, commandId } } });
      queued.push({ runId: run.id, attemptId: run.attempts[0].id });
    }
    await tx.messagingCommand.update({ where: { id: command.id }, data: { status: MessagingCommandStatus.QUEUED, confirmedAt: new Date(), terminalAt: new Date(), safeReason: null } });
    await tx.auditEvent.create({ data: { actorId: identity.userId, action: "TELEGRAM_SELECTION_CONFIRMED", entityType: "MessagingCommand", entityId: command.id, details: { runCount: queued.length } } });
    return queued;
  });
  for (const item of created) {
    try {
      const jobId = await enqueueAutoRun(item);
      await prisma.runAttempt.update({ where: { id: item.attemptId }, data: { jobId } });
    } catch {
      const completedAt = new Date();
      await prisma.$transaction([
        prisma.run.update({ where: { id: item.runId }, data: { status: RunStatus.COMPLETED, outcome: RunOutcome.FAILED, failureReason: RunFailureReason.INFRASTRUCTURE_ERROR, evidenceStatus: "PARTIAL", activeStepOrder: null, completedAt } }),
        prisma.runAttempt.update({ where: { id: item.attemptId }, data: { status: RunAttemptStatus.COMPLETED, failureReason: RunFailureReason.INFRASTRUCTURE_ERROR, completedAt } }),
        prisma.messagingDelivery.updateMany({ where: { runId: item.runId }, data: { terminalAt: completedAt } })
      ]);
    }
  }
  await sendTelegramMessage(decryptMessagingIdentifier(identity.chatIdEncrypted), `Queued ${created.length} Auto Run${created.length === 1 ? "" : "s"}. Terminal results will arrive here.`);
}

export async function createTelegramLink(user: SessionUser) {
  const token = await issueAuthToken(user.id, AuthTokenKind.TELEGRAM_LINK, user.organizationId);
  return token;
}

export async function telegramIdentityStatus(user: SessionUser) {
  const identity = await prisma.messagingIdentity.findUnique({ where: { provider_userId_organizationId: { provider: MessagingProvider.TELEGRAM, userId: user.id, organizationId: user.organizationId } } });
  return { linked: identity?.status === MessagingIdentityStatus.ACTIVE, linkedAt: identity?.status === MessagingIdentityStatus.ACTIVE ? identity.linkedAt : null };
}

export async function unlinkTelegram(user: SessionUser) {
  const identity = await prisma.messagingIdentity.findUnique({ where: { provider_userId_organizationId: { provider: MessagingProvider.TELEGRAM, userId: user.id, organizationId: user.organizationId } } });
  if (!identity || identity.status !== MessagingIdentityStatus.ACTIVE) return false;
  await prisma.$transaction([
    prisma.messagingIdentity.update({ where: { id: identity.id }, data: { status: MessagingIdentityStatus.REVOKED, revokedAt: new Date() } }),
    prisma.auditEvent.create({ data: { actorId: user.id, action: "TELEGRAM_UNLINKED", entityType: "MessagingIdentity", entityId: identity.id } })
  ]);
  return true;
}

export async function linkTelegramChat(linkToken: string, chatId: string) {
  const token = await consumeAuthToken(linkToken, AuthTokenKind.TELEGRAM_LINK);
  if (!token?.organizationId) throw new Error("TELEGRAM_LINK_INVALID");
  const membership = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: token.organizationId, userId: token.userId } }, include: { user: true } });
  if (!membership || membership.user.accountStatus !== AccountStatus.ACTIVE) throw new Error("TELEGRAM_LINK_ACCESS_REVOKED");
  const encrypted = encryptMessagingIdentifier(chatId);
  const hash = messagingIdentifierHash(chatId);
  const existingChat = await prisma.messagingIdentity.findUnique({ where: { provider_chatIdHash: { provider: MessagingProvider.TELEGRAM, chatIdHash: hash } } });
  if (existingChat && (existingChat.userId !== token.userId || existingChat.organizationId !== token.organizationId)) throw new Error("TELEGRAM_CHAT_ALREADY_LINKED");
  const identity = await prisma.messagingIdentity.upsert({
    where: { provider_userId_organizationId: { provider: MessagingProvider.TELEGRAM, userId: token.userId, organizationId: token.organizationId } },
    create: { provider: MessagingProvider.TELEGRAM, organizationId: token.organizationId, userId: token.userId, chatIdEncrypted: encrypted, chatIdHash: hash },
    update: { chatIdEncrypted: encrypted, chatIdHash: hash, status: MessagingIdentityStatus.ACTIVE, linkedAt: new Date(), revokedAt: null }
  });
  await prisma.auditEvent.create({ data: { actorId: token.userId, action: "TELEGRAM_LINKED", entityType: "MessagingIdentity", entityId: identity.id } });
  return identity;
}

export async function telegramIdentityForChat(chatId: string) {
  return prisma.messagingIdentity.findUnique({ where: { provider_chatIdHash: { provider: MessagingProvider.TELEGRAM, chatIdHash: messagingIdentifierHash(chatId) } } });
}

export async function telegramInboundAllowed(identity: Identity) {
  const redis = createRedisConnection();
  try {
    const key = `sentinel:telegram:inbound:${messagingIdentifierHash(identity.id)}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, 60_000);
    return count <= 30;
  } finally {
    await redis.quit();
  }
}

export async function processTelegramUpdate(updateId: string) {
  const update = await prisma.messagingInboundUpdate.findUnique({ where: { id: updateId }, include: { identity: true } });
  if (!update || update.status === MessagingInboundUpdateStatus.PROCESSED || update.status === MessagingInboundUpdateStatus.REJECTED || !update.identityId || !update.identity) return;
  const active = await activeIdentity(update.identityId);
  if (!active) {
    await prisma.messagingInboundUpdate.update({ where: { id: update.id }, data: { status: MessagingInboundUpdateStatus.REJECTED, safeReason: "IDENTITY_ACCESS_REVOKED", processedAt: new Date() } });
    return;
  }
  try {
    if (update.command === "START" || update.command === "MENU") {
      await sendMainMenu(active.identity);
    } else if (update.callbackActionId) {
      const action = await prisma.messagingAction.findUnique({ where: { id: update.callbackActionId }, include: { command: true } });
      const terminalStatuses: MessagingCommandStatus[] = [MessagingCommandStatus.CANCELLED, MessagingCommandStatus.EXPIRED, MessagingCommandStatus.QUEUED, MessagingCommandStatus.FAILED];
      if (!action || action.command.identityId !== active.identity.id || action.command.expiresAt <= new Date() || terminalStatuses.includes(action.command.status)) {
        await sendTelegramMessage(decryptMessagingIdentifier(active.identity.chatIdEncrypted), "That selection is no longer active. Open /menu to start again.");
      } else if (action.action === "MENU_TESTS") {
        await listTests(active.identity, active.role, action.commandId);
      } else if (action.action === "MENU_RELEASES") {
        await listReleases(active.identity, active.role, action.commandId);
      } else if (action.action === "OPEN_RELEASE" && action.referenceId) {
        await prisma.messagingCommand.update({ where: { id: action.commandId }, data: { sourceReleaseId: action.referenceId } });
        await listTests(active.identity, active.role, action.commandId, 0, action.referenceId);
      } else if (action.action === "SELECT_TEST" && action.referenceId) {
        const canSelect = await hasProductAccess(active.identity.userId, active.role, (await prisma.testCase.findUnique({ where: { id: action.referenceId }, select: { productId: true } }))?.productId ?? "");
        if (!canSelect) throw new Error("PRODUCT_ACCESS_REVOKED");
        const existing = await prisma.messagingCommandSelection.findUnique({ where: { commandId_testCaseId: { commandId: action.commandId, testCaseId: action.referenceId } } });
        if (existing) await prisma.messagingCommandSelection.delete({ where: { commandId_testCaseId: { commandId: action.commandId, testCaseId: action.referenceId } } });
        else await prisma.messagingCommandSelection.create({ data: { commandId: action.commandId, testCaseId: action.referenceId } });
        await prisma.messagingCommand.update({ where: { id: action.commandId }, data: { status: MessagingCommandStatus.SELECTING, expiresAt: new Date(Date.now() + CONFIRMATION_MS) } });
        await listTests(active.identity, active.role, action.commandId, 0, action.command.sourceReleaseId);
      } else if ((action.action === "NEXT_TESTS" || action.action === "PREVIOUS_TESTS") && action.referenceId) {
        await listTests(active.identity, active.role, action.commandId, Number(action.referenceId) || 0, action.command.sourceReleaseId);
      } else if (action.action === "REVIEW") {
        await reviewSelection(active.identity, action.commandId);
      } else if (action.action === "CONFIRM") {
        await queueSelectedRuns(active.identity, active.role, action.commandId);
      } else if (action.action === "CANCEL") {
        await prisma.messagingCommand.update({ where: { id: action.commandId }, data: { status: MessagingCommandStatus.CANCELLED, terminalAt: new Date(), safeReason: "CANCELLED_BY_USER" } });
        await prisma.auditEvent.create({ data: { actorId: active.identity.userId, action: "TELEGRAM_SELECTION_CANCELLED", entityType: "MessagingCommand", entityId: action.commandId } });
        await sendTelegramMessage(decryptMessagingIdentifier(active.identity.chatIdEncrypted), "Selection cancelled. Open /menu when you are ready.");
      }
    }
    await prisma.messagingIdentity.update({ where: { id: active.identity.id }, data: { lastCommandAt: new Date() } });
    await prisma.messagingInboundUpdate.update({ where: { id: update.id }, data: { status: MessagingInboundUpdateStatus.PROCESSED, processedAt: new Date(), safeReason: null } });
  } catch (error) {
    await prisma.messagingInboundUpdate.update({ where: { id: update.id }, data: { status: MessagingInboundUpdateStatus.FAILED, safeReason: safeReason(error), processedAt: new Date() } });
    throw error;
  }
}

export async function deliverTelegramRunResult(deliveryId: string) {
  const delivery = await prisma.messagingDelivery.findUnique({ where: { id: deliveryId }, include: { identity: true, run: { include: { product: true, testCase: true } } } });
  if (!delivery || delivery.status === MessagingDeliveryStatus.SENT || delivery.status === MessagingDeliveryStatus.FAILED || delivery.run.status !== RunStatus.COMPLETED || !delivery.run.outcome) return;
  if (delivery.identity.status !== MessagingIdentityStatus.ACTIVE) {
    await prisma.messagingDelivery.update({ where: { id: delivery.id }, data: { status: MessagingDeliveryStatus.FAILED, safeError: "IDENTITY_REVOKED", terminalAt: new Date() } });
    return;
  }
  const outcome = delivery.run.outcome === RunOutcome.PASSED ? "Passed" : delivery.run.outcome === RunOutcome.FAILED ? "Failed" : "Interrupted";
  const evidence = delivery.run.evidenceStatus === "COMPLETE" ? "Evidence complete" : "Evidence partial";
  const reason = delivery.run.failureReason ? ` Reason: ${delivery.run.failureReason}.` : "";
  try {
    const redis = createRedisConnection();
    try {
      const pace = await redis.set(`sentinel:telegram:outbound:${messagingIdentifierHash(delivery.identityId)}`, "1", "PX", 1_000, "NX");
      if (!pace) throw new Error("TELEGRAM_TRANSIENT_PROVIDER_ERROR");
    } finally {
      await redis.quit();
    }
    await sendTelegramMessage(decryptMessagingIdentifier(delivery.identity.chatIdEncrypted), `${delivery.run.testCase.name} · ${delivery.run.product.name}\n${outcome} · ${delivery.run.completedAt?.toISOString() ?? new Date().toISOString()}\n${evidence}.${reason}`);
    await prisma.messagingDelivery.update({ where: { id: delivery.id }, data: { status: MessagingDeliveryStatus.SENT, attempts: { increment: 1 }, sentAt: new Date(), terminalAt: new Date(), safeError: null } });
  } catch (error) {
    const transient = isTransientTelegramError(error);
    const nextAttempts = delivery.attempts + 1;
    await prisma.messagingDelivery.update({ where: { id: delivery.id }, data: { attempts: nextAttempts, status: transient && nextAttempts < 2 ? MessagingDeliveryStatus.PENDING : MessagingDeliveryStatus.FAILED, safeError: transient ? "TELEGRAM_DELIVERY_UNAVAILABLE" : "TELEGRAM_DELIVERY_REJECTED", terminalAt: transient && nextAttempts < 2 ? null : new Date() } });
    if (!transient || nextAttempts >= 2) await prisma.auditEvent.create({ data: { actorId: delivery.run.initiatedById, action: "TELEGRAM_DELIVERY_FAILED", entityType: "MessagingDelivery", entityId: delivery.id, details: { reason: transient ? "TELEGRAM_DELIVERY_UNAVAILABLE" : "TELEGRAM_DELIVERY_REJECTED" } } });
    throw error;
  }
}

export async function createTerminalTelegramDelivery(runId: string) {
  const delivery = await prisma.messagingDelivery.findUnique({ where: { runId_kind: { runId, kind: MessagingDeliveryKind.RUN_TERMINAL } } });
  return delivery?.id ?? null;
}

export async function cleanupTelegramMetadata(now = new Date()) {
  const before = new Date(now.getTime() - RETENTION_MS);
  const [updates, deliveries, commands] = await prisma.$transaction([
    prisma.messagingInboundUpdate.deleteMany({ where: { receivedAt: { lt: before }, status: { in: [MessagingInboundUpdateStatus.PROCESSED, MessagingInboundUpdateStatus.REJECTED, MessagingInboundUpdateStatus.FAILED] } } }),
    prisma.messagingDelivery.deleteMany({ where: { terminalAt: { lt: before }, status: { in: [MessagingDeliveryStatus.SENT, MessagingDeliveryStatus.FAILED] } } }),
    prisma.messagingCommand.deleteMany({ where: { terminalAt: { lt: before }, status: { in: [MessagingCommandStatus.QUEUED, MessagingCommandStatus.CANCELLED, MessagingCommandStatus.EXPIRED, MessagingCommandStatus.FAILED] } } })
  ]);
  return updates.count + deliveries.count + commands.count;
}
