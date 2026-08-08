import crypto from "node:crypto";
import { Prisma, RecordingStatus, StepKind } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSession, signSession, type SessionUser } from "@/lib/auth";
import { closeBrowser, launchBrowser } from "@/lib/browser";
import { prisma } from "@/lib/prisma";

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
const recorderJson = (body: unknown, status = 200) => NextResponse.json(body, {
  status,
  headers: {
    "access-control-allow-origin": process.env.RECORDER_ORIGIN ?? "http://demo-target",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-recording-token"
  }
});

async function currentUser(): Promise<SessionUser | null> {
  return readSession((await cookies()).get("sentinel_session")?.value);
}

async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

async function assertProductMember(userId: string, productId: string) {
  const membership = await prisma.productMembership.findUnique({ where: { userId_productId: { userId, productId } } });
  if (!membership) throw new Error("FORBIDDEN");
}

function allowedTarget(url: string) {
  return url === (process.env.DEMO_TARGET_URL ?? "http://demo-target");
}

async function route(request: Request, context: Context) {
  const path = (await context.params).route ?? [];
  const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));

  if (request.method === "OPTIONS" && path.join("/") === "internal/events") return recorderJson({});

  if (request.method === "POST" && path.join("/") === "auth/dev-login") {
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || user.devPassword !== body.password) return json({ error: "Invalid development credentials." }, 401);
    const response = json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
    response.cookies.set("sentinel_session", signSession(user), { httpOnly: true, sameSite: "lax", path: "/" });
    return response;
  }

  if (request.method === "POST" && path.join("/") === "internal/events") {
    const token = request.headers.get("x-recording-token");
    if (!token) return recorderJson({ error: "Missing recording token." }, 401);
    const recording = await prisma.recordingSession.findUnique({ where: { tokenHash: hash(token) } });
    if (!recording || recording.status !== RecordingStatus.ACTIVE) return recorderJson({ error: "Inactive recording." }, 401);
    const kind = body.kind as StepKind;
    if (!Object.values(StepKind).includes(kind)) return recorderJson({ error: "Unsupported step." }, 400);
    const prior = await prisma.recordedStep.findFirst({ where: { recordingSessionId: recording.id }, orderBy: { order: "desc" } });
    const target = (body.target ?? {}) as Prisma.InputJsonValue;
    if (prior && prior.kind === kind && JSON.stringify(prior.target) === JSON.stringify(target) && kind !== StepKind.TEXT_ENTRY) return recorderJson({ skipped: true });
    const step = await prisma.recordedStep.create({
      data: { recordingSessionId: recording.id, order: (prior?.order ?? 0) + 1, kind, timestamp: new Date(body.timestamp ?? Date.now()), target, value: body.value ?? null, isRedacted: Boolean(body.isRedacted) }
    });
    return recorderJson({ step });
  }

  try {
    const user = await requireUser();
    if (request.method === "GET" && path.join("/") === "products") {
      return json(await prisma.product.findMany({ where: { memberships: { some: { userId: user.id } } }, orderBy: { name: "asc" } }));
    }
    if (request.method === "POST" && path.join("/") === "products") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return json({ error: "Product name is required." }, 400);
      try {
        const product = await prisma.product.create({ data: { name, createdById: user.id, memberships: { create: { userId: user.id } } } });
        return json(product, 201);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return json({ error: "You already have a Product with this name." }, 409);
        }
        throw error;
      }
    }
    if (request.method === "PATCH" && path[0] === "products" && path[1]) {
      const product = await prisma.product.findUnique({ where: { id: path[1] } });
      if (!product) return json({ error: "Product not found." }, 404);
      await assertProductMember(user.id, product.id);
      if (product.createdById !== user.id) return json({ error: "Only the Product creator can edit its name." }, 403);
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
        where: { product: { memberships: { some: { userId: user.id } } } },
        include: { product: true, owner: { select: { displayName: true } } },
        orderBy: { updatedAt: "desc" }
      });
      return json(testCases);
    }
    if (request.method === "GET" && path[0] === "test-cases" && path[1]) {
      const testCase = await prisma.testCase.findUnique({
        where: { id: path[1] },
        include: { product: true, owner: { select: { displayName: true } }, versions: { include: { steps: { orderBy: { order: "asc" } } }, orderBy: { version: "desc" } } }
      });
      if (!testCase) return json({ error: "Test Case not found." }, 404);
      await assertProductMember(user.id, testCase.productId);
      return json(testCase);
    }
    const recordingId = path[1];
    if (path[0] === "recordings" && recordingId) {
      const recording = await prisma.recordingSession.findUnique({ where: { id: recordingId }, include: { steps: { orderBy: { order: "asc" } } } });
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
          await launchBrowser(recording.targetUrl, token);
        } catch (error) {
          await prisma.recordingSession.update({ where: { id: recording.id }, data: { status: RecordingStatus.DRAFT } });
          throw error;
        }
        return json({ viewerUrl: process.env.BROWSER_VIEWER_URL });
      }
      if (request.method === "PATCH" && path[2] === "steps" && path[3]) {
        if (!recording.steps.some((step) => step.id === path[3])) return json({ error: "Step not found." }, 404);
        const step = await prisma.recordedStep.update({
          where: { id: path[3] },
          data: {
            ...(body.description !== undefined ? { description: body.description || null } : {}),
            ...(body.expectedOutcome !== undefined ? { expectedOutcome: body.expectedOutcome || null } : {}),
            ...(body.variableName !== undefined ? { variableName: body.variableName || null } : {})
          }
        });
        return json(step);
      }
      if (request.method === "POST" && path[2] === "save") {
        if (recording.status === RecordingStatus.SAVED) return json({ error: "Recording already saved." }, 409);
        const testCase = await prisma.$transaction(async (tx) => {
          const created = await tx.testCase.create({ data: { productId: recording.productId, ownerId: recording.ownerId, recordingSessionId: recording.id, name: recording.testName, versions: { create: { version: 1, steps: { create: recording.steps.map((step) => ({ order: step.order, kind: step.kind, timestamp: step.timestamp, target: step.target === null ? Prisma.JsonNull : step.target as Prisma.InputJsonValue, value: step.value, isRedacted: step.isRedacted, description: step.description, expectedOutcome: step.expectedOutcome, variableName: step.variableName })) } } } } });
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
    if (code.startsWith("BROWSER_")) return json({ error: "The live browser could not start. Try launching it again." }, 503);
    console.error("Sentinel API failure", error);
    return json({ error: "The recording browser could not be launched. Check the Sentinel container logs for details." }, 500);
  }
  return json({ error: "Not found." }, 404);
}

export const GET = (request: Request, context: Context) => route(request, context);
export const POST = (request: Request, context: Context) => route(request, context);
export const PATCH = (request: Request, context: Context) => route(request, context);
export const DELETE = (request: Request, context: Context) => route(request, context);
export const OPTIONS = (request: Request, context: Context) => route(request, context);
