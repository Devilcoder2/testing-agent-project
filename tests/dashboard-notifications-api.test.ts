import { afterEach, describe, expect, it } from "vitest";
import { NotificationDeliveryStatus, NotificationType, RecordingStatus, ReleaseReadiness, ReleaseRunStatus, RunMode, RunOutcome, RunStatus, StepKind } from "@prisma/client";
import { deliverNotification, notifyAutoRunCheckpoint, notifyReleaseCompletion, notifyRunFailure } from "../lib/notifications";
import { prisma } from "../lib/prisma";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";
const productIds: string[] = [];
type Session = { cookie: string };

async function login(email: string): Promise<Session> {
  const response = await fetch(`${baseUrl}/api/auth/dev-login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "sentinel-dev" }) });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Development login did not return a session cookie.");
  return { cookie };
}

async function request(session: Session, path: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}/api/${path}`, { method, headers: { cookie: session.cookie, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
}

async function waitForDelivery(notificationId: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const notification = await prisma.notification.findUniqueOrThrow({ where: { id: notificationId } });
    if (notification.deliveryStatus === "SENT") return notification;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Notification was not delivered to Mailpit.");
}

afterEach(async () => {
  for (const productId of productIds.splice(0)) {
    const testCases = await prisma.testCase.findMany({ where: { productId }, select: { id: true, recordingSessionId: true } });
    const runs = await prisma.run.findMany({ where: { productId }, select: { id: true } });
    await prisma.release.deleteMany({ where: { tests: { some: { testCase: { productId } } } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: [...testCases.map((testCase) => testCase.id), ...runs.map((run) => run.id)] } } });
    await prisma.testCase.deleteMany({ where: { productId } });
    await prisma.recordingSession.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
  }
});

describe("Phase 6 dashboard and notification API", () => {
  it("restricts health data, persists a failed-Run notice, delivers it to Mailpit, and records read state", async () => {
    const ava = await login("ava.tester@example.test");
    const ben = await login("ben.tester@example.test");
    const productResponse = await request(ava, "products", "POST", { name: `Health API ${Date.now()}` });
    expect(productResponse.status).toBe(201);
    const product = await productResponse.json() as { id: string; name: string };
    productIds.push(product.id);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: "ava.tester@example.test" } });
    const recording = await prisma.recordingSession.create({ data: { productId: product.id, ownerId: owner.id, testName: "Health customer", targetUrl: "http://demo-target", tokenHash: `health-${Date.now()}`, status: RecordingStatus.SAVED } });
    const testCase = await prisma.testCase.create({
      data: { productId: product.id, ownerId: owner.id, recordingSessionId: recording.id, name: "Health customer", versions: { create: { version: 1, steps: { create: { order: 1, kind: StepKind.NAVIGATION, timestamp: new Date(), target: { url: "http://demo-target" } } } } } },
      include: { versions: true }
    });
    const failedRun = await prisma.run.create({ data: { testCaseId: testCase.id, testCaseVersionId: testCase.versions[0].id, productId: product.id, initiatedById: owner.id, targetUrl: "http://demo-target", mode: RunMode.GUIDED, status: RunStatus.COMPLETED, outcome: RunOutcome.FAILED, completedAt: new Date() } });
    await notifyRunFailure(failedRun.id);
    const notification = await prisma.notification.findFirstOrThrow({ where: { runId: failedRun.id, recipientId: owner.id } });
    const delivered = await waitForDelivery(notification.id);
    expect(delivered.deliveryAttempts).toBe(1);
    expect(delivered.deliveryError).toBeNull();

    const mailpitMessages = await (await fetch("http://mailpit:8025/api/v1/messages")).json() as { total?: number; messages?: unknown[] };
    expect(mailpitMessages.total ?? mailpitMessages.messages?.length ?? 0).toBeGreaterThan(0);

    const dashboard = await request(ava, `dashboard?productId=${product.id}`);
    expect(dashboard.status).toBe(200);
    const dashboardBody = await dashboard.json() as { selected: { product: { id: string }; totalSavedTestCases: number; failedRuns: number }; needsAttention: Array<{ id: string }> };
    expect(dashboardBody.selected).toMatchObject({ product: { id: product.id }, totalSavedTestCases: 1, failedRuns: 1 });
    expect(dashboardBody.needsAttention.map((item) => item.id)).toContain(notification.id);
    expect((await request(ben, `dashboard?productId=${product.id}`)).status).toBe(403);

    const inbox = await request(ava, "notifications?filter=unread");
    expect(inbox.status).toBe(200);
    expect((await inbox.json() as Array<{ id: string; deliveryStatus: string }>)).toEqual(expect.arrayContaining([expect.objectContaining({ id: notification.id, deliveryStatus: "SENT" })]));
    expect((await request(ava, `notifications/${notification.id}/read`, "PATCH")).status).toBe(200);
    expect(await prisma.notification.findUniqueOrThrow({ where: { id: notification.id } })).toMatchObject({ readAt: expect.any(Date) });

    const checkpointRun = await prisma.run.create({ data: { testCaseId: testCase.id, testCaseVersionId: testCase.versions[0].id, productId: product.id, initiatedById: owner.id, targetUrl: "http://demo-target", mode: RunMode.AUTO, status: RunStatus.PAUSED } });
    await notifyAutoRunCheckpoint(checkpointRun.id);
    await notifyAutoRunCheckpoint(checkpointRun.id);
    expect(await prisma.notification.count({ where: { runId: checkpointRun.id, type: NotificationType.AUTO_RUN_CHECKPOINT } })).toBe(1);

    const release = await prisma.release.create({ data: { name: `Health Release ${Date.now()}`, ownerId: owner.id, tests: { create: { testCaseId: testCase.id } } } });
    const releaseRun = await prisma.releaseRun.create({ data: { releaseId: release.id, initiatedById: owner.id, status: ReleaseRunStatus.COMPLETED, readiness: ReleaseReadiness.NOT_READY, completedAt: new Date() } });
    await notifyReleaseCompletion(releaseRun.id);
    await notifyReleaseCompletion(releaseRun.id);
    expect(await prisma.notification.count({ where: { releaseRunId: releaseRun.id, type: NotificationType.RELEASE_RUN_COMPLETED } })).toBe(1);

    const retryNotification = await prisma.notification.create({ data: { recipientId: owner.id, productId: product.id, runId: checkpointRun.id, type: NotificationType.RUN_FAILED } });
    const previousHost = process.env.SMTP_HOST;
    const previousPort = process.env.SMTP_PORT;
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1";
    try {
      await expect(deliverNotification(retryNotification.id)).rejects.toMatchObject({ code: "ESOCKET" });
      expect(await prisma.notification.findUniqueOrThrow({ where: { id: retryNotification.id } })).toMatchObject({ deliveryStatus: NotificationDeliveryStatus.PENDING, deliveryAttempts: 1 });
      await deliverNotification(retryNotification.id);
    } finally {
      process.env.SMTP_HOST = previousHost;
      process.env.SMTP_PORT = previousPort;
    }
    expect(await prisma.notification.findUniqueOrThrow({ where: { id: retryNotification.id } })).toMatchObject({ deliveryStatus: NotificationDeliveryStatus.FAILED, deliveryAttempts: 2, deliveryError: "SMTP delivery could not be completed safely." });
  }, 20_000);
});
