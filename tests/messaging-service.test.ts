import { afterEach, describe, expect, it } from "vitest";
import { AccountStatus, MessagingProvider, OrganizationRole } from "@prisma/client";
import { createTelegramLink, linkTelegramChat, telegramIdentityStatus, unlinkTelegram } from "../lib/messaging-service";
import { prisma } from "../lib/prisma";

const userIds: string[] = [];

afterEach(async () => {
  const ids = userIds.splice(0);
  if (!ids.length) return;
  await prisma.auditEvent.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe("Phase 14 Telegram identity lifecycle", () => {
  it("binds a single-use ten-minute portal token to an encrypted private chat and revokes it immediately", async () => {
    const organization = await prisma.organization.findFirstOrThrow();
    const user = await prisma.user.create({ data: { email: `telegram-${Date.now()}@example.test`, displayName: "Telegram test user", accountStatus: AccountStatus.ACTIVE, organizationMemberships: { create: { organizationId: organization.id, role: OrganizationRole.TESTER } } } });
    userIds.push(user.id);
    const sessionUser = { id: user.id, email: user.email, displayName: user.displayName, organizationId: organization.id, role: OrganizationRole.TESTER };
    const token = await createTelegramLink(sessionUser);
    const chatId = `test-chat-${Date.now()}`;
    const identity = await linkTelegramChat(token, chatId);

    expect(identity.provider).toBe(MessagingProvider.TELEGRAM);
    expect(identity.chatIdEncrypted).not.toContain(chatId);
    expect((await telegramIdentityStatus(sessionUser)).linked).toBe(true);
    await expect(linkTelegramChat(token, `${chatId}-second`)).rejects.toThrow("TELEGRAM_LINK_INVALID");

    expect(await unlinkTelegram(sessionUser)).toBe(true);
    expect((await telegramIdentityStatus(sessionUser)).linked).toBe(false);
    expect(await prisma.messagingIdentity.findUniqueOrThrow({ where: { id: identity.id }, select: { status: true, revokedAt: true } })).toMatchObject({ status: "REVOKED" });
  });
});
