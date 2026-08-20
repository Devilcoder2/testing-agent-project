import { describe, expect, it } from "vitest";
import { customerEmailForDiagnostic, customerLookupByEmail, verifyQaReadOnlyAccess } from "../lib/database-diagnostics";
import { encryptVariableValue } from "../lib/variables";

describe("Phase 10 database diagnostics", () => {
  it("uses the final non-secret email field and resolves a bound variable without returning it", () => {
    const email = customerEmailForDiagnostic([
      { kind: "TEXT_ENTRY", target: { inputType: "email" }, value: "login@example.test", isRedacted: false, variableName: null },
      { kind: "TEXT_ENTRY", target: { inputType: "password" }, value: "[REDACTED]", isRedacted: true, variableName: null },
      { kind: "TEXT_ENTRY", target: { inputType: "email" }, value: "{{customer_email}}", isRedacted: false, variableName: "customer_email" }
    ], [{ name: "customer_email", valueEncrypted: encryptVariableValue("customer.lookup@example.test") }]);

    expect(email).toBe("customer.lookup@example.test");
    expect(customerEmailForDiagnostic([{ kind: "TEXT_ENTRY", target: { inputType: "email" }, value: "[REDACTED]", isRedacted: true, variableName: null }], [])).toBeNull();
  });

  it("queries the isolated fixture with the read-only role and returns only safe customer metadata", async () => {
    const fixture = await fetch("http://qa-fixture:8081/customers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "phase10.diagnostic@example.test", firstName: "Phase", lastName: "Ten" })
    });
    expect(fixture.status).toBe(201);

    await expect(verifyQaReadOnlyAccess()).resolves.toEqual({ ok: true, errorCode: "QA_DATABASE_ACCESS_DENIED" });
    const result = await customerLookupByEmail("phase10.diagnostic@example.test");
    expect(result).toMatchObject({ status: "COMPLETE", safeMetadata: { result: "FOUND", customerStatus: "ACTIVE" } });
    expect(JSON.stringify(result)).not.toContain("phase10.diagnostic@example.test");
    await expect(customerLookupByEmail("missing.phase10@example.test")).resolves.toEqual({ status: "COMPLETE", safeMetadata: { result: "NOT_FOUND" } });
  });
});
