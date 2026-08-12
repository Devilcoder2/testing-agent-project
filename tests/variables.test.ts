import { describe, expect, it } from "vitest";
import { canonicalVariableName, decryptVariableValue, encryptVariableValue, isSecretLikeVariable, suggestedVariable, variablePlaceholder } from "../lib/variables";

describe("Phase 4 variable boundary", () => {
  it("canonicalizes shared names and creates non-secret placeholders", () => {
    expect(canonicalVariableName(" Customer_Email ")).toBe("customer_email");
    expect(variablePlaceholder("customer_email")).toBe("[VARIABLE:customer_email]");
    expect(() => canonicalVariableName("customer-email")).toThrow("VARIABLE_NAME_INVALID");
  });

  it("encrypts values with authenticated encryption and rejects tampering", () => {
    const encrypted = encryptVariableValue("customer@example.test");
    expect(encrypted).not.toContain("customer@example.test");
    expect(decryptVariableValue(encrypted)).toBe("customer@example.test");
    const [version, iv, tag, ciphertext] = encrypted.split(".");
    const tampered = `${version}.${iv}.${tag.slice(0, -1)}${tag.endsWith("A") ? "B" : "A"}.${ciphertext}`;
    expect(() => decryptVariableValue(tampered)).toThrow("VARIABLE_CIPHERTEXT_INVALID");
  });

  it("rejects secret-like names and values", () => {
    expect(isSecretLikeVariable("access_token", "ordinary value")).toBe(true);
    expect(isSecretLikeVariable("customer_email", "Bearer hidden-value")).toBe(true);
    expect(isSecretLikeVariable("customer_email", "customer@example.test")).toBe(false);
  });

  it("suggests only deterministic email, ID, and order-number candidates", () => {
    expect(suggestedVariable({ name: "customer_email" }, "customer@example.test")).toEqual({ name: "customer_email", reason: "email" });
    expect(suggestedVariable({ name: "order_number" }, "ORD-1092")).toEqual({ name: "order_number", reason: "order-number" });
    expect(suggestedVariable({ name: "first_name" }, "Ava")).toBeUndefined();
  });
});
