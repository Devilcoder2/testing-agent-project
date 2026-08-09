-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RunOutcome" AS ENUM ('PASSED', 'FAILED', 'INTERRUPTED');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('COMPLETE', 'PARTIAL');

-- CreateEnum
CREATE TYPE "RunStepStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('SCREENSHOT', 'NETWORK', 'CONSOLE', 'STORAGE', 'CAPTURE_ERROR');

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "testCaseVersionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "outcome" "RunOutcome",
    "evidenceStatus" "EvidenceStatus" NOT NULL DEFAULT 'COMPLETE',
    "activeStepOrder" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunStepResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "testStepId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "RunStepStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RunStepResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "runStepResultId" TEXT,
    "kind" "EvidenceKind" NOT NULL,
    "objectKey" TEXT,
    "checksum" TEXT,
    "contentType" TEXT,
    "byteSize" INTEGER,
    "metadata" JSONB,
    "captureError" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Run_productId_createdAt_idx" ON "Run"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "Run_testCaseId_createdAt_idx" ON "Run"("testCaseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RunStepResult_runId_order_key" ON "RunStepResult"("runId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "RunStepResult_runId_testStepId_key" ON "RunStepResult"("runId", "testStepId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceItem_objectKey_key" ON "EvidenceItem"("objectKey");

-- CreateIndex
CREATE INDEX "EvidenceItem_runId_capturedAt_idx" ON "EvidenceItem"("runId", "capturedAt");

-- CreateIndex
CREATE INDEX "EvidenceItem_runStepResultId_idx" ON "EvidenceItem"("runStepResultId");

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_testCaseVersionId_fkey" FOREIGN KEY ("testCaseVersionId") REFERENCES "TestCaseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunStepResult" ADD CONSTRAINT "RunStepResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunStepResult" ADD CONSTRAINT "RunStepResult_testStepId_fkey" FOREIGN KEY ("testStepId") REFERENCES "TestStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_runStepResultId_fkey" FOREIGN KEY ("runStepResultId") REFERENCES "RunStepResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
