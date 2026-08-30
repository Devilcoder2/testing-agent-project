import { OrganizationRole } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { listPilotWaitlistLeads, pilotWaitlistStatusSchema } from "@/lib/pilot-waitlist";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: Request) {
  const user = await readSession((await cookies()).get("sentinel_session")?.value);
  if (!user) return json({ error: "Sign in required." }, 401);
  if (user.role !== OrganizationRole.ADMIN) return json({ error: "Admin access required." }, 403);
  const rawStatus = new URL(request.url).searchParams.get("status");
  const parsedStatus = rawStatus ? pilotWaitlistStatusSchema.safeParse(rawStatus) : null;
  if (rawStatus && !parsedStatus?.success) return json({ error: "Unsupported waitlist status." }, 400);
  return json(await listPilotWaitlistLeads(user.organizationId, parsedStatus?.success ? parsedStatus.data : undefined));
}
