CREATE TYPE "DatabaseDiagnosticKind" AS ENUM ('CUSTOMER_LOOKUP_BY_EMAIL');
CREATE TYPE "DatabaseDiagnosticStatus" AS ENUM ('COMPLETE', 'INCOMPLETE', 'UNAVAILABLE');
ALTER TYPE "EvidenceKind" ADD VALUE 'DATABASE';

CREATE TABLE "DatabaseDiagnostic" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "kind" "DatabaseDiagnosticKind" NOT NULL,
  "status" "DatabaseDiagnosticStatus" NOT NULL,
  "requestedById" TEXT NOT NULL,
  "safeMetadata" JSONB,
  "errorCode" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DatabaseDiagnostic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DatabaseDiagnostic_runId_kind_key" ON "DatabaseDiagnostic"("runId", "kind");
CREATE INDEX "DatabaseDiagnostic_runId_createdAt_idx" ON "DatabaseDiagnostic"("runId", "createdAt");
CREATE INDEX "DatabaseDiagnostic_requestedById_createdAt_idx" ON "DatabaseDiagnostic"("requestedById", "createdAt");
ALTER TABLE "DatabaseDiagnostic" ADD CONSTRAINT "DatabaseDiagnostic_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DatabaseDiagnostic" ADD CONSTRAINT "DatabaseDiagnostic_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
