import crypto from "node:crypto";
import { promisify } from "node:util";
import { AccountStatus, AuthTokenKind, OrganizationRole } from "@prisma/client";
import { prisma } from "./prisma";

const scrypt = promisify(crypto.scrypt);
const SESSION_HOURS = 8;
const TOKEN_HOURS = 24;
const TELEGRAM_LINK_MINUTES = 10;

export type SessionUser = { id: string; email: string; displayName: string; organizationId: string; role: OrganizationRole };

export function tokenHash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored?: string | null) {
  if (!stored) return false;
  const [scheme, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expectedBytes = Buffer.from(expected, "base64url");
  return actual.length === expectedBytes.length && crypto.timingSafeEqual(actual, expectedBytes);
}

export function validPassword(value: unknown) {
  return typeof value === "string" && value.length >= 12 && value.length <= 200;
}

export async function createSession(userId: string, organizationId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.userSession.create({ data: { userId, organizationId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000) } });
  return token;
}

export async function readSession(value?: string): Promise<SessionUser | null> {
  if (!value) return null;
  const session = await prisma.userSession.findUnique({ where: { tokenHash: tokenHash(value) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date() || session.user.accountStatus !== AccountStatus.ACTIVE) {
    if (session) await prisma.userSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  const membership = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: session.organizationId, userId: session.userId } } });
  if (!membership) return null;
  return { id: session.user.id, email: session.user.email, displayName: session.user.displayName, organizationId: session.organizationId, role: membership.role };
}

export async function revokeUserSessions(userId: string) {
  await prisma.userSession.deleteMany({ where: { userId } });
}

export async function issueAuthToken(userId: string, kind: AuthTokenKind, organizationId?: string | null) {
  const value = crypto.randomBytes(32).toString("base64url");
  const durationMs = kind === AuthTokenKind.TELEGRAM_LINK ? TELEGRAM_LINK_MINUTES * 60 * 1000 : TOKEN_HOURS * 60 * 60 * 1000;
  await prisma.authToken.create({ data: { userId, organizationId: organizationId ?? null, kind, tokenHash: tokenHash(value), expiresAt: new Date(Date.now() + durationMs) } });
  return value;
}

export async function consumeAuthToken(value: string, kind: AuthTokenKind) {
  const token = await prisma.authToken.findUnique({ where: { tokenHash: tokenHash(value) } });
  if (!token || token.kind !== kind || token.usedAt || token.expiresAt <= new Date()) return null;
  const consumed = await prisma.authToken.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: new Date() } });
  return consumed.count === 1 ? token : null;
}
