CREATE TYPE "ReleaseRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED');
CREATE TYPE "ReleaseReadiness" AS ENUM ('IN_PROGRESS', 'READY', 'NOT_READY');
CREATE TYPE "ReleaseRunItemStatus" AS ENUM ('QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'INTERRUPTED', 'EXCLUDED');
CREATE TYPE "ReleaseRunItemReason" AS ENUM ('CHECKPOINT_REQUIRES_INDIVIDUAL_RUN', 'VARIABLE_REQUIRES_STATIC_DEFAULT', 'AUTO_RUN_QUEUE_FAILED');

CREATE TABLE "FeatureLabel" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureLabel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TestCaseFeatureLabel" (
  "testCaseId" TEXT NOT NULL,
  "featureLabelId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestCaseFeatureLabel_pkey" PRIMARY KEY ("testCaseId", "featureLabelId")
);

CREATE TABLE "Release" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReleaseTest" (
  "releaseId" TEXT NOT NULL,
  "testCaseId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReleaseTest_pkey" PRIMARY KEY ("releaseId", "testCaseId")
);

CREATE TABLE "ReleaseRun" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "initiatedById" TEXT NOT NULL,
  "status" "ReleaseRunStatus" NOT NULL DEFAULT 'QUEUED',
  "readiness" "ReleaseReadiness" NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReleaseRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReleaseRunItem" (
  "id" TEXT NOT NULL,
  "releaseRunId" TEXT NOT NULL,
  "testCaseId" TEXT NOT NULL,
  "testCaseVersionId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "runId" TEXT,
  "status" "ReleaseRunItemStatus" NOT NULL DEFAULT 'QUEUED',
  "exclusionReason" "ReleaseRunItemReason",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReleaseRunItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureLabel_productId_name_key" ON "FeatureLabel"("productId", "name");
CREATE INDEX "FeatureLabel_productId_name_idx" ON "FeatureLabel"("productId", "name");
CREATE INDEX "TestCaseFeatureLabel_featureLabelId_idx" ON "TestCaseFeatureLabel"("featureLabelId");
CREATE INDEX "Release_ownerId_updatedAt_idx" ON "Release"("ownerId", "updatedAt");
CREATE INDEX "ReleaseTest_testCaseId_idx" ON "ReleaseTest"("testCaseId");
CREATE INDEX "ReleaseRun_releaseId_createdAt_idx" ON "ReleaseRun"("releaseId", "createdAt");
CREATE UNIQUE INDEX "ReleaseRunItem_runId_key" ON "ReleaseRunItem"("runId");
CREATE UNIQUE INDEX "ReleaseRunItem_releaseRunId_testCaseId_key" ON "ReleaseRunItem"("releaseRunId", "testCaseId");
CREATE INDEX "ReleaseRunItem_releaseRunId_status_idx" ON "ReleaseRunItem"("releaseRunId", "status");

ALTER TABLE "FeatureLabel" ADD CONSTRAINT "FeatureLabel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestCaseFeatureLabel" ADD CONSTRAINT "TestCaseFeatureLabel_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestCaseFeatureLabel" ADD CONSTRAINT "TestCaseFeatureLabel_featureLabelId_fkey" FOREIGN KEY ("featureLabelId") REFERENCES "FeatureLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Release" ADD CONSTRAINT "Release_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReleaseTest" ADD CONSTRAINT "ReleaseTest_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReleaseTest" ADD CONSTRAINT "ReleaseTest_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReleaseRun" ADD CONSTRAINT "ReleaseRun_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReleaseRun" ADD CONSTRAINT "ReleaseRun_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReleaseRunItem" ADD CONSTRAINT "ReleaseRunItem_releaseRunId_fkey" FOREIGN KEY ("releaseRunId") REFERENCES "ReleaseRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReleaseRunItem" ADD CONSTRAINT "ReleaseRunItem_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReleaseRunItem" ADD CONSTRAINT "ReleaseRunItem_testCaseVersionId_fkey" FOREIGN KEY ("testCaseVersionId") REFERENCES "TestCaseVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReleaseRunItem" ADD CONSTRAINT "ReleaseRunItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReleaseRunItem" ADD CONSTRAINT "ReleaseRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE SET NULL ON UPDATE CASCADE;
