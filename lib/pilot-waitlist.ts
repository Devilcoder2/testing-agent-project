import crypto from "node:crypto";
import { PilotQaTeamSize, PilotWaitlistLeadStatus } from "@prisma/client";
import IORedis from "ioredis";
import { z } from "zod";
import { prisma } from "./prisma";

export const PILOT_WAITLIST_ACTION = "pilot_waitlist";
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 6;
const TURNSTILE_TEST_SECRETS = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA"
]);

const teamSizeValues = ["1", "2-5", "6-15", "16+"] as const;

export const pilotWaitlistInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  company: z.string().trim().min(2).max(120),
  qaTeamSize: z.enum(teamSizeValues),
  turnstileToken: z.string().min(1).max(2048),
  companyWebsite: z.string().max(200).default("")
}).strict();

export const pilotWaitlistStatusSchema = z.nativeEnum(PilotWaitlistLeadStatus);

export type PilotWaitlistInput = z.infer<typeof pilotWaitlistInputSchema>;

const teamSizeToDatabase: Record<PilotWaitlistInput["qaTeamSize"], PilotQaTeamSize> = {
  "1": PilotQaTeamSize.SOLO,
  "2-5": PilotQaTeamSize.TWO_TO_FIVE,
  "6-15": PilotQaTeamSize.SIX_TO_FIFTEEN,
  "16+": PilotQaTeamSize.SIXTEEN_PLUS
};

const teamSizeToPublic: Record<PilotQaTeamSize, PilotWaitlistInput["qaTeamSize"]> = {
  [PilotQaTeamSize.SOLO]: "1",
  [PilotQaTeamSize.TWO_TO_FIVE]: "2-5",
  [PilotQaTeamSize.SIX_TO_FIFTEEN]: "6-15",
  [PilotQaTeamSize.SIXTEEN_PLUS]: "16+"
};

export class PilotWaitlistConfigurationError extends Error {}
export class PilotWaitlistProviderUnavailableError extends Error {}

function requiredConfiguration(name: "MARKETING_ORIGIN" | "WAITLIST_OWNER_ORGANIZATION_ID" | "TURNSTILE_SECRET_KEY") {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith("replace-with")) throw new PilotWaitlistConfigurationError(`${name}_UNAVAILABLE`);
  return value;
}

export function configuredMarketingOrigin() {
  const raw = requiredConfiguration("MARKETING_ORIGIN");
  try {
    return new URL(raw).origin;
  } catch {
    throw new PilotWaitlistConfigurationError("MARKETING_ORIGIN_INVALID");
  }
}

export function pilotCorsHeaders(origin: string | null) {
  const allowedOrigin = configuredMarketingOrigin();
  if (origin !== allowedOrigin) return null;
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    "cache-control": "no-store",
    vary: "Origin"
  };
}

type TurnstileResult = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

export function turnstileResultIsValid(result: TurnstileResult, expectedHostname: string) {
  return result.success === true && result.hostname === expectedHostname && result.action === PILOT_WAITLIST_ACTION;
}

