CREATE TYPE "JiraFilingStatus" AS ENUM ('DRAFT', 'QUEUED', 'FILED', 'FAILED');
CREATE TYPE "JiraFilingAction" AS ENUM ('CREATE', 'COMMENT');

CREATE TABLE "JiraProjectConfig" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "projectKey" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JiraProjectConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JiraIssue" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "jiraUrl" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "statusCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JiraIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JiraFiling" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "jiraIssueId" TEXT,
    "status" "JiraFilingStatus" NOT NULL DEFAULT 'DRAFT',
    "action" "JiraFilingAction",
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "deliveryError" TEXT,
    "queuedAt" TIMESTAMP(3),
    "filedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JiraFiling_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JiraProjectConfig_productId_key" ON "JiraProjectConfig"("productId");
CREATE UNIQUE INDEX "JiraIssue_jiraKey_key" ON "JiraIssue"("jiraKey");
CREATE INDEX "JiraIssue_testCaseId_isOpen_idx" ON "JiraIssue"("testCaseId", "isOpen");
CREATE INDEX "JiraIssue_productId_isOpen_idx" ON "JiraIssue"("productId", "isOpen");
CREATE UNIQUE INDEX "JiraFiling_runId_key" ON "JiraFiling"("runId");
CREATE INDEX "JiraFiling_productId_createdAt_idx" ON "JiraFiling"("productId", "createdAt");
CREATE INDEX "JiraFiling_jiraIssueId_createdAt_idx" ON "JiraFiling"("jiraIssueId", "createdAt");

ALTER TABLE "JiraProjectConfig" ADD CONSTRAINT "JiraProjectConfig_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JiraIssue" ADD CONSTRAINT "JiraIssue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JiraIssue" ADD CONSTRAINT "JiraIssue_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JiraFiling" ADD CONSTRAINT "JiraFiling_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JiraFiling" ADD CONSTRAINT "JiraFiling_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JiraFiling" ADD CONSTRAINT "JiraFiling_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JiraFiling" ADD CONSTRAINT "JiraFiling_jiraIssueId_fkey" FOREIGN KEY ("jiraIssueId") REFERENCES "JiraIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
