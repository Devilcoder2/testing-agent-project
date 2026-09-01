import { randomUUID } from "node:crypto";
import { OrganizationRole, PilotWaitlistLeadStatus } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/public/pilot-waitlist/route";
import { hashPassword } from "../lib/auth";
import {
  deletePilotWaitlistLead,
  pilotWaitlistInputSchema,
  turnstileResultIsValid,
  updatePilotWaitlistLead
} from "../lib/pilot-waitlist";
import { prisma } from "../lib/prisma";

const originalFetch = globalThis.fetch;
const suffix = randomUUID();
let organizationId = "";
let otherOrganizationId = "";
let adminId = "";
let requestNumber = 0;

function turnstileResult(success = true) {
  return new Response(JSON.stringify({ success, hostname: "marketing.test", action: "pilot_waitlist" }), { status: 200, headers: { "content-type": "application/json" } });
}

function publicRequest(body: Record<string, unknown>, origin = "https://marketing.test", address = `${suffix}-${requestNumber++}`) {
  return new Request("http://sentinel.test/api/public/pilot-waitlist", {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-forwarded-for": address },
    body: JSON.stringify(body)
  });
}

function validBody(email = `pilot-${suffix}@example.test`) {
  return { name: "  Riley Lead  ", email: ` ${email.toUpperCase()} `, company: "  Example Labs  ", qaTeamSize: "2-5", turnstileToken: "valid-token", companyWebsite: "" };
}

beforeAll(async () => {
  const [organization, otherOrganization] = await Promise.all([
    prisma.organization.create({ data: { name: `Pilot Owner ${suffix}` } }),
    prisma.organization.create({ data: { name: `Other Owner ${suffix}` } })
  ]);
  organizationId = organization.id;
  otherOrganizationId = otherOrganization.id;
  const admin = await prisma.user.create({ data: { email: `pilot-admin-${suffix}@example.test`, displayName: "Pilot Admin", passwordHash: await hashPassword("sentinel-dev-password") } });
  adminId = admin.id;
  await prisma.organizationMember.create({ data: { organizationId, userId: adminId, role: OrganizationRole.ADMIN } });
  process.env.MARKETING_ORIGIN = "https://marketing.test";
  process.env.WAITLIST_OWNER_ORGANIZATION_ID = organizationId;
  process.env.TURNSTILE_SECRET_KEY = "turnstile-test-secret";
  process.env.WAITLIST_RATE_LIMIT_SALT = `rate-${suffix}`;
  process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://redis:6379";
});

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => turnstileResult(true)) as typeof fetch;
});

afterAll(async () => {
  globalThis.fetch = originalFetch;
  await prisma.auditEvent.deleteMany({ where: { actorId: adminId } });
  await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } });
  await prisma.user.deleteMany({ where: { id: adminId } });
});

describe("pilot waitlist validation", () => {
  it("normalizes the four approved qualification fields", () => {
    const parsed = pilotWaitlistInputSchema.parse(validBody("RILEY@EXAMPLE.TEST"));
    expect(parsed).toMatchObject({ name: "Riley Lead", email: "riley@example.test", company: "Example Labs", qaTeamSize: "2-5" });
  });

  it("accepts name and email without optional qualification fields", () => {
    const parsed = pilotWaitlistInputSchema.parse({ name: "Riley Lead", email: "riley@example.test", company: "", qaTeamSize: "", turnstileToken: "valid-token", companyWebsite: "" });
    expect(parsed).toMatchObject({ name: "Riley Lead", email: "riley@example.test" });
    expect(parsed.company).toBeUndefined();
    expect(parsed.qaTeamSize).toBeUndefined();
  });

  it("rejects unsupported fields, team sizes, and malformed emails", () => {
    expect(pilotWaitlistInputSchema.safeParse({ ...validBody(), email: "not-an-email" }).success).toBe(false);
    expect(pilotWaitlistInputSchema.safeParse({ ...validBody(), qaTeamSize: "50+" }).success).toBe(false);
    expect(pilotWaitlistInputSchema.safeParse({ ...validBody(), extra: "not accepted" }).success).toBe(false);
  });

  it("requires the verified Turnstile hostname and action", () => {
    expect(turnstileResultIsValid({ success: true, hostname: "marketing.test", action: "pilot_waitlist" }, "marketing.test")).toBe(true);
    expect(turnstileResultIsValid({ success: true, hostname: "other.test", action: "pilot_waitlist" }, "marketing.test")).toBe(false);
    expect(turnstileResultIsValid({ success: true, hostname: "marketing.test", action: "other" }, "marketing.test")).toBe(false);
  });
});

