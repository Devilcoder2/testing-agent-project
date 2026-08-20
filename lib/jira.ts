import { JiraFilingAction, JiraFilingStatus, RunFailureReason } from "@prisma/client";
import { safeFailureReason } from "./notifications";
import { prisma } from "./prisma";

const PRIORITIES = ["Lowest", "Low", "Medium", "High", "Highest"] as const;
export type JiraPriority = typeof PRIORITIES[number];

export class JiraAdapterError extends Error {
  constructor(message: string, readonly transient = false) {
    super(message);
  }
}

type DraftRun = {
  id: string;
  failureReason: RunFailureReason | null;
  product: { name: string };
  testCase: { name: string };
  testCaseVersion: { version: number; steps: Array<{ order: number; kind: string }> };
};

type JiraIssueState = { key: string; url: string; isOpen: boolean; statusCategory: string | null };

function configuredValues() {
  const baseUrl = process.env.JIRA_CLOUD_URL?.trim().replace(/\/$/, "");
  const email = process.env.JIRA_SERVICE_EMAIL?.trim();
  const token = process.env.JIRA_API_TOKEN?.trim();
  if (!baseUrl || !email || !token || /your-site\.atlassian\.net|replace-with/i.test(`${baseUrl} ${email} ${token}`)) {
    throw new JiraAdapterError("Jira Cloud is not configured for this Sentinel deployment.");
  }
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".atlassian.net")) throw new Error();
  } catch {
    throw new JiraAdapterError("Jira Cloud URL must be an HTTPS Atlassian Cloud URL.");
  }
  return { baseUrl, email, token };
}

export function jiraCloudIsConfigured() {
  try {
    configuredValues();
    return true;
  } catch {
    return false;
  }
}

export function normalizeJiraProjectKey(value: string) {
  const key = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{1,49}$/.test(key)) throw new JiraAdapterError("Jira project key must use 2–50 uppercase letters, numbers, or underscores.");
  return key;
}

export function isAllowedJiraPriority(value: string): value is JiraPriority {
  return (PRIORITIES as readonly string[]).includes(value);
}

function appUrl(path: string) {
  return new URL(path, process.env.SENTINEL_APP_URL ?? "http://localhost:3001").toString();
}

function safeLine(value: string, maximum = 240) {
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, maximum);
}

export function buildJiraDraft(run: DraftRun) {
  const steps = run.testCaseVersion.steps
    .sort((left, right) => left.order - right.order)
    .map((step) => `${step.order}. Complete the recorded ${step.kind.toLowerCase().replace("_", " ")} action.`)
    .join("\n");
  const summary = safeLine(`[Sentinel] ${run.testCase.name} failed`);
  const description = [
    "Sentinel detected a failed QA Run that requires review.",
    `Product: ${safeLine(run.product.name)}`,
    `Test Case: ${safeLine(run.testCase.name)}`,
    `Version: ${run.testCaseVersion.version}`,
    `Reason: ${safeFailureReason(run.failureReason)}`,
    "",
    "Reproduction:",
    steps || "No recorded steps are available.",
    "",
    `Open the protected Sentinel Run Detail: ${appUrl(`/runs/${run.id}`)}`,
    "",
    "Evidence remains private in Sentinel. This Jira issue contains no screenshots, raw logs, variables, credentials, or direct evidence URLs."
  ].join("\n");
  return { summary, description, priority: "Medium" as JiraPriority };
}

