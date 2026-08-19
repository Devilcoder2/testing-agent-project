import crypto from "node:crypto";
import { Prisma, RecordingStatus, ReleaseRunItemReason, ReleaseRunItemStatus, ReleaseRunStatus, RunAttemptStatus, RunFailureReason, RunMode, RunOutcome, RunStatus, RunStepStatus, StepKind, TestDataReusePolicy, TestDataStatus, VariableSource } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSession, signSession, type SessionUser } from "@/lib/auth";
import { captureRunBrowserSnapshot, closeBrowser, closeRunBrowser, launchRecordingBrowser, launchRunBrowser, replayGuidedRunStep } from "@/lib/browser";
import { persistRunSnapshot, recordCaptureFailure, signedEvidenceUrl } from "@/lib/evidence";
import { prisma } from "@/lib/prisma";
import { enqueueAutoRun } from "@/lib/queue";
import { canonicalVariableName, decryptVariableValue, encryptVariableValue, isSecretLikeVariable, maskedVariableValue, variablePlaceholder } from "@/lib/variables";
import { markReleaseRunItemQueueFailure, refreshReleaseRun, syncReleaseRunItemForRun } from "@/lib/releases";

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

async function assertReleaseMember(userId: string, releaseId: string) {
  const release = await prisma.release.findUnique({ where: { id: releaseId }, include: { tests: { include: { testCase: { select: { productId: true } } } } } });
  if (!release) return null;
  for (const item of release.tests) await assertProductMember(userId, item.testCase.productId);
  return release;
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
        include: { product: true, owner: { select: { displayName: true } }, featureLabels: { include: { featureLabel: true }, orderBy: { featureLabel: { name: "asc" } } } },
        orderBy: { updatedAt: "desc" }
      });
      return json(testCases);
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
          const created = await prisma.testDataSet.create({ data: { productId: path[1], name, fieldNames: Object.keys(fields).sort(), encryptedFields: encryptVariableValue(JSON.stringify(fields)), reusePolicy }, select: { id: true, name: true, fieldNames: true, status: true, reusePolicy: true, createdAt: true } });
          await prisma.auditEvent.create({ data: { actorId: user.id, action: "TEST_DATA_SET_CREATED", entityType: "TestDataSet", entityId: created.id, details: { productId: path[1], fieldNames: created.fieldNames, reusePolicy } } });
          return json(created, 201);
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return json({ error: "A Test Data Set with this name already exists for this Product." }, 409);
          throw error;
        }
      }
      if (request.method === "POST" && path[3] && path[4] === "invalidate") {
        const dataSet = await prisma.testDataSet.findFirst({ where: { id: path[3], productId: path[1] } });
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
    if (request.method === "PATCH" && path[0] === "releases" && path[1] && path[2] === "tests") {
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
        console.error("Sentinel could not enqueue Auto Run", error);
        return json({ error: "Auto Run could not be queued. Redis is unavailable; try again." }, 503);
      }
      return json({ run: created }, 201);
    }
    if (request.method === "GET" && path.join("/") === "runs") {
      const runs = await prisma.run.findMany({
        where: { product: { memberships: { some: { userId: user.id } } } },
        include: { product: true, testCase: { select: { id: true, name: true } }, initiatedBy: { select: { displayName: true } }, stepResults: { select: { status: true } }, attempts: { select: { id: true, attemptNumber: true, status: true, failureReason: true, activeDurationMs: true }, orderBy: { attemptNumber: "asc" } } },
        orderBy: { createdAt: "desc" }
      });
      return json(runs);
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
          evidence: { orderBy: { capturedAt: "asc" } }
        }
      });
      if (!run) return json({ error: "Run not found." }, 404);
      await assertProductMember(user.id, run.productId);
      return json({ ...run, viewerUrl: run.mode === RunMode.GUIDED && run.status === RunStatus.RUNNING ? process.env.BROWSER_VIEWER_URL : null });
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
