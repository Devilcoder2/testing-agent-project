CREATE TYPE "ProductDeletionStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "ProductDeletionRequest" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "organizationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "status" "ProductDeletionStatus" NOT NULL DEFAULT 'QUEUED',
    "impact" JSONB NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "failureCode" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductDeletionRequest_productId_key" ON "ProductDeletionRequest"("productId");
CREATE INDEX "ProductDeletionRequest_organizationId_status_createdAt_idx" ON "ProductDeletionRequest"("organizationId", "status", "createdAt");
CREATE INDEX "ProductDeletionRequest_requestedById_createdAt_idx" ON "ProductDeletionRequest"("requestedById", "createdAt");

ALTER TABLE "ProductDeletionRequest" ADD CONSTRAINT "ProductDeletionRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductDeletionRequest" ADD CONSTRAINT "ProductDeletionRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductDeletionRequest" ADD CONSTRAINT "ProductDeletionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
