import crypto from "node:crypto";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

type GitHubAppConfiguration = {
  appId: string;
  privateKey: string;
  webhookSecret: string;
  appSlug: string;
  publicWebhookUrl: string;
};

export type GitHubPushDelivery = {
  deliveryId: string;
  event: "push";
  installationId: string;
  repositoryId: string;
  repositoryFullName: string;
  ref: string;
  branch: string;
  beforeSha: string | null;
  afterSha: string;
};

export type GitHubRepositoryDetails = {
  installationId: string;
  installationAccountLogin: string;
  installationAccountType: string | null;
  repositoryId: string;
  repositoryFullName: string;
  defaultBranch: string;
};

export class GitHubIntegrationError extends Error {
  constructor(public readonly code: string, message: string, public readonly transient = false) {
    super(message);
  }
}

function configuredValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

function appConfiguration(): GitHubAppConfiguration | null {
  const appId = configuredValue("GITHUB_APP_ID");
  const privateKey = configuredValue("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n");
  const webhookSecret = configuredValue("GITHUB_WEBHOOK_SECRET");
  const appSlug = configuredValue("GITHUB_APP_SLUG");
  const publicWebhookUrl = configuredValue("SENTINEL_PUBLIC_WEBHOOK_URL");
  if (!appId || !privateKey || !webhookSecret || !appSlug || !publicWebhookUrl) return null;
  return { appId, privateKey, webhookSecret, appSlug, publicWebhookUrl };
}

export function githubIsConfigured() {
  return Boolean(appConfiguration());
}

export function githubPublicWebhookUrl() {
  return appConfiguration()?.publicWebhookUrl ?? null;
}

function appAuth() {
  const config = appConfiguration();
  if (!config) throw new GitHubIntegrationError("GITHUB_NOT_CONFIGURED", "GitHub App configuration is not available.");
  return { config, auth: createAppAuth({ appId: config.appId, privateKey: config.privateKey }) };
}

function splitRepository(fullName: string) {
  const normalized = fullName.trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");
  const [owner, repository, ...rest] = normalized.split("/");
  if (!owner || !repository || rest.length || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new GitHubIntegrationError("GITHUB_REPOSITORY_INVALID", "Enter a GitHub repository as owner/repository.");
  }
  return { owner, repository, fullName: `${owner}/${repository}` };
}

function installationNumber(installationId: string) {
  const number = Number(installationId);
  if (!Number.isSafeInteger(number) || number <= 0) throw new GitHubIntegrationError("GITHUB_INSTALLATION_INVALID", "The GitHub installation reference is invalid.");
  return number;
}

function appOctokit() {
  const { config } = appAuth();
  return new Octokit({ authStrategy: createAppAuth, auth: { appId: config.appId, privateKey: config.privateKey } });
}

export async function installationAccessToken(installationId: string) {
  const { auth } = appAuth();
  const result = await auth({ type: "installation", installationId: installationNumber(installationId) });
  if (result.type !== "token") throw new GitHubIntegrationError("GITHUB_INSTALLATION_AUTH_FAILED", "GitHub did not issue an installation token.", true);
  return result.token;
}

export async function installationOctokit(installationId: string) {
  return new Octokit({ auth: await installationAccessToken(installationId) });
}

export async function repositoryDetailsForApp(repositoryFullName: string): Promise<GitHubRepositoryDetails> {
  const { owner, repository, fullName } = splitRepository(repositoryFullName);
  try {
    const app = appOctokit();
    const installation = await app.request("GET /repos/{owner}/{repo}/installation", { owner, repo: repository });
    const installationId = String(installation.data.id);
    const octokit = await installationOctokit(installationId);
    const response = await octokit.rest.repos.get({ owner, repo: repository });
    const account = installation.data.account;
    const installationAccountLogin = account && "login" in account ? account.login : account && "name" in account ? account.name : owner;
    const installationAccountType = account && "type" in account ? account.type : null;
    return {
      installationId,
      installationAccountLogin,
      installationAccountType,
      repositoryId: String(response.data.id),
      repositoryFullName: response.data.full_name || fullName,
      defaultBranch: response.data.default_branch || "main"
    };
  } catch (error) {
    throw githubError(error, "GITHUB_REPOSITORY_ACCESS_FAILED", "Sentinel could not verify GitHub App access to this repository.");
  }
}

export function validCommitSha(value: string) {
  return /^[a-f0-9]{40}$/i.test(value);
}

export function validBranchName(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/.test(value) && !value.includes("..") && !value.endsWith("/");
}

export function normalizeBranches(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) throw new GitHubIntegrationError("GITHUB_BRANCHES_INVALID", "Provide between one and twenty allowed branches.");
  const branches = value.map((branch) => typeof branch === "string" ? branch.trim() : "");
  if (branches.some((branch) => branch !== "*" && !validBranchName(branch))) throw new GitHubIntegrationError("GITHUB_BRANCHES_INVALID", "One or more branch names are invalid.");
  return [...new Set(branches)];
}

export function branchIsAllowed(branch: string, allowedBranches: string[]) {
  return allowedBranches.includes("*") || allowedBranches.includes(branch);
}

function signatureFor(secret: string, body: string) {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function verifyGitHubSignature(rawBody: string, providedSignature: string | null) {
  const config = appConfiguration();
  if (!config || !providedSignature) return false;
  const expected = Buffer.from(signatureFor(config.webhookSecret, rawBody));
  const received = Buffer.from(providedSignature);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function stringAt(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function idAt(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function parseGitHubPushDelivery(rawBody: string, deliveryId: string | null, event: string | null): GitHubPushDelivery {
  if (event !== "push") throw new GitHubIntegrationError("GITHUB_EVENT_IGNORED", "Only GitHub push deliveries are supported.");
  if (!deliveryId || deliveryId.length > 128) throw new GitHubIntegrationError("GITHUB_DELIVERY_INVALID", "GitHub did not provide a valid delivery identifier.");
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    throw new GitHubIntegrationError("GITHUB_PAYLOAD_INVALID", "GitHub sent malformed JSON.");
  }
  const repository = payload.repository as Record<string, unknown> | undefined;
  const installation = payload.installation as Record<string, unknown> | undefined;
  const ref = stringAt(payload.ref);
  const branch = ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : "";
  const afterSha = stringAt(payload.after);
  const beforeSha = stringAt(payload.before);
  const repositoryId = idAt(repository?.id);
  const repositoryFullName = stringAt(repository?.full_name);
  const installationId = idAt(installation?.id);
  if (!repositoryId || !repositoryFullName || !installationId || !validBranchName(branch) || !validCommitSha(afterSha)) {
    throw new GitHubIntegrationError("GITHUB_PAYLOAD_INVALID", "GitHub delivery is missing a supported repository, branch, installation, or commit.");
  }
  return { deliveryId, event: "push", installationId, repositoryId, repositoryFullName, ref, branch, beforeSha: validCommitSha(beforeSha) ? beforeSha : null, afterSha };
}

export function githubCommitUrl(repositoryFullName: string, commitSha: string) {
  const { fullName } = splitRepository(repositoryFullName);
  if (!validCommitSha(commitSha)) return null;
  return `https://github.com/${fullName}/commit/${commitSha}`;
}

export function githubError(error: unknown, code: string, fallback: string) {
  if (error instanceof GitHubIntegrationError) return error;
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status) : 0;
  const transient = status === 429 || status >= 500 || status === 0;
  return new GitHubIntegrationError(code, fallback, transient);
}
