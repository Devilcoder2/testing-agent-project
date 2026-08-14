CREATE TYPE "TestDataReusePolicy" AS ENUM ('REUSABLE', 'SINGLE_USE');

ALTER TABLE "TestDataSet"
  ADD COLUMN "reusePolicy" "TestDataReusePolicy" NOT NULL DEFAULT 'REUSABLE';

UPDATE "TestDataSet"
SET "status" = 'SAFE',
    "reservedByRunId" = NULL,
    "reusePolicy" = 'REUSABLE'
WHERE "status" = 'CONSUMED';
