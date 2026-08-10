-- CreateEnum
CREATE TYPE "RunMode" AS ENUM ('GUIDED', 'AUTO');

-- CreateEnum
CREATE TYPE "RunAttemptStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RunFailureReason" AS ENUM ('SELECTOR_NOT_FOUND', 'SELECTOR_AMBIGUOUS', 'ACTION_FAILED', 'NAVIGATION_TIMEOUT', 'BROWSER_STARTUP', 'CHECKPOINT_TIMEOUT', 'CANCELLED', 'VARIABLE_UNSUPPORTED', 'INFRASTRUCTURE_ERROR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RunStatus" ADD VALUE 'PAUSED';
ALTER TYPE "RunStatus" ADD VALUE 'CANCELLING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RunStepStatus" ADD VALUE 'RUNNING';
ALTER TYPE "RunStepStatus" ADD VALUE 'WAITING_FOR_CONFIRMATION';

-- AlterTable
ALTER TABLE "EvidenceItem" ADD COLUMN     "runAttemptId" TEXT;

-- AlterTable
ALTER TABLE "RecordedStep" ADD COLUMN     "isCheckpoint" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "cancellingAt" TIMESTAMP(3),
ADD COLUMN     "checkpointDeadline" TIMESTAMP(3),
ADD COLUMN     "failureReason" "RunFailureReason",
ADD COLUMN     "mode" "RunMode" NOT NULL DEFAULT 'GUIDED',
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TestStep" ADD COLUMN     "isCheckpoint" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RunAttempt" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "RunAttemptStatus" NOT NULL DEFAULT 'QUEUED',
    "failureReason" "RunFailureReason",
    "jobId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "activeDurationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RunAttempt_jobId_key" ON "RunAttempt"("jobId");

-- CreateIndex
CREATE INDEX "RunAttempt_runId_createdAt_idx" ON "RunAttempt"("runId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RunAttempt_runId_attemptNumber_key" ON "RunAttempt"("runId", "attemptNumber");

-- CreateIndex
CREATE INDEX "EvidenceItem_runAttemptId_idx" ON "EvidenceItem"("runAttemptId");

-- CreateIndex
CREATE INDEX "Run_mode_status_createdAt_idx" ON "Run"("mode", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "RunAttempt" ADD CONSTRAINT "RunAttempt_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_runAttemptId_fkey" FOREIGN KEY ("runAttemptId") REFERENCES "RunAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
