import { Pool } from "pg";
import type { Prisma } from "@prisma/client";
import { decryptVariableValue } from "./variables";

type Step = { kind: string; target: Prisma.JsonValue; value: string | null; isRedacted: boolean; variableName: string | null };
type Binding = { name: string; valueEncrypted: string };
export type CustomerLookupResult = { status: "COMPLETE"; safeMetadata: { result: "FOUND" | "NOT_FOUND"; customerStatus?: string; createdAt?: string; updatedAt?: string } } | { status: "INCOMPLETE" | "UNAVAILABLE"; errorCode: string };

function targetRecord(target: Prisma.JsonValue) {
  return target && typeof target === "object" && !Array.isArray(target) ? target as Record<string, unknown> : {};
}

export function customerEmailForDiagnostic(steps: Step[], bindings: Binding[]) {
  const emailStep = [...steps].reverse().find((step) => step.kind === "TEXT_ENTRY" && !step.isRedacted && String(targetRecord(step.target).inputType ?? "") === "email");
  if (!emailStep) return null;
  const value = emailStep.variableName ? bindings.find((binding) => binding.name === emailStep.variableName)?.valueEncrypted : emailStep.value;
  if (!value) return null;
  try {
    const email = emailStep.variableName ? decryptVariableValue(value) : value;
    return /^\S+@\S+\.\S+$/.test(email) ? email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

function diagnosticPool() {
  const connectionString = process.env.QA_DATABASE_URL;
  if (!connectionString) return null;
  return new Pool({ connectionString, max: 1, connectionTimeoutMillis: 1_500, idleTimeoutMillis: 1_000 });
}

export async function verifyQaReadOnlyAccess() {
  const pool = diagnosticPool();
  if (!pool) return { ok: false, errorCode: "QA_DATABASE_UNAVAILABLE" } as const;
  try {
    const result = await pool.query<{ canSelect: boolean; canInsert: boolean; canUpdate: boolean; canDelete: boolean; canCreate: boolean }>("SELECT has_table_privilege(current_user, 'public.qa_customers', 'SELECT') AS \"canSelect\", has_table_privilege(current_user, 'public.qa_customers', 'INSERT') AS \"canInsert\", has_table_privilege(current_user, 'public.qa_customers', 'UPDATE') AS \"canUpdate\", has_table_privilege(current_user, 'public.qa_customers', 'DELETE') AS \"canDelete\", has_schema_privilege(current_user, 'public', 'CREATE') AS \"canCreate\"");
    const access = result.rows[0];
    return { ok: Boolean(access?.canSelect && !access.canInsert && !access.canUpdate && !access.canDelete && !access.canCreate), errorCode: "QA_DATABASE_ACCESS_DENIED" } as const;
  } catch {
    return { ok: false, errorCode: "QA_DATABASE_UNAVAILABLE" } as const;
  } finally {
    await pool.end();
  }
}

export async function customerLookupByEmail(email: string): Promise<CustomerLookupResult> {
  const pool = diagnosticPool();
  if (!pool) return { status: "UNAVAILABLE", errorCode: "QA_DATABASE_UNAVAILABLE" };
  let client;
  try {
    const verification = await verifyQaReadOnlyAccess();
    if (!verification.ok) return { status: "UNAVAILABLE", errorCode: verification.errorCode };
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '1500ms'");
    const result = await client.query<{ status: string; created_at: Date; updated_at: Date }>("SELECT status, created_at, updated_at FROM qa_customers WHERE email = $1 LIMIT 1", [email]);
    await client.query("COMMIT");
    const customer = result.rows[0];
    return customer ? { status: "COMPLETE", safeMetadata: { result: "FOUND", customerStatus: customer.status, createdAt: customer.created_at.toISOString(), updatedAt: customer.updated_at.toISOString() } } : { status: "COMPLETE", safeMetadata: { result: "NOT_FOUND" } };
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => undefined);
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    return code === "57014" ? { status: "INCOMPLETE", errorCode: "QA_DATABASE_TIMEOUT" } : code === "42501" ? { status: "INCOMPLETE", errorCode: "QA_DATABASE_ACCESS_DENIED" } : { status: "UNAVAILABLE", errorCode: "QA_DATABASE_QUERY_FAILED" };
  } finally {
    client?.release();
    await pool.end();
  }
}
