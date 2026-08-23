import { NotificationType, OrganizationRole, RunOutcome } from "@prisma/client";
import { prisma } from "./prisma";

export type CompletedRun = {
  id: string;
  productId: string;
  testCaseId: string;
  completedAt: Date;
  outcome: RunOutcome;
  testCase: { id: string; name: string; currentVersion: number };
  testCaseVersion: { version: number };
};

export type SavedTestCase = { id: string; productId: string; createdAt: Date };

export function dashboardWindow(now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
  const previousStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 59));
  return { previousStart, start, end };
}

function inWindow(value: Date, start: Date, end: Date) {
  return value >= start && value < end;
}

function dateBucket(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function deriveProductHealth(productId: string, testCases: SavedTestCase[], runs: CompletedRun[], now = new Date()) {
  const productTests = testCases.filter((testCase) => testCase.productId === productId);
  const productRuns = runs.filter((run) => run.productId === productId);
  return deriveHealth(productTests, productRuns, now);
}

export function deriveAccessibleProductsHealth(testCases: SavedTestCase[], runs: CompletedRun[], now = new Date()) {
  return deriveHealth(testCases, runs, now);
}

function deriveHealth(testCases: SavedTestCase[], runs: CompletedRun[], now = new Date()) {
  const { previousStart, start, end } = dashboardWindow(now);
  const recentRuns = runs.filter((run) => inWindow(run.completedAt, start, end));
  const passedRuns = recentRuns.filter((run) => run.outcome === RunOutcome.PASSED);
  const failedRuns = recentRuns.filter((run) => run.outcome === RunOutcome.FAILED);
  const comparedRuns = passedRuns.length + failedRuns.length;
  const latestCompletedRun = [...runs].sort((left, right) => right.completedAt.getTime() - left.completedAt.getTime())[0] ?? null;
  const flaky = new Map<string, { testCase: { id: string; name: string }; passed: boolean; failed: boolean }>();
  for (const run of recentRuns) {
    if (run.testCase.currentVersion !== run.testCaseVersion.version) continue;
    const key = `${run.testCaseId}:${run.testCaseVersion.version}`;
    const item = flaky.get(key) ?? { testCase: { id: run.testCase.id, name: run.testCase.name }, passed: false, failed: false };
    if (run.outcome === RunOutcome.PASSED) item.passed = true;
    if (run.outcome === RunOutcome.FAILED) item.failed = true;
    flaky.set(key, item);
  }
  const coverageCurrent = testCases.filter((testCase) => inWindow(testCase.createdAt, start, end)).length;
  const coveragePrevious = testCases.filter((testCase) => inWindow(testCase.createdAt, previousStart, start)).length;

  return {
    totalSavedTestCases: testCases.length,
    completedRuns: recentRuns.length,
    passRate: comparedRuns ? passedRuns.length / comparedRuns : null,
    failedRuns: failedRuns.length,
    flakyTestCases: [...flaky.values()].filter((item) => item.passed && item.failed).map((item) => item.testCase),
    coverage: { current: coverageCurrent, previous: coveragePrevious, change: coverageCurrent - coveragePrevious },
    latestCompletedRun: latestCompletedRun ? { id: latestCompletedRun.id, outcome: latestCompletedRun.outcome, completedAt: latestCompletedRun.completedAt, testCase: { id: latestCompletedRun.testCase.id, name: latestCompletedRun.testCase.name } } : null
  };
}

export function dailyRunTrend(productId: string | undefined, runs: CompletedRun[], now = new Date()) {
  const { start, end } = dashboardWindow(now);
  const buckets = new Map<string, { date: string; passed: number; failed: number }>();
  for (let index = 0; index < 30; index += 1) {
    const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
    const key = dateBucket(date);
    buckets.set(key, { date: key, passed: 0, failed: 0 });
  }
  for (const run of runs) {
    if ((productId && run.productId !== productId) || !inWindow(run.completedAt, start, end)) continue;
    if (run.outcome !== RunOutcome.PASSED && run.outcome !== RunOutcome.FAILED) continue;
    const bucket = buckets.get(dateBucket(run.completedAt));
    if (!bucket) continue;
    if (run.outcome === RunOutcome.PASSED) bucket.passed += 1;
    if (run.outcome === RunOutcome.FAILED) bucket.failed += 1;
  }
  return [...buckets.values()];
}

export async function dashboardForUser(userId: string, selectedProductId?: string, now = new Date(), organizationId?: string, role?: OrganizationRole) {
  const membership = organizationId && role ? { organizationId, role } : await prisma.organizationMember.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  if (!membership) return { window: dashboardWindow(now), products: [], overview: [], selected: null, needsAttention: [] };
  const products = await prisma.product.findMany({
    where: { organizationId: membership.organizationId, ...(membership.role === OrganizationRole.ADMIN ? {} : { memberships: { some: { userId } } }) },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
  if (selectedProductId && !products.some((product) => product.id === selectedProductId)) throw new Error("FORBIDDEN");
  const productIds = products.map((product) => product.id);
  const testCases = await prisma.testCase.findMany({ where: { productId: { in: productIds } }, select: { id: true, productId: true, createdAt: true } });
  const runs = await prisma.run.findMany({
    where: { productId: { in: productIds }, outcome: { not: null }, completedAt: { not: null } },
    select: {
      id: true,
      productId: true,
      testCaseId: true,
      completedAt: true,
      outcome: true,
      testCase: { select: { id: true, name: true, currentVersion: true } },
      testCaseVersion: { select: { version: true } }
    }
  }) as CompletedRun[];
  const overview = products.map((product) => ({ product, ...deriveProductHealth(product.id, testCases, runs, now) }));
  const selected = selectedProductId
    ? overview.find((item) => item.product.id === selectedProductId) ?? null
    : products.length
      ? { product: { id: "", name: "All accessible Products" }, ...deriveAccessibleProductsHealth(testCases, runs, now) }
      : null;
  const attention = await prisma.notification.findMany({
    where: { recipientId: userId, readAt: null, productId: { in: productIds }, type: { in: [NotificationType.RUN_FAILED, NotificationType.AUTO_RUN_CHECKPOINT] } },
    include: { product: { select: { name: true } }, run: { select: { id: true, testCase: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  return {
    window: dashboardWindow(now),
    products,
    overview,
    selected: selected ? { ...selected, trend: dailyRunTrend(selected.product.id || undefined, runs, now) } : null,
    needsAttention: attention
  };
}