export async function verifyPilotTurnstile(token: string) {
  const secret = requiredConfiguration("TURNSTILE_SECRET_KEY");
  if (process.env.NODE_ENV === "production" && TURNSTILE_TEST_SECRETS.has(secret)) throw new PilotWaitlistConfigurationError("TURNSTILE_PRODUCTION_KEY_REQUIRED");
  const expectedHostname = new URL(configuredMarketingOrigin()).hostname;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token, idempotency_key: crypto.randomUUID() }),
      signal: controller.signal
    });
    if (!response.ok) throw new PilotWaitlistProviderUnavailableError("TURNSTILE_UNAVAILABLE");
    const result = await response.json() as TurnstileResult;
    return TURNSTILE_TEST_SECRETS.has(secret) ? result.success === true : turnstileResultIsValid(result, expectedHostname);
  } catch (error) {
    if (error instanceof PilotWaitlistProviderUnavailableError) throw error;
    throw new PilotWaitlistProviderUnavailableError("TURNSTILE_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}

function requestAddress(request: Request) {
  return request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

function rateLimitSalt() {
  const configured = process.env.WAITLIST_RATE_LIMIT_SALT?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new PilotWaitlistConfigurationError("WAITLIST_RATE_LIMIT_SALT_UNAVAILABLE");
  return "sentinel-local-pilot-rate-limit";
}

export async function enforcePilotRateLimit(request: Request) {
  const digest = crypto.createHash("sha256").update(`${rateLimitSalt()}:${requestAddress(request)}`).digest("hex");
  const client = new IORedis(process.env.REDIS_URL ?? "redis://redis:6379", {
    connectTimeout: 1_500,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false
  });
  try {
    await client.connect();
    const result = await client.eval(
      "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; return {count, redis.call('PTTL', KEYS[1])};",
      1,
      `sentinel:pilot-waitlist:${digest}`,
      String(RATE_LIMIT_WINDOW_MS)
    ) as [number, number];
    const [count, ttl] = result.map(Number) as [number, number];
    return { allowed: count <= RATE_LIMIT_MAX, retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)) };
  } catch {
    throw new PilotWaitlistProviderUnavailableError("RATE_LIMIT_UNAVAILABLE");
  } finally {
    client.disconnect();
  }
}

export async function acceptPilotWaitlistLead(input: PilotWaitlistInput) {
  const organizationId = requiredConfiguration("WAITLIST_OWNER_ORGANIZATION_ID");
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!organization) throw new PilotWaitlistConfigurationError("WAITLIST_OWNER_ORGANIZATION_UNAVAILABLE");
  await prisma.pilotWaitlistLead.upsert({
    where: { organizationId_email: { organizationId, email: input.email } },
    create: {
      organizationId,
      email: input.email,
      name: input.name,
      company: input.company,
      qaTeamSize: teamSizeToDatabase[input.qaTeamSize]
    },
    update: {
      name: input.name,
      company: input.company,
      qaTeamSize: teamSizeToDatabase[input.qaTeamSize]
    }
  });
}

export function publicPilotLead(lead: {
  id: string;
  email: string;
  name: string;
  company: string;
  qaTeamSize: PilotQaTeamSize;
  status: PilotWaitlistLeadStatus;
  createdAt: Date;
  updatedAt: Date;
}) {
  return { ...lead, qaTeamSize: teamSizeToPublic[lead.qaTeamSize] };
}

export async function listPilotWaitlistLeads(organizationId: string, status?: PilotWaitlistLeadStatus) {
  const leads = await prisma.pilotWaitlistLead.findMany({
    where: { organizationId, ...(status ? { status } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200
  });
  return leads.map(publicPilotLead);
}

export async function updatePilotWaitlistLead(input: { organizationId: string; actorId: string; leadId: string; status: PilotWaitlistLeadStatus }) {
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.pilotWaitlistLead.updateMany({
      where: { id: input.leadId, organizationId: input.organizationId },
      data: { status: input.status }
    });
    if (updated.count !== 1) return null;
    await transaction.auditEvent.create({
      data: { actorId: input.actorId, action: "PILOT_WAITLIST_STATUS_UPDATED", entityType: "PilotWaitlistLead", entityId: input.leadId, details: { status: input.status } }
    });
    const lead = await transaction.pilotWaitlistLead.findUnique({ where: { id: input.leadId } });
    return lead ? publicPilotLead(lead) : null;
  });
}

export async function deletePilotWaitlistLead(input: { organizationId: string; actorId: string; leadId: string }) {
  return prisma.$transaction(async (transaction) => {
    const deleted = await transaction.pilotWaitlistLead.deleteMany({ where: { id: input.leadId, organizationId: input.organizationId } });
    if (deleted.count !== 1) return false;
    await transaction.auditEvent.create({
      data: { actorId: input.actorId, action: "PILOT_WAITLIST_LEAD_DELETED", entityType: "PilotWaitlistLead", entityId: input.leadId }
    });
    return true;
  });
}
