import http from "node:http";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.QA_FIXTURE_DATABASE_URL });
const port = Number(process.env.QA_FIXTURE_PORT ?? "8081");

function respond(response: http.ServerResponse, status: number, body: Record<string, unknown>) {
  response.writeHead(status, { "access-control-allow-origin": "http://demo-target", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return respond(response, 204, {});
  if (request.method !== "POST" || request.url !== "/customers") return respond(response, 404, { error: "Not found." });
  let raw = "";
  for await (const chunk of request) raw += chunk;
  try {
    const body = JSON.parse(raw) as { email?: unknown; firstName?: unknown; lastName?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || !firstName || !lastName) return respond(response, 400, { error: "Customer details are invalid." });
    await pool.query("INSERT INTO qa_customers (email, first_name, last_name) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, updated_at = CURRENT_TIMESTAMP", [email, firstName, lastName]);
    return respond(response, 201, { status: "created" });
  } catch {
    return respond(response, 503, { error: "The local customer fixture is unavailable." });
  }
});

server.listen(port, () => console.log(`QA fixture API listening on ${port}`));
