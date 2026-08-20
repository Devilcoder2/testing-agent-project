CREATE TYPE "TestSuggestionKind" AS ENUM ('REQUIRED_MISSING', 'INVALID_EMAIL', 'BOUNDARY_TOO_SHORT', 'BOUNDARY_TOO_LONG');

CREATE TYPE "TestSuggestionStatus" AS ENUM ('DRAFT', 'APPROVED', 'DISMISSED');

CREATE TABLE "TestSuggestion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sourceTestCaseId" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "sourceStepId" TEXT NOT NULL,
    "kind" "TestSuggestionKind" NOT NULL,
    "status" "TestSuggestionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "expectedOutcome" TEXT NOT NULL,
    "proposedValue" TEXT NOT NULL,
    "approvedTestCaseId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "dismissedById" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TestSuggestion_approvedTestCaseId_key" ON "TestSuggestion"("approvedTestCaseId");
CREATE UNIQUE INDEX "TestSuggestion_sourceVersionId_sourceStepId_kind_key" ON "TestSuggestion"("sourceVersionId", "sourceStepId", "kind");
CREATE INDEX "TestSuggestion_productId_status_createdAt_idx" ON "TestSuggestion"("productId", "status", "createdAt");
CREATE INDEX "TestSuggestion_sourceTestCaseId_createdAt_idx" ON "TestSuggestion"("sourceTestCaseId", "createdAt");

ALTER TABLE "TestSuggestion" ADD CONSTRAINT "TestSuggestion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestSuggestion" ADD CONSTRAINT "TestSuggestion_sourceTestCaseId_fkey" FOREIGN KEY ("sourceTestCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestSuggestion" ADD CONSTRAINT "TestSuggestion_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "TestCaseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestSuggestion" ADD CONSTRAINT "TestSuggestion_sourceStepId_fkey" FOREIGN KEY ("sourceStepId") REFERENCES "TestStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestSuggestion" ADD CONSTRAINT "TestSuggestion_approvedTestCaseId_fkey" FOREIGN KEY ("approvedTestCaseId") REFERENCES "TestCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestSuggestion" ADD CONSTRAINT "TestSuggestion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestSuggestion" ADD CONSTRAINT "TestSuggestion_dismissedById_fkey" FOREIGN KEY ("dismissedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