export async function buildJiraDraftWithDiagnostic(run: DraftRun) {
  const draft = buildJiraDraft(run);
  const diagnostic = await prisma.databaseDiagnostic.findFirst({ where: { runId: run.id, kind: "CUSTOMER_LOOKUP_BY_EMAIL", status: "COMPLETE" }, orderBy: { completedAt: "desc" } });
  const metadata = diagnostic?.safeMetadata && typeof diagnostic.safeMetadata === "object" && !Array.isArray(diagnostic.safeMetadata) ? diagnostic.safeMetadata as Record<string, unknown> : null;
  if (!metadata || (metadata.result !== "FOUND" && metadata.result !== "NOT_FOUND")) return draft;
  const lines = ["", "QA database insight (safe summary):", `Customer lookup: ${metadata.result === "FOUND" ? "Found" : "Not found"}`];
  if (metadata.result === "FOUND") {
    if (typeof metadata.customerStatus === "string") lines.push(`Customer status: ${safeLine(metadata.customerStatus, 80)}`);
    if (typeof metadata.updatedAt === "string") lines.push(`Customer last updated: ${safeLine(metadata.updatedAt, 80)}`);
  }
  return { ...draft, description: `${draft.description}\n${lines.join("\n")}` };
}

function adf(text: string) {
  return {
    type: "doc",
    version: 1,
    content: text.split("\n").map((line) => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] }))
  };
}

