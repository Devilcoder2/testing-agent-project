import { MaintenanceKind, MaintenanceStatus, RunStatus } from "@prisma/client";
import { deleteEvidenceObject } from "./evidence";
import { prisma } from "./prisma";

export function evidenceRetentionDays() {
  const configured = Number.parseInt(process.env.EVIDENCE_RETENTION_DAYS ?? "30", 10);
  return Number.isFinite(configured) && configured >= 1 ? configured : 30;
}

export function evidenceRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - evidenceRetentionDays() * 24 * 60 * 60 * 1000);
}

export async function runEvidenceRetention(now = new Date()) {
  const maintenance = await prisma.maintenanceRun.create({ data: { kind: MaintenanceKind.EVIDENCE_RETENTION } });
  try {
    const cutoff = evidenceRetentionCutoff(now);
    const expired = await prisma.evidenceItem.findMany({
      where: { capturedAt: { lt: cutoff }, run: { status: RunStatus.COMPLETED } },
      select: { id: true, objectKey: true }
    });
    const removableIds: string[] = [];
    let deletedScreenshotCount = 0;
    let objectFailure = false;
    for (const evidence of expired) {
      try {
        if (evidence.objectKey) {
          await deleteEvidenceObject(evidence.objectKey);
          deletedScreenshotCount += 1;
        }
        removableIds.push(evidence.id);
      } catch {
        objectFailure = true;
      }
    }
    const [removedEvidence, removedDiagnostics] = await prisma.$transaction([
      prisma.evidenceItem.deleteMany({ where: { id: { in: removableIds } } }),
      prisma.databaseDiagnostic.deleteMany({ where: { completedAt: { lt: cutoff }, run: { status: RunStatus.COMPLETED } } })
    ]);
    return prisma.maintenanceRun.update({
      where: { id: maintenance.id },
      data: {
        status: objectFailure ? MaintenanceStatus.PARTIAL : MaintenanceStatus.COMPLETED,
        deletedEvidenceCount: removedEvidence.count,
        deletedScreenshotCount,
        deletedDiagnosticCount: removedDiagnostics.count,
        errorCode: objectFailure ? "EVIDENCE_OBJECT_DELETE_FAILED" : null,
        completedAt: new Date()
      }
    });
  } catch {
    return prisma.maintenanceRun.update({
      where: { id: maintenance.id },
      data: { status: MaintenanceStatus.PARTIAL, errorCode: "EVIDENCE_RETENTION_FAILED", completedAt: new Date() }
    });
  }
}

export async function latestEvidenceRetentionRun() {
  return prisma.maintenanceRun.findFirst({ where: { kind: MaintenanceKind.EVIDENCE_RETENTION }, orderBy: { startedAt: "desc" } });
}
