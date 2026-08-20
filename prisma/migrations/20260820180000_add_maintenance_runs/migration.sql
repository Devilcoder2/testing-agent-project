-- CreateEnum
CREATE TYPE "MaintenanceKind" AS ENUM ('EVIDENCE_RETENTION');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL');

-- CreateTable
CREATE TABLE "MaintenanceRun" (
    "id" TEXT NOT NULL,
    "kind" "MaintenanceKind" NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'RUNNING',
    "deletedEvidenceCount" INTEGER NOT NULL DEFAULT 0,
    "deletedScreenshotCount" INTEGER NOT NULL DEFAULT 0,
    "deletedDiagnosticCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceRun_kind_completedAt_idx" ON "MaintenanceRun"("kind", "completedAt");
