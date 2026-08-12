import { StepKind } from "@prisma/client";
import { Builder, type ThenableWebDriver } from "selenium-webdriver";

type BrowserOwner = { kind: "recording" | "run" | "adhoc"; id: string };
type RunEvidenceOffsets = { network: number; console: number };

export type BrowserRunSnapshot = {
  screenshot: Buffer;
  network: unknown[];
  console: unknown[];
  storage: unknown;
};

export type GuidedReplayStep = {
  order: number;
  kind: StepKind;
  target: unknown;
  value: string | null;
  isRedacted: boolean;
};

let driver: ThenableWebDriver | undefined;
let browserOwner: BrowserOwner | undefined;
let launchInFlight: Promise<ThenableWebDriver> | undefined;
const runEvidenceOffsets = new Map<string, RunEvidenceOffsets>();

const BROWSER_OPERATION_TIMEOUT_MS = 15_000;
const GUIDED_STEP_TIMEOUT_MS = 5_000;

type SeleniumStatus = {
  value?: {
    nodes?: Array<{
      slots?: Array<{
        session?: { sessionId?: string };
      }>;
    }>;
  };
};

function seleniumUrl(path: string) {
  const server = new URL(process.env.BROWSER_SELENIUM_URL ?? "http://browser:4444/wd/hub");
  return new URL(path, server.origin).toString();
}

function withTimeout<T>(operation: Promise<T>, code: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timed = new Promise<T>((resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(code)), BROWSER_OPERATION_TIMEOUT_MS);
    operation.then(resolve, reject);
  });
  return timed.finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

async function seleniumRequest(path: string, init?: RequestInit) {
  try {
    return await withTimeout(fetch(seleniumUrl(path), init), "BROWSER_SERVICE_TIMEOUT");
  } catch (error) {
    if (error instanceof Error && error.message === "BROWSER_SERVICE_TIMEOUT") throw error;
    throw new Error("BROWSER_SERVICE_UNAVAILABLE");
  }
}

async function closeStaleSeleniumSessions() {
  const statusResponse = await seleniumRequest("/status");
  if (!statusResponse.ok) throw new Error("BROWSER_STATUS_UNAVAILABLE");
  const status = await statusResponse.json() as SeleniumStatus;
  const sessionIds = status.value?.nodes?.flatMap((node) => node.slots ?? []).flatMap((slot) => slot.session?.sessionId ? [slot.session.sessionId] : []) ?? [];

  for (const sessionId of sessionIds) {
    const closeResponse = await seleniumRequest(`/session/${sessionId}`, { method: "DELETE" });
    if (!closeResponse.ok && closeResponse.status !== 404) throw new Error("BROWSER_SESSION_CLOSE_FAILED");
  }
}

async function closeExistingDriver() {
  if (!driver) return;
  const existingDriver = driver;
  driver = undefined;
  browserOwner = undefined;
  runEvidenceOffsets.clear();
  await Promise.race([
    existingDriver.quit().catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 2000))
  ]);
}

export async function closeBrowser() {
  await closeExistingDriver();
  await closeStaleSeleniumSessions();
}

function recorderScript(endpoint: string, token: string) {
  return `
    (() => {
      if (window.__sentinelRecorderInstalled) return;
      window.__sentinelRecorderInstalled = true;
      const emit = (kind, target, value, isRedacted) => fetch(${JSON.stringify(endpoint)}, {
        method: 'POST', mode: 'cors', keepalive: true, headers: {'content-type':'application/json', 'x-recording-token': ${JSON.stringify(token)}},
        body: JSON.stringify({kind, target, value, isRedacted, timestamp: new Date().toISOString()})
      }).catch(() => undefined);
      const describe = (element) => ({ tag: element.tagName.toLowerCase(), name: element.getAttribute('aria-label') || element.getAttribute('name') || '', text: element instanceof HTMLInputElement && element.type === 'password' ? '[REDACTED]' : (element.innerText || element.value || '').trim().slice(0, 120), testId: element.getAttribute('data-testid') || '' });
      document.addEventListener('click', (event) => { const element = event.target.closest('button,a,input,select,textarea,[role="button"]'); if (element) emit('CLICK', describe(element)); }, true);
      document.addEventListener('change', (event) => { const element = event.target; if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return; const secret = element instanceof HTMLInputElement && element.type === 'password'; emit('TEXT_ENTRY', describe(element), secret ? '[REDACTED]' : element.value, secret); }, true);
      const originalPush = history.pushState; history.pushState = function(...args) { const result = originalPush.apply(this, args); emit('NAVIGATION', {url: location.href, title: document.title}); return result; };
    })();`;
}

