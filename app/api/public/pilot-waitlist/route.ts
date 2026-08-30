import { NextResponse } from "next/server";
import {
  acceptPilotWaitlistLead,
  enforcePilotRateLimit,
  pilotCorsHeaders,
  PilotWaitlistConfigurationError,
  pilotWaitlistInputSchema,
  PilotWaitlistProviderUnavailableError,
  verifyPilotTurnstile
} from "@/lib/pilot-waitlist";

const MAX_BODY_BYTES = 8 * 1024;
const acceptedBody = { accepted: true };

function json(body: unknown, status: number, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

function corsFor(request: Request) {
  try {
    return pilotCorsHeaders(request.headers.get("origin"));
  } catch {
    return null;
  }
}

export async function OPTIONS(request: Request) {
  const headers = corsFor(request);
  return headers ? new NextResponse(null, { status: 204, headers }) : json({ error: "Origin not allowed." }, 403);
}

export async function POST(request: Request) {
  const headers = corsFor(request);
  if (!headers) return json({ error: "Origin not allowed." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ error: "Send a JSON request." }, 415, headers);
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ error: "The application is too large." }, 413, headers);

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return json({ error: "The application could not be read." }, 400, headers);
  }
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) return json({ error: "The application is too large." }, 413, headers);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "The application is not valid JSON." }, 400, headers);
  }
  const parsed = pilotWaitlistInputSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Check the highlighted details and try again." }, 400, headers);

  if (parsed.data.companyWebsite) return json(acceptedBody, 202, headers);

  try {
    const rateLimit = await enforcePilotRateLimit(request);
    if (!rateLimit.allowed) return json(
      { error: "Too many applications were sent from this connection. Please try again later." },
      429,
      { ...headers, "retry-after": String(rateLimit.retryAfterSeconds) }
    );
    if (!(await verifyPilotTurnstile(parsed.data.turnstileToken))) return json({ error: "Verification expired or could not be confirmed. Please try again." }, 403, headers);
    await acceptPilotWaitlistLead(parsed.data);
    return json(acceptedBody, 202, headers);
  } catch (error) {
    if (error instanceof PilotWaitlistConfigurationError) return json({ error: "Pilot applications are not configured yet." }, 503, headers);
    if (error instanceof PilotWaitlistProviderUnavailableError) return json({ error: "Verification is temporarily unavailable. Please try again shortly." }, 503, headers);
    return json({ error: "The application could not be saved. Please try again." }, 503, headers);
  }
}
