import { NotificationDeliveryStatus, NotificationType, Prisma, RunFailureReason, RunOutcome } from "@prisma/client";
import nodemailer from "nodemailer";
import { enqueueNotification } from "./queue";
import { prisma } from "./prisma";

type NotificationRecord = {
  id: string;
  recipientId: string;
  productId: string | null;
  runId: string | null;
  releaseRunId: string | null;
  changeProposalId: string | null;
  type: NotificationType;
};

type MailSummary = { subject: string; text: string };

const safeReasonMessages: Record<RunFailureReason, string> = {
  SELECTOR_NOT_FOUND: "A required page element was not found.",
  SELECTOR_AMBIGUOUS: "A required page element was ambiguous.",
  ACTION_FAILED: "A recorded browser action could not be completed.",
  NAVIGATION_TIMEOUT: "The target page did not respond in time.",
  BROWSER_STARTUP: "The isolated browser could not start.",
  CHECKPOINT_TIMEOUT: "The checkpoint review window expired.",
  CANCELLED: "The Run was cancelled.",
  VARIABLE_UNSUPPORTED: "The Test Case requires a Run variable that is not available.",
  INFRASTRUCTURE_ERROR: "A local execution service was unavailable."
};

function appUrl(path: string) {
  return new URL(path, process.env.SENTINEL_APP_URL ?? "http://localhost:3001").toString();
}

export function safeFailureReason(reason: RunFailureReason | null | undefined) {
  return reason ? safeReasonMessages[reason] : "The Run ended with a failure.";
}

export function isTransientDeliveryError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EHOSTUNREACH", "ENOTFOUND", "EPIPE", "ESOCKET"].includes(code);
}

async function enqueueCreatedNotifications(notifications: NotificationRecord[]) {
  for (const notification of notifications) {
    try {
      await enqueueNotification({ notificationId: notification.id });
    } catch (error) {
      console.error("Sentinel could not queue a notification", notification.id, error instanceof Error ? error.message : error);
    }
  }
}

async function createNotifications(input: {
  recipientIds: string[];
  productId?: string;
  runId?: string;
  releaseRunId?: string;
  changeProposalId?: string;
  type: NotificationType;
  actorId: string;
}) {
  const recipientIds = [...new Set(input.recipientIds)];
  const created: NotificationRecord[] = [];
  for (const recipientId of recipientIds) {
    try {
      const notification = await prisma.$transaction(async (tx) => {
        const createdNotification = await tx.notification.create({
          data: {
            recipientId,
            productId: input.productId,
            runId: input.runId,
            releaseRunId: input.releaseRunId,
            changeProposalId: input.changeProposalId,
            type: input.type
          }
        });
        await tx.auditEvent.create({
          data: {
            actorId: input.actorId,
            action: "NOTIFICATION_CREATED",
            entityType: "Notification",
            entityId: createdNotification.id,
            details: { type: input.type, recipientId, runId: input.runId, releaseRunId: input.releaseRunId, changeProposalId: input.changeProposalId }
          }
        });
        return createdNotification;
      });
      created.push(notification);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    }
  }
  await enqueueCreatedNotifications(created);
  return created;
}

export async function notifyRunFailure(runId: string) {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { testCase: { select: { ownerId: true } } }
  });
  if (!run || run.outcome !== RunOutcome.FAILED) return [];
  return createNotifications({
    recipientIds: [run.testCase.ownerId, run.initiatedById],
    productId: run.productId,
    runId: run.id,
    type: NotificationType.RUN_FAILED,
    actorId: run.initiatedById
  });
}

export async function notifyAutoRunCheckpoint(runId: string) {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { testCase: { select: { ownerId: true } } }
  });
  if (!run) return [];
  return createNotifications({
    recipientIds: [run.testCase.ownerId, run.initiatedById],
    productId: run.productId,
    runId: run.id,
    type: NotificationType.AUTO_RUN_CHECKPOINT,
    actorId: run.initiatedById
  });
}

export async function notifyReleaseCompletion(releaseRunId: string) {
  const releaseRun = await prisma.releaseRun.findUnique({
    where: { id: releaseRunId },
    include: { release: { select: { ownerId: true } } }
  });
  if (!releaseRun || !releaseRun.completedAt) return [];
  return createNotifications({
    recipientIds: [releaseRun.release.ownerId, releaseRun.initiatedById],
    releaseRunId: releaseRun.id,
    type: NotificationType.RELEASE_RUN_COMPLETED,
    actorId: releaseRun.initiatedById
  });
}

export async function notifyChangeProposalSubmitted(proposalId: string) {
  const proposal = await prisma.changeProposal.findUnique({ where: { id: proposalId } });
  if (!proposal || proposal.status !== "SUBMITTED") return [];
  return createNotifications({
    recipientIds: [proposal.ownerId],
    productId: proposal.productId,
    changeProposalId: proposal.id,
    type: NotificationType.CHANGE_PROPOSAL_REQUESTED,
    actorId: proposal.createdById
  });
}

export async function notifyChangeProposalResolved(proposalId: string) {
  const proposal = await prisma.changeProposal.findUnique({ where: { id: proposalId } });
  if (!proposal || (proposal.status !== "APPROVED" && proposal.status !== "REJECTED")) return [];
  return createNotifications({
    recipientIds: [proposal.ownerId, proposal.createdById],
    productId: proposal.productId,
    changeProposalId: proposal.id,
    type: NotificationType.CHANGE_PROPOSAL_RESOLVED,
    actorId: proposal.ownerId
  });
}

