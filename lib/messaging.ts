import crypto from "node:crypto";

const VERSION = "v1";

function messagingKey() {
  const encoded = process.env.MESSAGING_ENCRYPTION_KEY;
  if (!encoded) throw new Error("MESSAGING_ENCRYPTION_UNAVAILABLE");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) throw new Error("MESSAGING_ENCRYPTION_UNAVAILABLE");
  return key;
}

export function messagingIdentifierHash(value: string) {
  return crypto.createHash("sha256").update(`telegram:${value}`, "utf8").digest("hex");
}

export function encryptMessagingIdentifier(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", messagingKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptMessagingIdentifier(payload: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] = payload.split(".");
  if (version !== VERSION || !encodedIv || !encodedTag || !encodedCiphertext || extra) throw new Error("MESSAGING_CIPHERTEXT_INVALID");
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", messagingKey(), Buffer.from(encodedIv, "base64url"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encodedCiphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("MESSAGING_CIPHERTEXT_INVALID");
  }
}

export function messagingConfigured() {
  try {
    messagingKey();
    return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_WEBHOOK_SECRET && process.env.TELEGRAM_WEBHOOK_URL);
  } catch {
    return false;
  }
}