function runEvidenceScript() {
  return `
    (() => {
      if (window.__sentinelRunEvidenceInstalled) return;
      window.__sentinelRunEvidenceInstalled = true;
      const state = window.__sentinelRunEvidence = { network: [], console: [] };
      const text = (value) => {
        try { return typeof value === 'string' ? value.slice(0, 6144) : JSON.stringify(value).slice(0, 6144); }
        catch { return String(value).slice(0, 6144); }
      };
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const startedAt = performance.now();
        const request = args[0];
        const init = args[1] || {};
        const url = typeof request === 'string' ? request : request.url;
        const method = init.method || (typeof request === 'string' ? 'GET' : request.method) || 'GET';
        try {
          const response = await originalFetch(...args);
          const responseBody = await response.clone().text().catch(() => '');
          state.network.push({ url, method, status: response.status, durationMs: Math.round(performance.now() - startedAt), requestBody: init.body ? text(init.body) : undefined, responseBody: text(responseBody) });
          return response;
        } catch (error) {
          state.network.push({ url, method, status: 0, durationMs: Math.round(performance.now() - startedAt), error: text(error), requestBody: init.body ? text(init.body) : undefined });
          throw error;
        }
      };
      for (const level of ['warn', 'error']) {
        const original = console[level].bind(console);
        console[level] = (...args) => { state.console.push({ level, message: args.map(text).join(' ') }); original(...args); };
      }
    })();`;
}

