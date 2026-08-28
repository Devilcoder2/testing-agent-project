-- CreateEnum
CREATE TYPE "MessagingProvider" AS ENUM ('TELEGRAM');

-- CreateEnum
CREATE TYPE "MessagingIdentityStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "MessagingInboundUpdateKind" AS ENUM ('MESSAGE', 'CALLBACK_QUERY');

-- CreateEnum
CREATE TYPE "MessagingInboundUpdateStatus" AS ENUM ('RECEIVED', 'QUEUED', 'PROCESSED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessagingCommandStatus" AS ENUM ('SELECTING', 'CONFIRMING', 'QUEUED', 'CANCELLED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessagingDeliveryKind" AS ENUM ('RUN_TERMINAL');

-- CreateEnum
CREATE TYPE "MessagingDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterEnum
ALTER TYPE "AuthTokenKind" ADD VALUE 'TELEGRAM_LINK';

-- AlterEnum
ALTER TYPE "MaintenanceKind" ADD VALUE 'MESSAGING_RETENTION';

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_organizationId_fkey";

-- AlterTable
ALTER TABLE "MaintenanceRun" ADD COLUMN     "deletedMessagingCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MessagingIntegrationConfig" (
    "id" TEXT NOT NULL,
    "provider" "MessagingProvider" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "webhookActiveAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "safeError" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingIntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingIdentity" (
    "id" TEXT NOT NULL,
    "provider" "MessagingProvider" NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatIdEncrypted" TEXT NOT NULL,
    "chatIdHash" TEXT NOT NULL,
    "status" "MessagingIdentityStatus" NOT NULL DEFAULT 'ACTIVE',
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastCommandAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingInboundUpdate" (
    "id" TEXT NOT NULL,
    "provider" "MessagingProvider" NOT NULL,
    "providerUpdateId" TEXT NOT NULL,
    "kind" "MessagingInboundUpdateKind" NOT NULL,
    "identityId" TEXT,
    "status" "MessagingInboundUpdateStatus" NOT NULL DEFAULT 'RECEIVED',
    "safeReason" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingInboundUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingCommand" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceReleaseId" TEXT,
    "status" "MessagingCommandStatus" NOT NULL DEFAULT 'SELECTING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "terminalAt" TIMESTAMP(3),
    "safeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingCommandSelection" (
    "commandId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagingCommandSelection_pkey" PRIMARY KEY ("commandId","testCaseId")
);

-- CreateTable
CREATE TABLE "MessagingAction" (
    "id" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagingAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingDelivery" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "kind" "MessagingDeliveryKind" NOT NULL,
    "status" "MessagingDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "safeError" TEXT,
    "sentAt" TIMESTAMP(3),
    "terminalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessagingIntegrationConfig_provider_key" ON "MessagingIntegrationConfig"("provider");

-- CreateIndex
CREATE INDEX "MessagingIntegrationConfig_provider_isActive_idx" ON "MessagingIntegrationConfig"("provider", "isActive");

-- CreateIndex
CREATE INDEX "MessagingIdentity_organizationId_status_idx" ON "MessagingIdentity"("organizationId", "status");

-- CreateIndex
CREATE INDEX "MessagingIdentity_userId_status_idx" ON "MessagingIdentity"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingIdentity_provider_userId_organizationId_key" ON "MessagingIdentity"("provider", "userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingIdentity_provider_chatIdHash_key" ON "MessagingIdentity"("provider", "chatIdHash");

-- CreateIndex
CREATE INDEX "MessagingInboundUpdate_identityId_receivedAt_idx" ON "MessagingInboundUpdate"("identityId", "receivedAt");

-- CreateIndex
CREATE INDEX "MessagingInboundUpdate_status_receivedAt_idx" ON "MessagingInboundUpdate"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingInboundUpdate_provider_providerUpdateId_key" ON "MessagingInboundUpdate"("provider", "providerUpdateId");

-- CreateIndex
CREATE INDEX "MessagingCommand_identityId_status_expiresAt_idx" ON "MessagingCommand"("identityId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "MessagingCommand_organizationId_status_createdAt_idx" ON "MessagingCommand"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MessagingCommandSelection_testCaseId_idx" ON "MessagingCommandSelection"("testCaseId");

-- CreateIndex
CREATE INDEX "MessagingAction_commandId_action_idx" ON "MessagingAction"("commandId", "action");

-- CreateIndex
CREATE INDEX "MessagingDelivery_identityId_status_createdAt_idx" ON "MessagingDelivery"("identityId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingDelivery_runId_kind_key" ON "MessagingDelivery"("runId", "kind");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingIdentity" ADD CONSTRAINT "MessagingIdentity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingIdentity" ADD CONSTRAINT "MessagingIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingInboundUpdate" ADD CONSTRAINT "MessagingInboundUpdate_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "MessagingIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingCommand" ADD CONSTRAINT "MessagingCommand_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "MessagingIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingCommand" ADD CONSTRAINT "MessagingCommand_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingCommand" ADD CONSTRAINT "MessagingCommand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingCommand" ADD CONSTRAINT "MessagingCommand_sourceReleaseId_fkey" FOREIGN KEY ("sourceReleaseId") REFERENCES "Release"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingCommandSelection" ADD CONSTRAINT "MessagingCommandSelection_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "MessagingCommand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingCommandSelection" ADD CONSTRAINT "MessagingCommandSelection_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingAction" ADD CONSTRAINT "MessagingAction_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "MessagingCommand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingDelivery" ADD CONSTRAINT "MessagingDelivery_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "MessagingIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingDelivery" ADD CONSTRAINT "MessagingDelivery_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ProductRepositoryConnection_installationId_repositoryId_status_" RENAME TO "ProductRepositoryConnection_installationId_repositoryId_sta_idx";
