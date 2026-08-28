import crypto from "node:crypto";

export type TelegramKeyboard = { text: string; callback_data: string }[][];

export type SafeTelegramUpdate =
  | { updateId: string; kind: "MESSAGE"; chatId: string; command: "START" | "MENU" | null; linkToken: string | null }
  | { updateId: string; kind: "CALLBACK_QUERY"; chatId: string; callbackId: string; callbackData: string };

type TelegramResponse<T> = { ok: boolean; result?: T };

function config() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const username = process.env.TELEGRAM_BOT_USERNAME;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  if (!token || !username || !secret || !webhookUrl) throw new Error("TELEGRAM_NOT_CONFIGURED");
  return { token, username: username.replace(/^@/, ""), secret, webhookUrl };
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && crypto.timingSafeEqual(leftBytes, rightBytes);
}

export function verifyTelegramWebhookSecret(value: string | null) {
  try {
    return Boolean(value && safeEqual(value, config().secret));
  } catch {
    return false;
  }
}

export function telegramIsConfigured() {
  try {
    config();
    return true;
  } catch {
    return false;
  }
}

export function telegramDeepLink(token: string) {
  const { username } = config();
  return `https://t.me/${username}?start=${token}`;
}

function privateChat(value: unknown): value is { id: number | string; type: "private" } {
  return Boolean(value) && typeof value === "object" && (value as { type?: unknown }).type === "private" && ["number", "string"].includes(typeof (value as { id?: unknown }).id);
}

export function parseTelegramUpdate(payload: unknown): SafeTelegramUpdate | null {
  if (!payload || typeof payload !== "object") return null;
  const update = payload as { update_id?: unknown; message?: { chat?: unknown; text?: unknown }; callback_query?: { id?: unknown; data?: unknown; message?: { chat?: unknown } } };
  if (typeof update.update_id !== "number" && typeof update.update_id !== "string") return null;
  const updateId = String(update.update_id);
  if (update.message) {
    if (!privateChat(update.message.chat)) return null;
    const text = typeof update.message.text === "string" ? update.message.text.trim() : "";
    const start = text.match(/^\/start(?:\s+([A-Za-z0-9_-]{16,128}))?$/);
    const command = start ? "START" : text === "/menu" ? "MENU" : null;
    return { updateId, kind: "MESSAGE", chatId: String(update.message.chat.id), command, linkToken: start?.[1] ?? null };
  }
  if (update.callback_query) {
    if (!privateChat(update.callback_query.message?.chat) || typeof update.callback_query.id !== "string" || typeof update.callback_query.data !== "string") return null;
    const callbackData = update.callback_query.data;
    if (!/^m:[A-Za-z0-9_-]{10,64}$/.test(callbackData) || Buffer.byteLength(callbackData, "utf8") > 64) return null;
    return { updateId, kind: "CALLBACK_QUERY", chatId: String(update.callback_query.message.chat.id), callbackId: update.callback_query.id, callbackData };
  }
  return null;
}

async function telegramFetch<T>(method: string, body: Record<string, unknown>) {
  const { token } = config();
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new Error("TELEGRAM_TRANSIENT_NETWORK_ERROR");
  }
  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) throw new Error("TELEGRAM_TRANSIENT_PROVIDER_ERROR");
    throw new Error("TELEGRAM_PROVIDER_REJECTED");
  }
  const parsed = await response.json().catch(() => null) as TelegramResponse<T> | null;
  if (!parsed?.ok) throw new Error("TELEGRAM_PROVIDER_REJECTED");
  return parsed.result;
}

export async function setTelegramWebhook() {
  const { webhookUrl, secret } = config();
  await telegramFetch("setWebhook", {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false
  });
}

export async function deleteTelegramWebhook() {
  await telegramFetch("deleteWebhook", { drop_pending_updates: false });
}

export async function acknowledgeTelegramCallback(callbackId: string) {
  await telegramFetch("answerCallbackQuery", { callback_query_id: callbackId });
}

export async function sendTelegramMessage(chatId: string, text: string, keyboard?: TelegramKeyboard) {
  await telegramFetch("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
    disable_web_page_preview: true
  });
}

export function isTransientTelegramError(error: unknown) {
  return error instanceof Error && ["TELEGRAM_TRANSIENT_NETWORK_ERROR", "TELEGRAM_TRANSIENT_PROVIDER_ERROR"].includes(error.message);
}
