CREATE TYPE "GitHubInstallationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');
CREATE TYPE "GitHubRepositoryConnectionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISCONNECTED');
CREATE TYPE "GitHubDeliveryStatus" AS ENUM ('RECEIVED', 'QUEUED', 'PROCESSED', 'IGNORED', 'FAILED');
CREATE TYPE "GitHubDeliveryTargetStatus" AS ENUM ('QUEUED', 'PROCESSED', 'IGNORED', 'FAILED');
CREATE TYPE "SourceAnalysisTrigger" AS ENUM ('GITHUB_FAILURE', 'MANUAL_REQUEST');
CREATE TYPE "SourceAnalysisStatus" AS ENUM ('QUEUED', 'ANALYZING', 'COMPLETED', 'BLOCKED_SENSITIVE_CONTEXT', 'UNAVAILABLE', 'FAILED', 'EXPIRED');
CREATE TYPE "SourceAnalysisConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NONE');

ALTER TABLE "MaintenanceRun" ADD COLUMN "deletedSourceAnalysisCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "GitHubInstallation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "accountLogin" TEXT NOT NULL,
  "accountType" TEXT,
  "status" "GitHubInstallationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GitHubInstallation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GitHubInstallation_installationId_key" ON "GitHubInstallation"("installationId");
CREATE INDEX "GitHubInstallation_organizationId_status_idx" ON "GitHubInstallation"("organizationId", "status");
ALTER TABLE "GitHubInstallation" ADD CONSTRAINT "GitHubInstallation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProductRepositoryConnection" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "repositoryFullName" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "defaultBranch" TEXT NOT NULL,
  "branchAllowlist" TEXT[] NOT NULL,
  "status" "GitHubRepositoryConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "analysisEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductRepositoryConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductRepositoryConnection_productId_repositoryId_key" ON "ProductRepositoryConnection"("productId", "repositoryId");
CREATE INDEX "ProductRepositoryConnection_installationId_repositoryId_status_idx" ON "ProductRepositoryConnection"("installationId", "repositoryId", "status");
CREATE INDEX "ProductRepositoryConnection_productId_status_idx" ON "ProductRepositoryConnection"("productId", "status");
ALTER TABLE "ProductRepositoryConnection" ADD CONSTRAINT "ProductRepositoryConnection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductRepositoryConnection" ADD CONSTRAINT "ProductRepositoryConnection_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "GitHubInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TestCaseRepositoryLink" (
  "testCaseId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestCaseRepositoryLink_pkey" PRIMARY KEY ("testCaseId", "connectionId")
);
CREATE INDEX "TestCaseRepositoryLink_connectionId_idx" ON "TestCaseRepositoryLink"("connectionId");
ALTER TABLE "TestCaseRepositoryLink" ADD CONSTRAINT "TestCaseRepositoryLink_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestCaseRepositoryLink" ADD CONSTRAINT "TestCaseRepositoryLink_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProductRepositoryConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GitHubDelivery" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "installationNumber" TEXT,
  "repositoryId" TEXT,
  "repositoryFullName" TEXT,
  "ref" TEXT,
  "branch" TEXT,
  "beforeSha" TEXT,
  "afterSha" TEXT,
  "status" "GitHubDeliveryStatus" NOT NULL DEFAULT 'RECEIVED',
  "safeError" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GitHubDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GitHubDelivery_deliveryId_key" ON "GitHubDelivery"("deliveryId");
CREATE INDEX "GitHubDelivery_repositoryId_branch_receivedAt_idx" ON "GitHubDelivery"("repositoryId", "branch", "receivedAt");
CREATE INDEX "GitHubDelivery_installationNumber_receivedAt_idx" ON "GitHubDelivery"("installationNumber", "receivedAt");

CREATE TABLE "GitHubDeliveryTarget" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "status" "GitHubDeliveryTargetStatus" NOT NULL DEFAULT 'QUEUED',
  "decisionReason" TEXT,
  "queuedRunCount" INTEGER NOT NULL DEFAULT 0,
  "excludedTests" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GitHubDeliveryTarget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GitHubDeliveryTarget_deliveryId_connectionId_key" ON "GitHubDeliveryTarget"("deliveryId", "connectionId");
CREATE INDEX "GitHubDeliveryTarget_connectionId_createdAt_idx" ON "GitHubDeliveryTarget"("connectionId", "createdAt");
ALTER TABLE "GitHubDeliveryTarget" ADD CONSTRAINT "GitHubDeliveryTarget_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "GitHubDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitHubDeliveryTarget" ADD CONSTRAINT "GitHubDeliveryTarget_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProductRepositoryConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GitHubRunLink" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "deliveryTargetId" TEXT,
  "repositoryFullName" TEXT NOT NULL,
  "branch" TEXT NOT NULL,
  "commitSha" TEXT NOT NULL,
  "parentSha" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GitHubRunLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GitHubRunLink_runId_key" ON "GitHubRunLink"("runId");
CREATE INDEX "GitHubRunLink_connectionId_commitSha_idx" ON "GitHubRunLink"("connectionId", "commitSha");
CREATE INDEX "GitHubRunLink_deliveryTargetId_idx" ON "GitHubRunLink"("deliveryTargetId");
ALTER TABLE "GitHubRunLink" ADD CONSTRAINT "GitHubRunLink_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitHubRunLink" ADD CONSTRAINT "GitHubRunLink_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProductRepositoryConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitHubRunLink" ADD CONSTRAINT "GitHubRunLink_deliveryTargetId_fkey" FOREIGN KEY ("deliveryTargetId") REFERENCES "GitHubDeliveryTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SourceAnalysis" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "requestedById" TEXT,
  "trigger" "SourceAnalysisTrigger" NOT NULL,
  "commitSha" TEXT NOT NULL,
  "parentSha" TEXT,
  "status" "SourceAnalysisStatus" NOT NULL DEFAULT 'QUEUED',
  "confidence" "SourceAnalysisConfidence" NOT NULL DEFAULT 'NONE',
  "provider" TEXT,
  "model" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "observations" JSONB,
  "hypotheses" JSONB,
  "likelyCause" TEXT,
  "remediation" TEXT,
  "suggestedPatch" TEXT,
  "sourceReferences" JSONB,
  "limitations" TEXT,
  "errorCode" TEXT,
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SourceAnalysis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SourceAnalysis_runId_connectionId_commitSha_key" ON "SourceAnalysis"("runId", "connectionId", "commitSha");
CREATE INDEX "SourceAnalysis_runId_createdAt_idx" ON "SourceAnalysis"("runId", "createdAt");
CREATE INDEX "SourceAnalysis_status_expiresAt_idx" ON "SourceAnalysis"("status", "expiresAt");
ALTER TABLE "SourceAnalysis" ADD CONSTRAINT "SourceAnalysis_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceAnalysis" ADD CONSTRAINT "SourceAnalysis_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProductRepositoryConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceAnalysis" ADD CONSTRAINT "SourceAnalysis_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