describe("public pilot waitlist endpoint", () => {
  it("stores absent qualification fields as null", async () => {
    const email = `minimal-${suffix}@example.test`;
    expect((await POST(publicRequest({ name: "Minimal Lead", email, company: "", qaTeamSize: "", turnstileToken: "valid-token", companyWebsite: "" }))).status).toBe(202);
    expect(await prisma.pilotWaitlistLead.findUnique({ where: { organizationId_email: { organizationId, email } } })).toMatchObject({ company: null, qaTeamSize: null });
  });

  it("accepts, normalizes, and idempotently refreshes one organization-owned lead", async () => {
    const email = `idempotent-${suffix}@example.test`;
    const first = await POST(publicRequest(validBody(email)));
    const repeated = await POST(publicRequest({ ...validBody(email), name: "Updated Lead", company: "Updated Labs", qaTeamSize: "6-15" }));
    expect([first.status, repeated.status]).toEqual([202, 202]);
    expect(await first.json()).toEqual({ accepted: true });
    const leads = await prisma.pilotWaitlistLead.findMany({ where: { organizationId, email } });
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ name: "Updated Lead", company: "Updated Labs", qaTeamSize: "SIX_TO_FIFTEEN", status: "NEW" });
  });

  it("silently discards a filled honeypot and rejects an unapproved origin", async () => {
    const email = `honeypot-${suffix}@example.test`;
    expect((await POST(publicRequest({ ...validBody(email), companyWebsite: "https://spam.test" }))).status).toBe(202);
    expect(await prisma.pilotWaitlistLead.count({ where: { organizationId, email } })).toBe(0);
    expect((await POST(publicRequest(validBody(`origin-${suffix}@example.test`), "https://other.test"))).status).toBe(403);
  });

  it("rejects failed verification and keeps provider failure retryable", async () => {
    globalThis.fetch = vi.fn(async () => turnstileResult(false)) as typeof fetch;
    expect((await POST(publicRequest(validBody(`challenge-${suffix}@example.test`)))).status).toBe(403);
    globalThis.fetch = vi.fn(async () => { throw new Error("provider unavailable"); }) as typeof fetch;
    expect((await POST(publicRequest(validBody(`provider-${suffix}@example.test`)))).status).toBe(503);
  });

  it("limits a connection after six accepted attempts", async () => {
    const address = `rate-${suffix}`;
    const statuses: number[] = [];
    for (let index = 0; index < 7; index += 1) statuses.push((await POST(publicRequest(validBody(`rate-${index}-${suffix}@example.test`), "https://marketing.test", address))).status);
    expect(statuses).toEqual([202, 202, 202, 202, 202, 202, 429]);
  });
});

describe("organization-isolated pilot lifecycle", () => {
  it("updates and deletes only inside the active Admin organization without auditing PII", async () => {
    const lead = await prisma.pilotWaitlistLead.create({ data: { organizationId, email: `lifecycle-${suffix}@example.test`, name: "Lifecycle Lead", company: "Lifecycle Labs", qaTeamSize: "SOLO" } });
    expect(await updatePilotWaitlistLead({ organizationId: otherOrganizationId, actorId: adminId, leadId: lead.id, status: PilotWaitlistLeadStatus.CONTACTED })).toBeNull();
    const updated = await updatePilotWaitlistLead({ organizationId, actorId: adminId, leadId: lead.id, status: PilotWaitlistLeadStatus.INVITED });
    expect(updated?.status).toBe("INVITED");
    expect(await deletePilotWaitlistLead({ organizationId: otherOrganizationId, actorId: adminId, leadId: lead.id })).toBe(false);
    expect(await deletePilotWaitlistLead({ organizationId, actorId: adminId, leadId: lead.id })).toBe(true);
    const audits = await prisma.auditEvent.findMany({ where: { actorId: adminId, entityId: lead.id } });
    expect(audits.map((event) => event.action)).toEqual(["PILOT_WAITLIST_STATUS_UPDATED", "PILOT_WAITLIST_LEAD_DELETED"]);
    expect(JSON.stringify(audits)).not.toContain("lifecycle-");
    expect(JSON.stringify(audits)).not.toContain("Lifecycle Labs");
  });
});
