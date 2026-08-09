import crypto from "node:crypto";
import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { EvidenceKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type RunSnapshot = {
  screenshot: Buffer;
  network: unknown[];
  console: unknown[];
  storage: unknown;
};

type SnapshotInput = RunSnapshot & {
  runId: string;
  runStepResultId?: string;
  label: "START" | "END" | "FAILURE" | "STEP";
};

const SENSITIVE_KEY = /password|passcode|token|secret|authorization|cookie|api[-_]?key/i;
const MAX_BODY_BYTES = 4096;
let bucketReady: Promise<void> | undefined;

function evidenceBucket() {
  return process.env.MINIO_BUCKET ?? "sentinel-evidence";
}

function evidenceClient() {
  return new S3Client({
    endpoint: process.env.MINIO_ENDPOINT ?? "http://minio:9000",
    region: process.env.MINIO_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? "sentinel-minio",
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? "sentinel-minio-development-only"
    }
  });
}

async function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const client = evidenceClient();
      try {
        await client.send(new HeadBucketCommand({ Bucket: evidenceBucket() }));
      } catch {
        await client.send(new CreateBucketCommand({ Bucket: evidenceBucket() }));
      }
    })().catch((error) => {
      bucketReady = undefined;
      throw error;
    });
  }
  return bucketReady;
}

function truncate(value: string, limit = MAX_BODY_BYTES) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.byteLength <= limit) return value;
  return `${bytes.subarray(0, limit).toString("utf8")}…[TRUNCATED]`;
}

function redactText(value: string) {
  return truncate(value
    .replace(/((?:password|passcode|token|secret|authorization|cookie|api[-_]?key)[\s"']*[:=][\s"']*)([^\s,}&"']+)/gi, "$1[REDACTED]")
    .replace(/(Bearer\s+)[^\s,}]+/gi, "$1[REDACTED]"));
}

export function redactEvidenceValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactEvidenceValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactEvidenceValue(entry)]));
  }
  return typeof value === "string" ? redactText(value) : value;
}

export function redactedBodySnippet(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "string") {
    try {
      return redactEvidenceValue(JSON.parse(value));
    } catch {
      return redactText(value);
    }
  }
  return redactEvidenceValue(value);
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function storageEntries(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => {
    const record = asRecord(entry);
    const rawValue = record.value;
    return { key: String(record.key ?? record.name ?? "unknown"), value: "[REDACTED]", valueLength: typeof rawValue === "string" ? Buffer.byteLength(rawValue) : 0 };
  }) : [];
}

export function redactedStorageSnapshot(value: unknown) {
  const storage = asRecord(value);
  return {
    cookies: storageEntries(storage.cookies),
    localStorage: storageEntries(storage.localStorage),
    sessionStorage: storageEntries(storage.sessionStorage)
  };
}

function networkMetadata(entries: unknown[], label: string) {
  return {
    label,
    entries: entries.map((entry) => {
      const record = asRecord(entry);
      return {
        url: redactText(String(record.url ?? "")),
        method: String(record.method ?? "GET"),
        status: typeof record.status === "number" ? record.status : 0,
        durationMs: typeof record.durationMs === "number" ? record.durationMs : undefined,
        error: record.error ? redactText(String(record.error)) : undefined,
        requestBody: redactedBodySnippet(record.requestBody),
        responseBody: redactedBodySnippet(record.responseBody)
      };
    })
  };
}

function consoleMetadata(entries: unknown[], label: string) {
  return {
    label,
    entries: entries.map((entry) => {
      const record = asRecord(entry);
      return { level: String(record.level ?? "error"), message: redactText(String(record.message ?? "")) };
    })
  };
}

export async function persistRunSnapshot(input: SnapshotInput) {
  await ensureBucket();
  const checksum = crypto.createHash("sha256").update(input.screenshot).digest("hex");
  const objectKey = `${input.runId}/${input.label.toLowerCase()}-${crypto.randomUUID()}.png`;
  await evidenceClient().send(new PutObjectCommand({ Bucket: evidenceBucket(), Key: objectKey, Body: input.screenshot, ContentType: "image/png" }));

  const shared = { runId: input.runId, runStepResultId: input.runStepResultId ?? null };
  const evidence: Array<Prisma.EvidenceItemCreateManyInput> = [
    { ...shared, kind: EvidenceKind.SCREENSHOT, objectKey, checksum, contentType: "image/png", byteSize: input.screenshot.byteLength, metadata: jsonValue({ label: input.label }) },
    { ...shared, kind: EvidenceKind.STORAGE, metadata: jsonValue({ label: input.label, ...redactedStorageSnapshot(input.storage) }) }
  ];
  if (input.network.length) evidence.push({ ...shared, kind: EvidenceKind.NETWORK, metadata: jsonValue(networkMetadata(input.network, input.label)) });
  if (input.console.length) evidence.push({ ...shared, kind: EvidenceKind.CONSOLE, metadata: jsonValue(consoleMetadata(input.console, input.label)) });
  await prisma.evidenceItem.createMany({ data: evidence });
}

export async function recordCaptureFailure(runId: string, message: string, runStepResultId?: string) {
  await prisma.$transaction([
    prisma.evidenceItem.create({ data: { runId, runStepResultId, kind: EvidenceKind.CAPTURE_ERROR, captureError: message } }),
    prisma.run.update({ where: { id: runId }, data: { evidenceStatus: "PARTIAL" } })
  ]);
}

export async function signedEvidenceUrl(objectKey: string) {
  await ensureBucket();
  return getSignedUrl(evidenceClient(), new GetObjectCommand({ Bucket: evidenceBucket(), Key: objectKey }), { expiresIn: 15 * 60 });
}
