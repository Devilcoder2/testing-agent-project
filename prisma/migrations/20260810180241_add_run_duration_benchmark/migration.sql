-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "activeDurationMs" INTEGER,
ADD COLUMN     "benchmarkMedianMs" INTEGER,
ADD COLUMN     "durationDeltaMs" INTEGER;
