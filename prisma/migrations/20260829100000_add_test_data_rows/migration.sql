CREATE TABLE "TestDataRow" (
  "id" TEXT NOT NULL,
  "dataSetId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "encryptedFields" TEXT NOT NULL,
  "status" "TestDataStatus" NOT NULL DEFAULT 'SAFE',
  "reservedByRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TestDataRow_pkey" PRIMARY KEY ("id")
);

INSERT INTO "TestDataRow" (
  "id",
  "dataSetId",
  "order",
  "encryptedFields",
  "status",
  "reservedByRunId",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy_' || "id",
  "id",
  1,
  "encryptedFields",
  "status",
  "reservedByRunId",
  "createdAt",
  "updatedAt"
FROM "TestDataSet";

ALTER TABLE "RunVariableBinding"
  ADD COLUMN "dataSetRowId" TEXT;

UPDATE "RunVariableBinding"
SET "dataSetRowId" = 'legacy_' || "dataSetId"
WHERE "dataSetId" IS NOT NULL;

CREATE UNIQUE INDEX "TestDataRow_dataSetId_order_key"
  ON "TestDataRow"("dataSetId", "order");

CREATE INDEX "TestDataRow_dataSetId_status_order_idx"
  ON "TestDataRow"("dataSetId", "status", "order");

CREATE INDEX "TestDataRow_reservedByRunId_idx"
  ON "TestDataRow"("reservedByRunId");

CREATE INDEX "RunVariableBinding_dataSetRowId_idx"
  ON "RunVariableBinding"("dataSetRowId");

ALTER TABLE "TestDataRow"
  ADD CONSTRAINT "TestDataRow_dataSetId_fkey"
  FOREIGN KEY ("dataSetId") REFERENCES "TestDataSet"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TestDataRow"
  ADD CONSTRAINT "TestDataRow_reservedByRunId_fkey"
  FOREIGN KEY ("reservedByRunId") REFERENCES "Run"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RunVariableBinding"
  ADD CONSTRAINT "RunVariableBinding_dataSetRowId_fkey"
  FOREIGN KEY ("dataSetRowId") REFERENCES "TestDataRow"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TestDataSet"
  DROP CONSTRAINT "TestDataSet_reservedByRunId_fkey";

DROP INDEX "TestDataSet_productId_status_idx";
DROP INDEX "TestDataSet_reservedByRunId_idx";

ALTER TABLE "TestDataSet"
  DROP COLUMN "encryptedFields",
  DROP COLUMN "status",
  DROP COLUMN "reservedByRunId";

CREATE INDEX "TestDataSet_productId_createdAt_idx"
  ON "TestDataSet"("productId", "createdAt");
