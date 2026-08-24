import { NotificationType, OrganizationRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const searchSections = ["products", "test-cases", "test-data", "runs", "releases", "review", "notifications", "admin"] as const;
export type SearchSection = typeof searchSections[number];

export type SearchResult = {
  id: string;
  section: SearchSection;
  title: string;
  context: string;
  href: string;
};

export type SearchGroup = {
  section: SearchSection;
  label: string;
  results: SearchResult[];
};

export type SearchResponse = {
  query: string;
  groups: SearchGroup[];
  total: number;
};

type SearchUser = { id: string; organizationId: string; role: OrganizationRole };

const resultLimit = 5;
const labels: Record<SearchSection, string> = {
  products: "Products",
  "test-cases": "Test Cases",
  "test-data": "Test Data",
  runs: "Runs",
  releases: "Releases",
  review: "Review",
  notifications: "Notifications",
  admin: "Administration"
};

export function normalizeSearchQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function isSearchSection(value: string | null): value is SearchSection {
  return searchSections.includes(value as SearchSection);
}

export function orderedSearchSections(currentSection?: SearchSection | null) {
  return currentSection ? [currentSection, ...searchSections.filter((section) => section !== currentSection)] : [...searchSections];
}

function prefix(query: string): Prisma.StringFilter {
  return { startsWith: query, mode: "insensitive" };
}

function productScope(user: SearchUser): Prisma.ProductWhereInput {
  return {
    organizationId: user.organizationId,
    ...(user.role === OrganizationRole.ADMIN ? {} : { memberships: { some: { userId: user.id } } })
  };
}

function releaseScope(user: SearchUser): Prisma.ReleaseWhereInput {
  const accessibleProduct: Prisma.ProductWhereInput = productScope(user);
  return {
    tests: {
      some: { testCase: { product: accessibleProduct } },
      every: { testCase: { product: accessibleProduct } }
    }
  };
}

function notificationSubject(notification: {
  product: { name: string } | null;
  run: { testCase: { name: string } } | null;
  releaseRun: { release: { name: string } } | null;
  changeProposal: { testCase: { name: string } } | null;
}) {
  return notification.run?.testCase.name ?? notification.releaseRun?.release.name ?? notification.changeProposal?.testCase.name ?? notification.product?.name ?? "Sentinel update";
}

function notificationContext(type: NotificationType) {
  if (type === NotificationType.RUN_FAILED) return "Notification · Run failed";
  if (type === NotificationType.AUTO_RUN_CHECKPOINT) return "Notification · Checkpoint review";
  if (type === NotificationType.RELEASE_RUN_COMPLETED) return "Notification · Release completed";
  if (type === NotificationType.CHANGE_PROPOSAL_REQUESTED) return "Notification · Change review requested";
  return "Notification · Change proposal updated";
}

export async function searchWorkspace(user: SearchUser, rawQuery: string, currentSection?: SearchSection | null): Promise<SearchResponse> {
  const query = normalizeSearchQuery(rawQuery);
  if (!query) return { query, groups: [], total: 0 };

  const accessibleProduct = productScope(user);
  const accessibleRelease = releaseScope(user);
  const name = prefix(query);
  const [products, testCases, dataSets, runs, releases, suggestions, proposals, notifications, members] = await Promise.all([
    prisma.product.findMany({ where: { ...accessibleProduct, name }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: resultLimit }),
    prisma.testCase.findMany({ where: { name, product: accessibleProduct }, select: { id: true, name: true, product: { select: { name: true } } }, orderBy: { name: "asc" }, take: resultLimit }),
    prisma.testDataSet.findMany({ where: { name, product: accessibleProduct }, select: { id: true, name: true, status: true, product: { select: { id: true, name: true } } }, orderBy: { name: "asc" }, take: resultLimit }),
    prisma.run.findMany({ where: { testCase: { name }, product: accessibleProduct }, select: { id: true, mode: true, status: true, outcome: true, testCase: { select: { name: true } }, product: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: resultLimit }),
    prisma.release.findMany({ where: { ...accessibleRelease, name }, select: { id: true, name: true, tests: { select: { testCase: { select: { product: { select: { name: true } } } } } } }, orderBy: { updatedAt: "desc" }, take: resultLimit }),
    prisma.testSuggestion.findMany({ where: { title: name, product: accessibleProduct }, select: { id: true, title: true, status: true, sourceTestCaseId: true, product: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: resultLimit }),
    prisma.changeProposal.findMany({ where: { testCase: { name }, product: accessibleProduct }, select: { id: true, status: true, testCase: { select: { name: true } }, product: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: resultLimit }),
    prisma.notification.findMany({
      where: {
        recipientId: user.id,
        OR: [
          { product: { is: { ...accessibleProduct, name } } },
          { run: { is: { product: accessibleProduct, testCase: { name } } } },
          { releaseRun: { is: { release: { ...accessibleRelease, name } } } },
          { changeProposal: { is: { product: accessibleProduct, testCase: { name } } } }
        ]
      },
      select: {
        id: true,
        type: true,
        readAt: true,
        product: { select: { name: true } },
        run: { select: { id: true, testCase: { select: { name: true } } } },
        releaseRun: { select: { release: { select: { id: true, name: true } } } },
        changeProposal: { select: { id: true, testCase: { select: { name: true } } } }
      },
      orderBy: { createdAt: "desc" },
      take: resultLimit
    }),
    user.role === OrganizationRole.ADMIN ? prisma.organizationMember.findMany({
      where: { organizationId: user.organizationId, OR: [{ user: { displayName: name } }, { user: { email: name } }] },
      select: { role: true, user: { select: { id: true, displayName: true, email: true, accountStatus: true } } },
      orderBy: { user: { displayName: "asc" } },
      take: resultLimit
    }) : Promise.resolve([])
  ]);

  const reviewResults: SearchResult[] = [
    ...suggestions.map((suggestion) => ({ id: suggestion.id, section: "review" as const, title: suggestion.title, context: `${suggestion.product.name} · Suggestion · ${suggestion.status.toLowerCase()}`, href: `/review?queue=suggestions&focus=${suggestion.id}` })),
    ...proposals.map((proposal) => ({ id: proposal.id, section: "review" as const, title: proposal.testCase.name, context: `${proposal.product.name} · Change proposal · ${proposal.status.toLowerCase()}`, href: `/review?queue=changes&focus=${proposal.id}` }))
  ].sort((left, right) => left.title.localeCompare(right.title)).slice(0, resultLimit);

  const bySection: Record<SearchSection, SearchResult[]> = {
    products: products.map((product) => ({ id: product.id, section: "products", title: product.name, context: "Product", href: `/products?focus=${product.id}` })),
    "test-cases": testCases.map((testCase) => ({ id: testCase.id, section: "test-cases", title: testCase.name, context: `${testCase.product.name} · Test Case`, href: `/test-cases/${testCase.id}` })),
    "test-data": dataSets.map((dataSet) => ({ id: dataSet.id, section: "test-data", title: dataSet.name, context: `${dataSet.product.name} · Test Data · ${dataSet.status.toLowerCase()}`, href: `/test-data?productId=${dataSet.product.id}&focus=${dataSet.id}` })),
    runs: runs.map((run) => ({ id: run.id, section: "runs", title: run.testCase.name, context: `${run.product.name} · ${run.mode === "AUTO" ? "Auto" : "Guided"} Run · ${(run.outcome ?? run.status).toLowerCase()}`, href: `/runs/${run.id}` })),
    releases: releases.map((release) => ({ id: release.id, section: "releases", title: release.name, context: `${new Set(release.tests.map((item) => item.testCase.product.name)).size} Product${new Set(release.tests.map((item) => item.testCase.product.name)).size === 1 ? "" : "s"} · Release`, href: `/releases/${release.id}` })),
    review: reviewResults,
    notifications: notifications.map((notification) => ({
      id: notification.id,
      section: "notifications",
      title: notificationSubject(notification),
      context: `${notificationContext(notification.type)}${notification.readAt ? " · read" : " · unread"}`,
      href: notification.run ? `/runs/${notification.run.id}` : notification.releaseRun ? `/releases/${notification.releaseRun.release.id}` : notification.changeProposal ? `/review?queue=changes&focus=${notification.changeProposal.id}` : `/notifications?focus=${notification.id}`
    })),
    admin: members.map((member) => ({ id: member.user.id, section: "admin", title: member.user.displayName, context: `${member.user.email} · ${member.role.toLowerCase()} · ${member.user.accountStatus.toLowerCase()}`, href: `/admin?focus=${member.user.id}` }))
  };

  const groups = orderedSearchSections(currentSection)
    .map((section) => ({ section, label: labels[section], results: bySection[section] }))
    .filter((group) => group.results.length > 0);

  return { query, groups, total: groups.reduce((count, group) => count + group.results.length, 0) };
}
