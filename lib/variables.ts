import crypto from "node:crypto";

const secretNamePattern = /(password|passcode|token|secret|cookie|authorization|api[_-]?key)/i;
const secretValuePattern = /(?:^|\b)(?:bearer\s+|api[_-]?key\s*[:=]|authorization\s*[:=]|token\s*[:=])/i;
const variableNamePattern = /^[a-z][a-z0-9_]{0,63}$/;

export type VariableSuggestion = {
  name: string;
  reason: "email" | "identifier" | "order-number";
};

export function canonicalVariableName(value: unknown) {
  if (typeof value !== "string") throw new Error("VARIABLE_NAME_INVALID");
  const name = value.trim().toLowerCase();
  if (!variableNamePattern.test(name)) throw new Error("VARIABLE_NAME_INVALID");
  return name;
}

export function variablePlaceholder(name: string) {
  return `[VARIABLE:${canonicalVariableName(name)}]`;
}

export function isSecretLikeVariable(name: string, value: string) {
  return secretNamePattern.test(name) || secretValuePattern.test(value);
}

function encryptionKey() {
  const encoded = process.env.VARIABLE_ENCRYPTION_KEY;
  if (!encoded) throw new Error("VARIABLE_ENCRYPTION_UNAVAILABLE");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) throw new Error("VARIABLE_ENCRYPTION_UNAVAILABLE");
  return key;
}

export function encryptVariableValue(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptVariableValue(payload: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] = payload.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedCiphertext || extra) throw new Error("VARIABLE_CIPHERTEXT_INVALID");
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(encodedIv, "base64url"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encodedCiphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("VARIABLE_CIPHERTEXT_INVALID");
  }
}

export function suggestedVariable(target: unknown, value: unknown): VariableSuggestion | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const candidate = target && typeof target === "object" ? target as { name?: unknown } : {};
  const fieldName = typeof candidate.name === "string" ? candidate.name.trim() : "";
  const lowerName = fieldName.toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { name: canonicalVariableName(lowerName || "email"), reason: "email" };
  if (/order/i.test(fieldName) && /\d/.test(value)) return { name: canonicalVariableName(lowerName || "order_number"), reason: "order-number" };
  if (/(^|_)(id|identifier)($|_)/i.test(fieldName) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value)) return { name: canonicalVariableName(lowerName || "identifier"), reason: "identifier" };
  return undefined;
}

export function maskedVariableValue() {
  return "Configured (masked)";
}
