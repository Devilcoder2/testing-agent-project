import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptMessagingIdentifier, encryptMessagingIdentifier, messagingIdentifierHash } from "../lib/messaging";
import { parseTelegramUpdate, setTelegramWebhook, verifyTelegramWebhookSecret } from "../lib/telegram";

const original = { ...process.env };

function configure() {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_BOT_USERNAME = "sentinel_test_bot";
  process.env.TELEGRAM_WEBHOOK_SECRET = "test-webhook-secret";
  process.env.TELEGRAM_WEBHOOK_URL = "https://telegram.example/api/internal/telegram/webhook";
  process.env.MESSAGING_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
}

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
  vi.unstubAllGlobals();
});

describe("Phase 14 Telegram safety primitives", () => {
  it("encrypts a chat identifier and uses a stable non-plaintext lookup hash", () => {
    configure();
    const encrypted = encryptMessagingIdentifier("123456789");
    expect(encrypted).not.toContain("123456789");
    expect(decryptMessagingIdentifier(encrypted)).toBe("123456789");
    expect(messagingIdentifierHash("123456789")).toBe(messagingIdentifierHash("123456789"));
    expect(messagingIdentifierHash("123456789")).not.toContain("123456789");
  });

  it("accepts only private Telegram start/menu and opaque callback updates", () => {
    const start = parseTelegramUpdate({ update_id: 1, message: { chat: { id: 42, type: "private" }, text: "/start opaque_token_value_123" } });
    expect(start).toMatchObject({ updateId: "1", kind: "MESSAGE", chatId: "42", command: "START", linkToken: "opaque_token_value_123" });
    expect(parseTelegramUpdate({ update_id: 2, message: { chat: { id: 42, type: "group" }, text: "/start" } })).toBeNull();
    expect(parseTelegramUpdate({ update_id: 3, callback_query: { id: "callback", data: "m:cmessagingaction123", message: { chat: { id: 42, type: "private" } } } })).toMatchObject({ kind: "CALLBACK_QUERY", callbackData: "m:cmessagingaction123" });
    expect(parseTelegramUpdate({ update_id: 4, callback_query: { id: "callback", data: "run:secret", message: { chat: { id: 42, type: "private" } } } })).toBeNull();
  });

  it("uses timing-safe secret validation and configures a filtered webhook", async () => {
    configure();
    expect(verifyTelegramWebhookSecret("test-webhook-secret")).toBe(true);
    expect(verifyTelegramWebhookSecret("wrong")).toBe(false);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await setTelegramWebhook();
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.telegram.org/bottest-token/setWebhook");
    expect(JSON.parse(String(request.body))).toEqual({ url: process.env.TELEGRAM_WEBHOOK_URL, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ["message", "callback_query"], drop_pending_updates: false });
  });
});