export function renderSafeNotificationEmail(notification: {
  type: NotificationType;
  createdAt: Date;
  product: { name: string } | null;
  run: { id: string; outcome: RunOutcome | null; failureReason: RunFailureReason | null; testCase: { name: string } } | null;
  releaseRun: { readiness: string; release: { id: string; name: string } } | null;
  changeProposal?: { id: string; status: string; testCase: { name: string } } | null;
}) : MailSummary {
  if (notification.type === NotificationType.RUN_FAILED && notification.run) {
    return {
      subject: `Sentinel: ${notification.run.testCase.name} failed`,
      text: `Product: ${notification.product?.name ?? "Unknown Product"}\nTest Case: ${notification.run.testCase.name}\nOutcome: Failed\nTimestamp: ${notification.createdAt.toISOString()}\nReason: ${safeFailureReason(notification.run.failureReason)}\nOpen in Sentinel: ${appUrl(`/runs/${notification.run.id}`)}`
    };
  }
  if (notification.type === NotificationType.AUTO_RUN_CHECKPOINT && notification.run) {
    return {
      subject: `Sentinel: checkpoint needs review for ${notification.run.testCase.name}`,
      text: `Product: ${notification.product?.name ?? "Unknown Product"}\nTest Case: ${notification.run.testCase.name}\nState: Auto Run paused at a checkpoint\nTimestamp: ${notification.createdAt.toISOString()}\nOpen in Sentinel: ${appUrl(`/runs/${notification.run.id}`)}`
    };
  }
  if (notification.type === NotificationType.CHANGE_PROPOSAL_REQUESTED && notification.changeProposal) {
    return {
      subject: `Sentinel: change review needed for ${notification.changeProposal.testCase.name}`,
      text: `Test Case: ${notification.changeProposal.testCase.name}\nState: A failed Run has a proposed expectation update for your review.\nTimestamp: ${notification.createdAt.toISOString()}\nOpen in Sentinel: ${appUrl("/review")}`
    };
  }
  if (notification.type === NotificationType.CHANGE_PROPOSAL_RESOLVED && notification.changeProposal) {
    return {
      subject: `Sentinel: change proposal ${notification.changeProposal.status.toLowerCase()}`,
      text: `Test Case: ${notification.changeProposal.testCase.name}\nDecision: ${notification.changeProposal.status}\nTimestamp: ${notification.createdAt.toISOString()}\nOpen in Sentinel: ${appUrl("/review")}`
    };
  }
  return {
    subject: `Sentinel: Release ${notification.releaseRun?.release.name ?? "Run"} completed`,
    text: `Release: ${notification.releaseRun?.release.name ?? "Unknown Release"}\nReadiness: ${notification.releaseRun?.readiness ?? "Completed"}\nTimestamp: ${notification.createdAt.toISOString()}\nOpen in Sentinel: ${notification.releaseRun ? appUrl(`/releases/${notification.releaseRun.release.id}`) : appUrl("/notifications")}`
  };
}

export async function deliverNotification(notificationId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: {
      recipient: { select: { email: true } },
      product: { select: { name: true } },
      run: { select: { id: true, outcome: true, failureReason: true, testCase: { select: { name: true } } } },
      releaseRun: { select: { id: true, readiness: true, release: { select: { id: true, name: true } } } }
      ,changeProposal: { select: { id: true, status: true, testCase: { select: { name: true } } } }
    }
  });
  if (!notification || notification.deliveryStatus === NotificationDeliveryStatus.SENT || notification.deliveryStatus === NotificationDeliveryStatus.FAILED) return;

  const attempt = notification.deliveryAttempts + 1;
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "mailpit",
      port: Number(process.env.SMTP_PORT ?? "1025"),
      secure: false
    });
    const summary = renderSafeNotificationEmail(notification);
    await transport.sendMail({ from: process.env.EMAIL_FROM ?? "Sentinel <noreply@sentinel.local>", to: notification.recipient.email, subject: summary.subject, text: summary.text });
    await prisma.$transaction(async (tx) => {
      const updated = await tx.notification.updateMany({
        where: { id: notification.id, deliveryStatus: NotificationDeliveryStatus.PENDING },
        data: { deliveryStatus: NotificationDeliveryStatus.SENT, deliveryAttempts: attempt, deliveryError: null, sentAt: new Date() }
      });
      if (updated.count) await tx.auditEvent.create({ data: { actorId: notification.recipientId, action: "NOTIFICATION_SENT", entityType: "Notification", entityId: notification.id, details: { type: notification.type, attempt } } });
    });
  } catch (error) {
    const transient = isTransientDeliveryError(error);
    const finalFailure = !transient || attempt >= 2;
    const updated = await prisma.notification.updateMany({
      where: { id: notification.id, deliveryStatus: NotificationDeliveryStatus.PENDING },
      data: { deliveryAttempts: attempt, deliveryStatus: finalFailure ? NotificationDeliveryStatus.FAILED : NotificationDeliveryStatus.PENDING, deliveryError: "SMTP delivery could not be completed safely." }
    });
    if (finalFailure && updated.count) {
      await prisma.auditEvent.create({ data: { actorId: notification.recipientId, action: "NOTIFICATION_DELIVERY_FAILED", entityType: "Notification", entityId: notification.id, details: { type: notification.type, attempt } } });
      return;
    }
    throw error;
  }
}
