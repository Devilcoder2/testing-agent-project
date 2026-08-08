import { Builder, type ThenableWebDriver } from "selenium-webdriver";

let driver: ThenableWebDriver | undefined;
let launchInFlight: Promise<ThenableWebDriver> | undefined;

const BROWSER_OPERATION_TIMEOUT_MS = 15_000;

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

async function startBrowser(targetUrl: string, token: string) {
  await closeBrowser();
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
    await withTimeout(launchedDriver.executeScript(recorderScript("http://sentinel:3000/api/internal/events", token)), "BROWSER_RECORDER_TIMEOUT");
    return launchedDriver;
  } catch (error) {
    await launchedDriver.quit().catch(() => undefined);
    driver = undefined;
    throw error;
  }
}

export async function launchBrowser(targetUrl: string, token: string) {
  if (launchInFlight) throw new Error("BROWSER_LAUNCH_IN_PROGRESS");
  const launch = startBrowser(targetUrl, token);
  launchInFlight = launch;
  try {
    return await launch;
  } finally {
    if (launchInFlight === launch) launchInFlight = undefined;
  }
}