async function createBrowser(targetUrl: string, setupScript?: string) {
  if (driver) throw new Error("BROWSER_BUSY");
  await closeStaleSeleniumSessions();
  const builder = new Builder();
  builder.usingServer(process.env.BROWSER_SELENIUM_URL ?? "http://browser:4444/wd/hub");
  builder.withCapabilities({
    browserName: "chrome",
    "goog:chromeOptions": {
      args: [
        "--kiosk",
        `--app=${targetUrl}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-session-crashed-bubble",
        "--disable-features=Translate,MediaRouter"
      ]
    }
  });
  const build = builder.build();
  let launchedDriver: ThenableWebDriver;
  try {
    launchedDriver = await withTimeout(build, "BROWSER_LAUNCH_TIMEOUT");
  } catch (error) {
    void build.then((lateDriver) => lateDriver.quit()).catch(() => undefined);
    throw error;
  }
  driver = launchedDriver;
  try {
    await withTimeout(launchedDriver.get(targetUrl), "BROWSER_NAVIGATION_TIMEOUT");
    if (setupScript) await withTimeout(launchedDriver.executeScript(setupScript).then(() => undefined), "BROWSER_SETUP_TIMEOUT");
    return launchedDriver;
  } catch (error) {
    await launchedDriver.quit().catch(() => undefined);
    driver = undefined;
    throw error;
  }
}

async function launchOwnedBrowser(targetUrl: string, owner: BrowserOwner, setupScript?: string, replaceExisting = false) {
  if (launchInFlight) throw new Error("BROWSER_LAUNCH_IN_PROGRESS");
  if (driver && !replaceExisting) throw new Error("BROWSER_BUSY");
  if (replaceExisting) await closeBrowser();
  const launch = createBrowser(targetUrl, setupScript);
  launchInFlight = launch;
  try {
    const launched = await launch;
    browserOwner = owner;
    return launched;
  } finally {
    if (launchInFlight === launch) launchInFlight = undefined;
  }
}

export async function launchBrowser(targetUrl: string, token: string) {
  return launchOwnedBrowser(targetUrl, { kind: "adhoc", id: token }, recorderScript("http://sentinel:3000/api/internal/events", token), true);
}

export async function launchRecordingBrowser(targetUrl: string, token: string, recordingId: string) {
  return launchOwnedBrowser(targetUrl, { kind: "recording", id: recordingId }, recorderScript("http://sentinel:3000/api/internal/events", token));
}

export async function launchRunBrowser(targetUrl: string, runId: string) {
  return launchOwnedBrowser(targetUrl, { kind: "run", id: runId }, runEvidenceScript());
}

function requireRunDriver(runId: string) {
  if (!driver || browserOwner?.kind !== "run" || browserOwner.id !== runId) throw new Error("RUN_BROWSER_UNAVAILABLE");
  return driver;
}

function normalizeEvidenceState(value: unknown) {
  if (!value || typeof value !== "object") return { network: [], console: [] };
  const candidate = value as { network?: unknown; console?: unknown };
  return { network: Array.isArray(candidate.network) ? candidate.network : [], console: Array.isArray(candidate.console) ? candidate.console : [] };
}

export async function captureRunBrowserSnapshot(runId: string): Promise<BrowserRunSnapshot> {
  const activeDriver = requireRunDriver(runId);
  const [encodedScreenshot, rawEvidence, storage] = await Promise.all([
    withTimeout(activeDriver.takeScreenshot(), "BROWSER_SCREENSHOT_TIMEOUT"),
    withTimeout(activeDriver.executeScript("return window.__sentinelRunEvidence || { network: [], console: [] };"), "BROWSER_EVIDENCE_TIMEOUT"),
    withTimeout(activeDriver.executeScript(`
      const values = (storage) => Object.keys(storage).map((key) => ({ key, value: storage.getItem(key) }));
      return {
        cookies: document.cookie.split(';').map((item) => item.trim()).filter(Boolean).map((item) => ({ name: item.split('=')[0], value: item.slice(item.indexOf('=') + 1) })),
        localStorage: values(window.localStorage),
        sessionStorage: values(window.sessionStorage)
      };
    `), "BROWSER_STORAGE_TIMEOUT")
  ]);
  const evidence = normalizeEvidenceState(rawEvidence);
  const offsets = runEvidenceOffsets.get(runId) ?? { network: 0, console: 0 };
  runEvidenceOffsets.set(runId, { network: evidence.network.length, console: evidence.console.length });
  return {
    screenshot: Buffer.from(encodedScreenshot, "base64"),
    network: evidence.network.slice(offsets.network),
    console: evidence.console.slice(offsets.console),
    storage
  };
}

function pause(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function normalizedUrl(value: string) {
  const url = new URL(value);
  return `${url.origin}${url.pathname}${url.search}${url.hash}`;
}

async function verifyGuidedNavigation(activeDriver: ThenableWebDriver, step: GuidedReplayStep) {
  const target = step.target && typeof step.target === "object" ? step.target as { url?: unknown } : {};
  if (typeof target.url !== "string") throw new Error("GUIDED_NAVIGATION_TARGET_MISSING");
  const expected = normalizedUrl(target.url);
  const deadline = Date.now() + GUIDED_STEP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const observed = normalizedUrl(await activeDriver.executeScript("return window.location.href;") as string);
    if (observed === expected) return;
    await pause(150);
  }
  throw new Error("GUIDED_NAVIGATION_MISMATCH");
}

function guidedValueFor(step: GuidedReplayStep) {
  const target = step.target && typeof step.target === "object" ? step.target as { name?: unknown } : {};
  const fieldName = typeof target.name === "string" ? target.name.toLowerCase() : "";
  if (step.isRedacted || fieldName.includes("password")) {
    const password = process.env.GUIDED_RUN_DEMO_PASSWORD;
    if (!password) throw new Error("GUIDED_CREDENTIAL_UNAVAILABLE");
    return password;
  }
  if (step.value === null) throw new Error("GUIDED_TEXT_VALUE_MISSING");
  return step.value;
}

function guidedActionScript(parameters: unknown[]) {
  return `
  const [target, kind, value] = ${JSON.stringify(parameters)};
  const exact = (left, right) => String(left || '').trim() === String(right || '').trim();
  const readableName = (element) => element.getAttribute('aria-label') || element.getAttribute('name') || element.textContent || '';
  const roleForTag = { button: 'button', a: 'link', input: 'textbox', textarea: 'textbox', select: 'combobox' };
  const choose = (label, candidates) => {
    const unique = [...new Set(candidates)];
    if (unique.length === 1) return unique[0];
    if (unique.length > 1) throw new Error('GUIDED_SELECTOR_AMBIGUOUS:' + label);
    return undefined;
  };
  const tag = String(target.tag || '').toLowerCase();
  const name = String(target.name || '').trim();
  const text = String(target.text || '').trim();
  let element;
  if (target.testId) element = choose('data-testid', [...document.querySelectorAll('[data-testid]')].filter((node) => exact(node.getAttribute('data-testid'), target.testId)));
  if (!element && name) {
    element = choose('field-name', [...document.querySelectorAll('[name]')].filter((node) => exact(node.getAttribute('name'), name)));
    if (!element) {
      element = choose('field-label', [...document.querySelectorAll('label')].filter((label) => exact(label.textContent, name)).flatMap((label) => {
        const control = label.htmlFor ? document.getElementById(label.htmlFor) : label.querySelector('input, textarea, select');
        return control ? [control] : [];
      }));
    }
  }
  const role = roleForTag[tag];
  if (!element && role && (text || name)) {
    const accessibleName = text || name;
    element = choose('role-and-name', [...document.querySelectorAll('*')].filter((node) => (node.getAttribute('role') === role || node.tagName.toLowerCase() === tag) && exact(readableName(node), accessibleName)));
  }
  if (!element && tag && text && text !== '[REDACTED]') {
    element = choose('tag-and-text', [...document.querySelectorAll(tag)].filter((node) => exact(node.textContent, text)));
  }
  if (!element) throw new Error('GUIDED_SELECTOR_NOT_FOUND');
  if (kind === 'CLICK') {
    element.focus();
    element.click();
    return { ok: true };
  }
  if (kind === 'TEXT_ENTRY') {
    if (!('value' in element)) throw new Error('GUIDED_TEXT_TARGET_INVALID');
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  }
  throw new Error('GUIDED_STEP_UNSUPPORTED');
`;
}

export async function replayGuidedRunStep(runId: string, step: GuidedReplayStep) {
  const activeDriver = requireRunDriver(runId);
  if (step.kind === StepKind.NAVIGATION) {
    await verifyGuidedNavigation(activeDriver, step);
    return;
  }
  const value = step.kind === StepKind.TEXT_ENTRY ? guidedValueFor(step) : null;
  try {
    await withTimeout(activeDriver.executeScript(guidedActionScript([step.target, step.kind, value])).then(() => undefined), "GUIDED_STEP_TIMEOUT");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("GUIDED_")) throw error;
    const message = error instanceof Error ? error.message : "Unknown guided browser action failure.";
    if (message.includes("GUIDED_SELECTOR_AMBIGUOUS")) throw new Error("GUIDED_SELECTOR_AMBIGUOUS");
    if (message.includes("GUIDED_SELECTOR_NOT_FOUND")) throw new Error("GUIDED_SELECTOR_NOT_FOUND");
    throw new Error("GUIDED_STEP_ACTION_FAILED");
  }
}

export async function closeRunBrowser(runId: string) {
  if (browserOwner?.kind !== "run" || browserOwner.id !== runId) return;
  await closeBrowser();
}