async function jiraRequest(path: string, init?: RequestInit) {
  const { baseUrl, email, token } = configuredValues();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/rest/api/3${path}`, {
      ...init,
      headers: {
        authorization: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers
      }
    });
  } catch {
    throw new JiraAdapterError("Jira Cloud could not be reached.", true);
  }
  if (!response.ok) {
    const transient = response.status === 429 || response.status >= 500;
    throw new JiraAdapterError(`Jira Cloud rejected the request (${response.status}).`, transient);
  }
  return { response, baseUrl };
}

export async function validateJiraProject(projectKey: string) {
  const normalized = normalizeJiraProjectKey(projectKey);
  await jiraRequest(`/project/${encodeURIComponent(normalized)}`);
  return normalized;
}

async function readJiraIssue(key: string): Promise<JiraIssueState> {
  const { response, baseUrl } = await jiraRequest(`/issue/${encodeURIComponent(key)}?fields=status`);
  const data = await response.json() as { key?: string; fields?: { status?: { statusCategory?: { key?: string } } } };
  const statusCategory = data.fields?.status?.statusCategory?.key?.toLowerCase() ?? null;
  return { key: data.key ?? key, url: `${baseUrl}/browse/${data.key ?? key}`, isOpen: statusCategory !== "done", statusCategory };
}

async function createJiraBug(input: { projectKey: string; summary: string; description: string; priority: JiraPriority }) {
  const { response, baseUrl } = await jiraRequest("/issue", {
    method: "POST",
    body: JSON.stringify({ fields: { project: { key: input.projectKey }, issuetype: { name: "Bug" }, summary: input.summary, description: adf(input.description), priority: { name: input.priority } } })
  });
  const data = await response.json() as { key: string };
  return { key: data.key, url: `${baseUrl}/browse/${data.key}` };
}

async function addJiraComment(key: string, description: string) {
  await jiraRequest(`/issue/${encodeURIComponent(key)}/comment`, { method: "POST", body: JSON.stringify({ body: adf(description) }) });
}

function safeError(error: unknown) {
  return error instanceof JiraAdapterError ? error.message : "Jira filing failed unexpectedly.";
}

function isTransient(error: unknown) {
  return error instanceof JiraAdapterError && error.transient;
}

export async function deliverJiraFiling(filingId: string, attemptNumber: number) {
  const filing = await prisma.jiraFiling.findUnique({
    where: { id: filingId },
    include: {
      run: {
        include: {
          product: true,
          testCase: true,
          testCaseVersion: { include: { steps: { select: { order: true, kind: true } } } }
        }
      }
    }
  });
  if (!filing || filing.status === JiraFilingStatus.FILED) return;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${filing.run.testCaseId}))`;
      const current = await tx.jiraFiling.findUniqueOrThrow({
        where: { id: filingId },
        include: {
          run: {
            include: {
              product: true,
              testCase: true,
              testCaseVersion: { include: { steps: { select: { order: true, kind: true } } } }
            }
          }
        }
      });
      if (current.status === JiraFilingStatus.FILED) return;
      const config = await tx.jiraProjectConfig.findUnique({ where: { productId: current.productId } });
      if (!config) throw new JiraAdapterError("This Product does not have a Jira project mapping.");
      const linked = await tx.jiraIssue.findFirst({ where: { testCaseId: current.run.testCaseId, isOpen: true }, orderBy: { createdAt: "desc" } });
      let jiraIssueId: string;
      let action: JiraFilingAction;
      if (linked) {
        const remote = await readJiraIssue(linked.jiraKey);
        if (remote.isOpen) {
          await addJiraComment(remote.key, current.description);
          jiraIssueId = linked.id;
          action = JiraFilingAction.COMMENT;
          await tx.jiraIssue.update({ where: { id: linked.id }, data: { jiraUrl: remote.url, statusCategory: remote.statusCategory, isOpen: true } });
        } else {
          await tx.jiraIssue.update({ where: { id: linked.id }, data: { isOpen: false, statusCategory: remote.statusCategory } });
          const created = await createJiraBug({ projectKey: config.projectKey, summary: current.summary, description: current.description, priority: current.priority as JiraPriority });
          const issue = await tx.jiraIssue.create({ data: { productId: current.productId, testCaseId: current.run.testCaseId, jiraKey: created.key, jiraUrl: created.url, isOpen: true } });
          jiraIssueId = issue.id;
          action = JiraFilingAction.CREATE;
        }
      } else {
        const created = await createJiraBug({ projectKey: config.projectKey, summary: current.summary, description: current.description, priority: current.priority as JiraPriority });
        const issue = await tx.jiraIssue.create({ data: { productId: current.productId, testCaseId: current.run.testCaseId, jiraKey: created.key, jiraUrl: created.url, isOpen: true } });
        jiraIssueId = issue.id;
        action = JiraFilingAction.CREATE;
      }
      await tx.jiraFiling.update({ where: { id: filingId }, data: { status: JiraFilingStatus.FILED, action, jiraIssueId, deliveryError: null, filedAt: new Date(), attemptCount: attemptNumber } });
      await tx.auditEvent.create({ data: { actorId: current.requestedById, action: action === JiraFilingAction.CREATE ? "JIRA_BUG_CREATED" : "JIRA_BUG_UPDATED", entityType: "JiraFiling", entityId: current.id, details: { action } } });
    }, { timeout: 20_000 });
  } catch (error) {
    const finalFailure = !isTransient(error) || attemptNumber >= 2;
    await prisma.jiraFiling.update({ where: { id: filingId }, data: { status: finalFailure ? JiraFilingStatus.FAILED : JiraFilingStatus.QUEUED, attemptCount: attemptNumber, deliveryError: safeError(error) } }).catch(() => undefined);
    if (finalFailure) {
      const filingForAudit = await prisma.jiraFiling.findUnique({ where: { id: filingId }, select: { requestedById: true } });
      if (filingForAudit) await prisma.auditEvent.create({ data: { actorId: filingForAudit.requestedById, action: "JIRA_FILING_FAILED", entityType: "JiraFiling", entityId: filingId, details: { message: safeError(error) } } }).catch(() => undefined);
      return;
    }
    throw error;
  }
}

export function publicJiraFiling(filing: { id: string; status: JiraFilingStatus; action: JiraFilingAction | null; summary: string; description: string; priority: string; attemptCount: number; deliveryError: string | null; queuedAt: Date | null; filedAt: Date | null; jiraIssue: { jiraKey: string; jiraUrl: string; isOpen: boolean } | null }) {
  return { id: filing.id, status: filing.status, action: filing.action, summary: filing.summary, description: filing.description, priority: filing.priority, attemptCount: filing.attemptCount, deliveryError: filing.deliveryError, queuedAt: filing.queuedAt, filedAt: filing.filedAt, jiraIssue: filing.jiraIssue ? { key: filing.jiraIssue.jiraKey, url: filing.jiraIssue.jiraUrl, isOpen: filing.jiraIssue.isOpen } : null };
}

export const jiraPriorities = PRIORITIES;
