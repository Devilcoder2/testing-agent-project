CREATE TYPE "ChangeProposalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'STALE');
ALTER TYPE "NotificationType" ADD VALUE 'CHANGE_PROPOSAL_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'CHANGE_PROPOSAL_RESOLVED';

CREATE TABLE "ChangeProposal" (
  "id" TEXT NOT NULL, "runId" TEXT NOT NULL, "productId" TEXT NOT NULL, "testCaseId" TEXT NOT NULL, "sourceVersionId" TEXT NOT NULL, "createdById" TEXT NOT NULL, "ownerId" TEXT NOT NULL,
  "status" "ChangeProposalStatus" NOT NULL DEFAULT 'DRAFT', "context" TEXT NOT NULL, "decisionNote" TEXT, "submittedAt" TIMESTAMP(3), "decidedAt" TIMESTAMP(3), "appliedVersion" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChangeProposal_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ChangeProposalStep" (
  "id" TEXT NOT NULL, "changeProposalId" TEXT NOT NULL, "sourceStepId" TEXT NOT NULL, "order" INTEGER NOT NULL, "proposedDescription" TEXT, "proposedExpectedOutcome" TEXT,
  CONSTRAINT "ChangeProposalStep_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Notification" ADD COLUMN "changeProposalId" TEXT;
CREATE UNIQUE INDEX "ChangeProposal_runId_key" ON "ChangeProposal"("runId");
CREATE INDEX "ChangeProposal_ownerId_status_createdAt_idx" ON "ChangeProposal"("ownerId", "status", "createdAt");
CREATE INDEX "ChangeProposal_productId_status_createdAt_idx" ON "ChangeProposal"("productId", "status", "createdAt");
CREATE UNIQUE INDEX "ChangeProposalStep_changeProposalId_sourceStepId_key" ON "ChangeProposalStep"("changeProposalId", "sourceStepId");
CREATE INDEX "ChangeProposalStep_sourceStepId_idx" ON "ChangeProposalStep"("sourceStepId");
CREATE UNIQUE INDEX "Notification_recipientId_changeProposalId_type_key" ON "Notification"("recipientId", "changeProposalId", "type");
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "TestCaseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChangeProposalStep" ADD CONSTRAINT "ChangeProposalStep_changeProposalId_fkey" FOREIGN KEY ("changeProposalId") REFERENCES "ChangeProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeProposalStep" ADD CONSTRAINT "ChangeProposalStep_sourceStepId_fkey" FOREIGN KEY ("sourceStepId") REFERENCES "TestStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_changeProposalId_fkey" FOREIGN KEY ("changeProposalId") REFERENCES "ChangeProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
