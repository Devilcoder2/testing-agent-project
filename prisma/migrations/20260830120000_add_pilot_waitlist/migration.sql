CREATE TYPE "PilotWaitlistLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'INVITED', 'ARCHIVED');

CREATE TYPE "PilotQaTeamSize" AS ENUM ('SOLO', 'TWO_TO_FIVE', 'SIX_TO_FIFTEEN', 'SIXTEEN_PLUS');

CREATE TABLE "PilotWaitlistLead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "qaTeamSize" "PilotQaTeamSize" NOT NULL,
    "status" "PilotWaitlistLeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotWaitlistLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PilotWaitlistLead_organizationId_email_key" ON "PilotWaitlistLead"("organizationId", "email");
CREATE INDEX "PilotWaitlistLead_organizationId_status_createdAt_idx" ON "PilotWaitlistLead"("organizationId", "status", "createdAt");

ALTER TABLE "PilotWaitlistLead" ADD CONSTRAINT "PilotWaitlistLead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
