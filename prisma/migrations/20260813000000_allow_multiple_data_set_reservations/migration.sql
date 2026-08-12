-- A Run may bind several variable fields from different Test Data Sets.
-- A conditional SAFE -> RESERVED update still ensures that any individual
-- data set can belong to only one active Run at a time.
DROP INDEX "TestDataSet_reservedByRunId_key";

CREATE INDEX "TestDataSet_reservedByRunId_idx"
  ON "TestDataSet"("reservedByRunId");
