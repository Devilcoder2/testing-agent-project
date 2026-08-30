import { OrganizationRole } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import { deletePilotWaitlistLead, pilotWaitlistStatusSchema, updatePilotWaitlistLead } from "@/lib/pilot-waitlist";

type Context = { params: Promise<{ id: string }> };
const statusBodySchema = z.object({ status: pilotWaitlistStatusSchema }).strict();
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

async function adminUser() {
  const user = await readSession((await cookies()).get("sentinel_session")?.value);
  if (!user) return { error: json({ error: "Sign in required." }, 401) } as const;
  if (user.role !== OrganizationRole.ADMIN) return { error: json({ error: "Admin access required." }, 403) } as const;
  return { user } as const;
}

export async function PATCH(request: Request, context: Context) {
  const access = await adminUser();
  if ("error" in access) return access.error;
  const parsed = statusBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Choose a supported waitlist status." }, 400);
  const lead = await updatePilotWaitlistLead({
    organizationId: access.user.organizationId,
    actorId: access.user.id,
    leadId: (await context.params).id,
    status: parsed.data.status
  });
  return lead ? json(lead) : json({ error: "Pilot lead not found." }, 404);
}

export async function DELETE(_request: Request, context: Context) {
  const access = await adminUser();
  if ("error" in access) return access.error;
  const deleted = await deletePilotWaitlistLead({
    organizationId: access.user.organizationId,
    actorId: access.user.id,
    leadId: (await context.params).id
  });
  return deleted ? new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } }) : json({ error: "Pilot lead not found." }, 404);
}
