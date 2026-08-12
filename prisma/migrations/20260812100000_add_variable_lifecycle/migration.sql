-- CreateEnum
CREATE TYPE "TestDataStatus" AS ENUM ('SAFE', 'RESERVED', 'CONSUMED', 'INVALID');

-- CreateEnum
CREATE TYPE "VariableSource" AS ENUM ('STATIC', 'POOL', 'MANUAL');

-- CreateTable
CREATE TABLE "RecordingVariable" (
    "id" TEXT NOT NULL,
    "recordingSessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordingVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestVariable" (
    "id" TEXT NOT NULL,
    "testCaseVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "staticValueEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestDataSet" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldNames" TEXT[] NOT NULL,
    "encryptedFields" TEXT NOT NULL,
    "status" "TestDataStatus" NOT NULL DEFAULT 'SAFE',
    "reservedByRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestDataSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunVariableBinding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "testVariableId" TEXT,
    "name" TEXT NOT NULL,
    "source" "VariableSource" NOT NULL,
    "valueEncrypted" TEXT NOT NULL,
    "dataSetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunVariableBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecordingVariable_recordingSessionId_name_key" ON "RecordingVariable"("recordingSessionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TestVariable_testCaseVersionId_name_key" ON "TestVariable"("testCaseVersionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TestDataSet_reservedByRunId_key" ON "TestDataSet"("reservedByRunId");

-- CreateIndex
CREATE UNIQUE INDEX "TestDataSet_productId_name_key" ON "TestDataSet"("productId", "name");

-- CreateIndex
CREATE INDEX "TestDataSet_productId_status_idx" ON "TestDataSet"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RunVariableBinding_runId_name_key" ON "RunVariableBinding"("runId", "name");

-- CreateIndex
CREATE INDEX "RunVariableBinding_dataSetId_idx" ON "RunVariableBinding"("dataSetId");

-- AddForeignKey
ALTER TABLE "RecordingVariable" ADD CONSTRAINT "RecordingVariable_recordingSessionId_fkey" FOREIGN KEY ("recordingSessionId") REFERENCES "RecordingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestVariable" ADD CONSTRAINT "TestVariable_testCaseVersionId_fkey" FOREIGN KEY ("testCaseVersionId") REFERENCES "TestCaseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDataSet" ADD CONSTRAINT "TestDataSet_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDataSet" ADD CONSTRAINT "TestDataSet_reservedByRunId_fkey" FOREIGN KEY ("reservedByRunId") REFERENCES "Run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunVariableBinding" ADD CONSTRAINT "RunVariableBinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunVariableBinding" ADD CONSTRAINT "RunVariableBinding_dataSetId_fkey" FOREIGN KEY ("dataSetId") REFERENCES "TestDataSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
